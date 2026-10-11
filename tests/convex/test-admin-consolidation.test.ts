/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Admin consolidation tests (paginated-only admin API + cascade device delete).
 *
 * 1. Static api-surface assertion: the 8 legacy array-returning queries
 *    (adminOverview, adminConsole, adminDevicesList, adminSupportTickets,
 *    adminProductsList, adminPlantCatalogList, adminBlogPostsList,
 *    adminUsersList) are GONE; the surface is exactly the 8 paginated/stats
 *    queries + the 8 mutations, with adminDeleteDevice args unchanged.
 * 2. Paginated shapes serve useAdmin needs: every paginated query returns the
 *    same item fields the dashboard `data` object consumes.
 * 3. adminDeleteDevice cascades to every device/plant child row (plants,
 *    sensors, sensorReadings, growEvents, plantImages, videoRecordings,
 *    careSchedules, automationLogs), draining tables in batches — the
 *    sensorReadings seed (120 rows) exceeds the 100-row batch size so the
 *    loop-until-exhausted path is exercised.
 *
 * Uses a self-contained in-memory fake (bare `.withIndex(name)` scans
 * supported) so this suite never depends on the shared fake's surface.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import * as adminModule from '../../convex/admin'
import {
  adminStats,
  adminRecentEvents,
  adminDevicesPaginated,
  adminSupportPaginated,
  adminProductsPaginated,
  adminPlantCatalogPaginated,
  adminBlogPostsPaginated,
  adminUsersPaginated,
  adminDeleteDevice,
} from '../../convex/admin'

// ---------- minimal in-memory fake (bare withIndex scans supported) ----------

type Doc = Record<string, any>

class Runner {
  constructor(
    private getDocs: () => Doc[],
    private filters: Array<{ field: string; value: unknown }> = [],
    private desc = false,
  ) {}

  order(direction: 'asc' | 'desc'): Runner {
    return new Runner(this.getDocs, this.filters, direction === 'desc')
  }

  private run(): Doc[] {
    const out = this.getDocs().filter((d) => this.filters.every((f) => d[f.field] === f.value))
    out.sort((a, b) => (this.desc ? b._seq - a._seq : a._seq - b._seq))
    return out
  }

  async collect(): Promise<Doc[]> {
    return this.run()
  }

  async first(): Promise<Doc | null> {
    return this.run()[0] ?? null
  }

  async take(n: number): Promise<Doc[]> {
    return this.run().slice(0, n)
  }

  async paginate(opts: { cursor?: string | null; numItems?: number }): Promise<{
    page: Doc[]
    isDone: boolean
    continueCursor: string
  }> {
    const rows = this.run()
    const numItems = opts.numItems ?? 100
    const offset = opts.cursor ? Number(opts.cursor) : 0
    const page = rows.slice(offset, offset + numItems)
    const next = offset + numItems
    return { page, isDone: next >= rows.length, continueCursor: String(next) }
  }
}

interface FakeCtx {
  db: {
    get: (id: string) => Promise<Doc | null>
    insert: (table: string, doc: Record<string, unknown>) => Promise<string>
    patch: (id: string, value: Record<string, unknown>) => Promise<void>
    delete: (id: string) => Promise<void>
    query: (table: string) => any
    all: (table: string) => Doc[]
  }
  __testUserId: string | null
}

function createCtx(): FakeCtx {
  const tables = new Map<string, Map<string, Doc>>()
  let seq = 0
  const snapshot = (name: string): Doc[] => [...(tables.get(name)?.values() ?? [])]
  const get = async (id: string): Promise<Doc | null> => {
    for (const m of tables.values()) {
      const doc = m.get(String(id))
      if (doc) return doc
    }
    return null
  }
  const db = {
    get,
    insert: async (table: string, doc: Record<string, unknown>) => {
      seq += 1
      const id = `${table}|${seq}`
      const stored: Doc = { ...doc, _id: id, _seq: seq }
      let m = tables.get(table)
      if (!m) {
        m = new Map()
        tables.set(table, m)
      }
      m.set(id, stored)
      return id
    },
    patch: async (id: string, value: Record<string, unknown>) => {
      const doc = await get(id)
      if (!doc) throw new Error(`patch: doc not found: ${id}`)
      Object.assign(doc, value)
    },
    delete: async (id: string) => {
      for (const m of tables.values()) m.delete(String(id))
    },
    query: (table: string) => {
      const getDocs = () => snapshot(table)
      return {
        withIndex: (_name: string, fn?: (q: any) => void) => {
          const filters: Array<{ field: string; value: unknown }> = []
          if (fn) {
            const q: any = {
              eq: (field: string, value: unknown) => {
                filters.push({ field, value })
                return q
              },
            }
            fn(q)
          }
          return new Runner(getDocs, filters)
        },
        order: (direction: 'asc' | 'desc') => new Runner(getDocs, [], direction === 'desc'),
        collect: () => new Runner(getDocs).collect(),
        first: () => new Runner(getDocs).first(),
        take: (n: number) => new Runner(getDocs).take(n),
        paginate: (opts: { cursor?: string | null; numItems?: number }) =>
          new Runner(getDocs).paginate(opts),
      }
    },
    all: (table: string) => snapshot(table),
  }
  return { db, __testUserId: null }
}

async function callHandler(fn: any, ctx: FakeCtx, args: any): Promise<any> {
  return await fn._handler(ctx, args)
}

const pageArgs = (numItems: number) => ({ paginationOpts: { numItems, cursor: null } })

// ---------- 1. static api-surface assertion ----------

describe('admin consolidation: legacy array queries are gone', () => {
  const DELETED = [
    'adminOverview',
    'adminConsole',
    'adminDevicesList',
    'adminSupportTickets',
    'adminProductsList',
    'adminPlantCatalogList',
    'adminBlogPostsList',
    'adminUsersList',
  ]

  const EXPECTED_QUERIES = [
    'adminBlogPostsPaginated',
    'adminDevicesPaginated',
    'adminPlantCatalogPaginated',
    'adminProductsPaginated',
    'adminRecentEvents',
    'adminStats',
    'adminSupportPaginated',
    'adminUsersPaginated',
  ].sort()

  const EXPECTED_MUTATIONS = [
    'adminClearDeviceClaim',
    'adminClearDeviceOta',
    'adminDeleteDevice',
    'adminDeleteOfficialProduct',
    'adminDeletePlantPreset',
    'adminQueueDeviceCommand',
    'adminSaveDevice',
    'adminSaveOfficialProduct',
    'adminSavePlantPreset',
    'adminStageDeviceClaim',
    'adminStageDeviceConfig',
    'adminStageDeviceOta',
    'adminUpdateOfficialProductStatus',
    'adminUpdateUserAccess',
  ].sort()

  it('exports exactly the paginated/stats queries + mutations — nothing else', () => {
    for (const name of DELETED) {
      expect((adminModule as Record<string, any>)[name], `${name} must be deleted`).toBeUndefined()
    }
    expect(Object.keys(adminModule).sort()).toEqual([...EXPECTED_QUERIES, ...EXPECTED_MUTATIONS].sort())
  })

  it('keeps query/mutation kinds and public visibility', () => {
    for (const name of EXPECTED_QUERIES) {
      const fn = (adminModule as Record<string, any>)[name]
      expect(fn.isQuery).toBe(true)
      expect(fn.isPublic).toBe(true)
    }
    for (const name of EXPECTED_MUTATIONS) {
      const fn = (adminModule as Record<string, any>)[name]
      expect(fn.isMutation).toBe(true)
      expect(fn.isPublic).toBe(true)
    }
  })

  it('keeps adminDeleteDevice args identical ({ deviceId: id<devices> })', () => {
    expect((adminDeleteDevice as any).exportArgs()).toBe(
      '{"type":"object","value":{"deviceId":{"fieldType":{"type":"id","tableName":"devices"},"optional":false}}}',
    )
  })
})

// ---------- 2. paginated shapes serve useAdmin needs ----------

const NOW = 1_700_000_000_000

async function seedDashboard(ctx: FakeCtx) {
  const adminId = await ctx.db.insert('users', {
    name: 'Admin',
    email: 'admin@growmate.id',
    role: 'admin',
    tier: 'advanced',
    setupComplete: true,
    createdAt: NOW,
    updatedAt: NOW,
  })
  const ownerId = await ctx.db.insert('users', {
    name: 'Grower',
    email: 'grower@growmate.id',
    role: 'grower',
    tier: 'basic',
    setupComplete: true,
    createdAt: NOW,
    updatedAt: NOW,
  })
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: 'GM-1',
    name: 'Pod GM-1',
    version: 'v1',
    autoWatering: true,
    autoLighting: false,
    wateringThreshold: 40,
    wateringDuration: 5,
    wateringCooldown: 60,
    lightingThreshold: 30,
    lightingHysteresis: 5,
    autoFertilizing: false,
    autoPesticide: false,
    fertilizingThreshold: 35,
    fertilizingDuration: 5,
    fertilizingCooldown: 60,
    pesticideThreshold: 35,
    pesticideDuration: 5,
    pesticideCooldown: 60,
    lightEnabled: false,
    lastSeen: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    userId: ownerId,
  })
  const plantId = await ctx.db.insert('plants', {
    deviceId: deviceDocId,
    name: 'Cabai',
    species: 'Capsicum',
    growthStage: 'vegetative_growth',
    wateringThreshold: 40,
    lightingThreshold: 30,
    location: 'Rak 1',
    archived: false,
    plantedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await ctx.db.patch(deviceDocId, { plantId })
  const requestId = await ctx.db.insert('supportRequests', {
    userId: ownerId,
    status: 'open',
    priority: 'normal',
    topic: 'Air bocor',
    createdAt: NOW,
    updatedAt: NOW,
  })
  await ctx.db.insert('supportMessages', {
    requestId,
    senderUserId: ownerId,
    senderRole: 'user',
    body: 'Pompa menyala terus',
    createdAt: NOW,
  })
  await ctx.db.insert('products', {
    title: 'Grow Kit',
    description: 'Paket lengkap',
    price: 250000,
    category: 'Grow Kit',
    type: 'official',
    sellerId: adminId,
    status: 'active',
    quantityAvailable: 10,
    priceUnit: 'item',
    imageUrl: 'https://img.example/kit.jpg',
    featured: false,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await ctx.db.insert('products', {
    title: 'Panen tetangga',
    description: 'Segar',
    price: 20000,
    category: 'panen',
    type: 'community',
    sellerId: ownerId,
    status: 'active',
    quantityAvailable: 5,
    priceUnit: 'kg',
    featured: false,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await ctx.db.insert('plantCatalog', {
    key: 'cabai_rawit',
    name: 'Cabai Rawit',
    species: 'Capsicum frutescens',
    growthStage: 'vegetative_growth',
    description: 'Pedas',
    location: 'Outdoor',
    category: 'fruiting',
    difficulty: 'easy',
    wateringThreshold: 40,
    lightingThreshold: 30,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await ctx.db.insert('blogPosts', {
    authorId: adminId,
    title: 'Tips menyiram',
    excerpt: 'Jangan berlebihan',
    body: 'Isi artikel',
    published: true,
    featured: false,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await ctx.db.insert('growEvents', {
    deviceId: deviceDocId,
    plantId,
    userId: ownerId,
    source: 'system',
    entityType: 'device',
    eventType: 'system_watering',
    title: 'Penyiraman otomatis',
    timestamp: NOW,
  })
  return { adminId, ownerId, deviceDocId, plantId }
}

describe('admin consolidation: paginated shapes serve useAdmin', () => {
  let ctx: FakeCtx

  it('devices/support/products/plants/blog/users/stats/recentEvents carry the dashboard fields', async () => {
    ctx = createCtx()
    const { adminId } = await seedDashboard(ctx)
    ctx.__testUserId = adminId

    const devices = await callHandler(adminDevicesPaginated, ctx, pageArgs(40))
    expect(devices.page).toHaveLength(1)
    expect(devices.page[0]).toMatchObject({
      deviceId: 'GM-1',
      ownerName: 'Grower',
      ownerEmail: 'grower@growmate.id',
      plantName: 'Cabai',
      isClaimed: true,
      autoWatering: true,
      wateringThreshold: 40,
      version: 'v1',
      lastSeenLabel: expect.any(String),
      isOnline: expect.any(Boolean),
    })

    const support = await callHandler(adminSupportPaginated, ctx, pageArgs(30))
    expect(support.page).toHaveLength(1)
    expect(support.page[0]).toMatchObject({
      topic: 'Air bocor',
      userName: 'Grower',
      userEmail: 'grower@growmate.id',
      createdAtLabel: expect.any(String),
      updatedAtLabel: expect.any(String),
    })
    expect(support.page[0].messages).toHaveLength(1)
    expect(support.page[0].messages[0]).toMatchObject({
      body: 'Pompa menyala terus',
      senderName: 'Grower',
      createdAtLabel: expect.any(String),
    })

    const products = await callHandler(adminProductsPaginated, ctx, pageArgs(20))
    expect(products.page).toHaveLength(1)
    expect(products.page[0]).toMatchObject({
      title: 'Grow Kit',
      type: 'official',
      sellerName: 'Admin',
      priceLabel: expect.any(String),
      quantityLabel: expect.any(String),
      statusLabel: expect.any(String),
    })

    const catalog = await callHandler(adminPlantCatalogPaginated, ctx, pageArgs(64))
    expect(catalog.page).toHaveLength(1)
    expect(catalog.page[0]).toMatchObject({ key: 'cabai_rawit', imageUrl: null })

    const blog = await callHandler(adminBlogPostsPaginated, ctx, pageArgs(24))
    expect(blog.page).toHaveLength(1)
    expect(blog.page[0]).toMatchObject({
      title: 'Tips menyiram',
      authorName: 'Admin',
      createdAtLabel: expect.any(String),
      relativeTime: expect.any(String),
    })

    const users = await callHandler(adminUsersPaginated, ctx, pageArgs(24))
    expect(users.page).toHaveLength(2)
    expect(users.page[0]).toMatchObject({
      name: expect.any(String),
      email: expect.any(String),
      tier: expect.any(String),
      role: expect.any(String),
      setupComplete: expect.any(Boolean),
    })

    const stats = await callHandler(adminStats, ctx, {})
    expect(stats).toMatchObject({
      totalUsers: 2,
      totalDevices: 1,
      claimedDevices: 1,
      activePlants: 1,
      openTickets: 1,
      officialProducts: 1,
      communityListings: 1,
      communityPosts: 0,
      blogPosts: 1,
    })

    const events = await callHandler(adminRecentEvents, ctx, {})
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      title: 'Penyiraman otomatis',
      timestampLabel: expect.any(String),
    })
  })

  it('rejects non-admin callers on the new queries', async () => {
    ctx = createCtx()
    const { ownerId } = await seedDashboard(ctx)
    ctx.__testUserId = ownerId
    await expect(callHandler(adminStats, ctx, {})).rejects.toThrow('Akses admin diperlukan')
    await expect(callHandler(adminDevicesPaginated, ctx, pageArgs(40))).rejects.toThrow(
      'Akses admin diperlukan',
    )
    await expect(callHandler(adminSupportPaginated, ctx, pageArgs(30))).rejects.toThrow(
      'Akses admin diperlukan',
    )
  })
})

// ---------- 3. cascade device delete ----------

describe('admin consolidation: adminDeleteDevice cascades', () => {
  it('deletes the device and every child row, draining multi-batch tables', async () => {
    const ctx = createCtx()
    const adminId = await ctx.db.insert('users', { name: 'Admin', role: 'admin' })
    ctx.__testUserId = adminId

    const deviceDocId = await ctx.db.insert('devices', {
      deviceId: 'GM-CASCADE',
      name: 'Pod cascade',
      createdAt: NOW,
      updatedAt: NOW,
      lastSeen: NOW,
    })
    const plantA = await ctx.db.insert('plants', {
      deviceId: deviceDocId,
      name: 'Cabai A',
      archived: false,
      plantedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    const plantB = await ctx.db.insert('plants', {
      deviceId: deviceDocId,
      name: 'Cabai B',
      archived: true,
      plantedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    })
    await ctx.db.patch(deviceDocId, { plantId: plantA })

    // 120 readings > 100-row cascade batch: proves loop-until-exhausted.
    for (let i = 0; i < 120; i++) {
      await ctx.db.insert('sensorReadings', {
        deviceId: deviceDocId,
        plantId: plantA,
        kind: 'soil',
        value: 40 + (i % 10),
        unit: '%',
        measuredAt: NOW + i,
      })
    }
    for (const plantId of [plantA, plantB]) {
      await ctx.db.insert('sensors', {
        deviceId: deviceDocId,
        plantId,
        kind: 'soil',
        value: 41,
        unit: '%',
        measuredAt: NOW,
        createdAt: NOW,
      })
      await ctx.db.insert('plantImages', {
        deviceId: deviceDocId,
        plantId,
        source: 'camera',
        capturedAt: NOW,
      })
      await ctx.db.insert('careSchedules', {
        plantId,
        title: 'Siram pagi',
        enabled: true,
        nextRunAt: NOW,
        createdAt: NOW,
      })
      // Plant-keyed event with NO deviceId: only reachable via the plant loop.
      await ctx.db.insert('growEvents', {
        plantId,
        source: 'system',
        entityType: 'plant',
        eventType: 'plant_added',
        title: 'Tanaman ditambahkan',
        timestamp: NOW,
      })
    }
    await ctx.db.insert('videoRecordings', {
      deviceId: deviceDocId,
      fileName: 'seg.mp4',
      path: 'gm-cascade/seg.mp4',
      size: 1024,
      capturedAt: NOW,
      uploadedAt: NOW,
    })
    await ctx.db.insert('growEvents', {
      deviceId: deviceDocId,
      source: 'device',
      entityType: 'device',
      eventType: 'system_watering',
      title: 'Penyiraman otomatis',
      timestamp: NOW,
    })
    await ctx.db.insert('automationLogs', {
      deviceId: deviceDocId,
      plantId: plantA,
      timestamp: NOW,
      action: 'pump_enabled',
    })
    // Unrelated rows that must survive.
    const otherDevice = await ctx.db.insert('devices', {
      deviceId: 'GM-OTHER',
      name: 'Pod lain',
      createdAt: NOW,
      updatedAt: NOW,
      lastSeen: NOW,
    })
    const otherReading = await ctx.db.insert('sensorReadings', {
      deviceId: otherDevice,
      kind: 'soil',
      value: 50,
      unit: '%',
      measuredAt: NOW,
    })

    const res = await callHandler(adminDeleteDevice, ctx, { deviceId: deviceDocId })
    expect(res).toMatchObject({ success: true })

    expect(await ctx.db.get(deviceDocId)).toBeNull()
    const remaining = (table: string) => ctx.db.all(table)
    expect(remaining('plants').filter((p) => String(p.deviceId) === String(deviceDocId))).toHaveLength(0)
    expect(remaining('sensors').filter((s) => String(s.deviceId) === String(deviceDocId))).toHaveLength(0)
    expect(
      remaining('sensorReadings').filter((r) => String(r.deviceId) === String(deviceDocId)),
    ).toHaveLength(0)
    expect(remaining('sensorReadings')).toHaveLength(1)
    expect(await ctx.db.get(otherReading)).not.toBeNull()
    expect(
      remaining('plantImages').filter((i) => String(i.deviceId) === String(deviceDocId)),
    ).toHaveLength(0)
    expect(
      remaining('videoRecordings').filter((v) => String(v.deviceId) === String(deviceDocId)),
    ).toHaveLength(0)
    expect(
      remaining('growEvents').filter(
        (e) => String(e.deviceId) === String(deviceDocId) || [plantA, plantB].map(String).includes(String(e.plantId)),
      ),
    ).toHaveLength(0)
    expect(
      remaining('careSchedules').filter((c) => [plantA, plantB].map(String).includes(String(c.plantId))),
    ).toHaveLength(0)
    expect(
      remaining('automationLogs').filter((l) => String(l.deviceId) === String(deviceDocId)),
    ).toHaveLength(0)
    expect(await ctx.db.get(otherDevice)).not.toBeNull()
  })

  it('rejects missing devices, claimed devices, and non-admin callers', async () => {
    const ctx = createCtx()
    const adminId = await ctx.db.insert('users', { name: 'Admin', role: 'admin' })
    const growerId = await ctx.db.insert('users', { name: 'Grower', role: 'grower' })
    const claimed = await ctx.db.insert('devices', {
      deviceId: 'GM-CLAIMED',
      name: 'Pod klaim',
      userId: growerId,
      createdAt: NOW,
      updatedAt: NOW,
      lastSeen: NOW,
    })

    ctx.__testUserId = adminId
    await expect(callHandler(adminDeleteDevice, ctx, { deviceId: 'devices|999999' })).rejects.toThrow(
      'Perangkat tidak ditemukan',
    )
    await expect(callHandler(adminDeleteDevice, ctx, { deviceId: claimed })).rejects.toThrow(
      'Lepaskan klaim perangkat',
    )
    expect(await ctx.db.get(claimed)).not.toBeNull()

    ctx.__testUserId = growerId
    await expect(callHandler(adminDeleteDevice, ctx, { deviceId: claimed })).rejects.toThrow(
      'Akses admin diperlukan',
    )
  })
})
