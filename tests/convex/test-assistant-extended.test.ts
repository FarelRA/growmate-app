/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import {
  sendAssistantMessage,
  resetAssistantThread,
  assistantCreateSchedule,
  assistantTriggerWatering,
  assistantTriggerLighting,
  assistantTriggerFertilizing,
  assistantTriggerPesticide,
} from '../../convex/assistant'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

/**
 * Same gte-capable upgrade as test-assistant-rules.test.ts (covers
 * `getAssistantUsage`'s `.gte('createdAt', …)` + paginate), plus a
 * *capturing* scheduler stub so send-path tests can inspect the AI context
 * (archived-plant deactivation, plant-vs-device thresholds) handed to
 * `ctx.scheduler.runAfter`. Cases here intentionally avoid the sibling's
 * quota/ownership basics and reset no-op/unauth cases.
 */
function withAssistantSupport(ctx: FakeCtx): FakeCtx {
  const calls: any[] = []
  ;(ctx as any).scheduler = {
    runAfter: async (...args: any[]) => {
      calls.push(args)
      return undefined
    },
  }
  ;(ctx as any).__schedulerCalls = calls
  const apply = (
    docs: any[],
    eq: { field: string; value: unknown }[],
    gte: { field: string; value: any }[],
  ) =>
    docs.filter(
      (d) => eq.every((f) => d[f.field] === f.value) && gte.every((f) => d[f.field] >= f.value),
    )
  const makeRunner = (
    docs: () => any[],
    eq: { field: string; value: unknown }[],
    gte: { field: string; value: any }[],
    desc: boolean,
  ) => {
    const run = () => {
      const out = apply(docs(), eq, gte)
      out.sort((a, b) => (desc ? b._seq - a._seq : a._seq - b._seq))
      return out
    }
    return {
      order: (dir: 'asc' | 'desc') => makeRunner(docs, eq, gte, dir === 'desc'),
      collect: async () => run(),
      first: async () => run()[0] ?? null,
      take: async (n: number) => run().slice(0, n),
      unique: async () => {
        const rows = run()
        if (rows.length > 1) throw new Error('unique() matched multiple docs')
        return rows[0] ?? null
      },
      paginate: async (opts: { cursor?: string | null; numItems?: number }) => {
        const rows = run()
        const numItems = opts.numItems ?? 100
        const offset = opts.cursor ? Number(opts.cursor) : 0
        const page = rows.slice(offset, offset + numItems)
        const next = offset + numItems
        return { page, isDone: next >= rows.length, continueCursor: String(next) }
      },
    }
  }
  ctx.db.query = ((table: string) => ({
    withIndex: (_name: string, fn: (q: any) => void) => {
      const eq: { field: string; value: unknown }[] = []
      const gte: { field: string; value: any }[] = []
      const q: any = {
        eq: (field: string, value: unknown) => {
          eq.push({ field, value })
          return q
        },
        gte: (field: string, value: any) => {
          gte.push({ field, value })
          return q
        },
      }
      fn(q)
      return makeRunner(() => ctx.db.all(table), eq, gte, false)
    },
    order: (dir: 'asc' | 'desc') => makeRunner(() => ctx.db.all(table), [], [], dir === 'desc'),
    collect: () => makeRunner(() => ctx.db.all(table), [], [], false).collect(),
    first: () => makeRunner(() => ctx.db.all(table), [], [], false).first(),
    take: (n: number) => makeRunner(() => ctx.db.all(table), [], [], false).take(n),
    paginate: (opts: { cursor?: string | null; numItems?: number }) =>
      makeRunner(() => ctx.db.all(table), [], [], false).paginate(opts),
  })) as any
  return ctx
}

function freshCtx(): FakeCtx {
  return withAssistantSupport(createFakeCtx())
}

function schedulerContext(ctx: FakeCtx): any {
  const calls = (ctx as any).__schedulerCalls as any[]
  expect(calls).toHaveLength(1)
  return calls[0]![2].context
}

async function seedUser(
  ctx: FakeCtx,
  name: string,
  tier: 'basic' | 'advanced' = 'basic',
): Promise<string> {
  return await ctx.db.insert('users', { name, role: 'grower', tier })
}

async function seedThread(ctx: FakeCtx, userId: string): Promise<string> {
  return await ctx.db.insert('assistantThreads', {
    userId,
    title: 'Percakapan Floral Assistant',
    createdAt: now,
    updatedAt: now,
  })
}

async function seedMessages(ctx: FakeCtx, threadId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i++) {
    await ctx.db.insert('assistantMessages', {
      threadId,
      role: 'user',
      body: `pesan ${i + 1}`,
      status: 'complete',
      createdAt: now,
    })
  }
}

async function seedDeviceWithPlant(
  ctx: FakeCtx,
  ownerId: string,
  externalId: string,
  opts: { archived?: boolean; version?: 'v1' | 'v2' } = {},
): Promise<{ deviceDocId: string; plantId: string }> {
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: externalId,
    name: `Pod ${externalId}`,
    userId: ownerId,
    version: opts.version ?? 'v1',
    createdAt: now,
    updatedAt: now,
  })
  const plantId = await ctx.db.insert('plants', {
    deviceId: deviceDocId,
    name: 'Cabai',
    archived: opts.archived ?? false,
    plantedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(deviceDocId, { plantId })
  return { deviceDocId, plantId }
}

describe('resetAssistantThread: extended scoping', () => {
  it('second reset is idempotent (success, nothing resurrected)', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const threadId = await seedThread(ctx, userId)
    await seedMessages(ctx, threadId, 3)
    ctx.__testUserId = userId

    await expect(callHandler(resetAssistantThread, ctx, {})).resolves.toMatchObject({
      success: true,
    })
    expect(await ctx.db.get(threadId)).toBeNull()
    expect(ctx.db.all('assistantMessages')).toHaveLength(0)

    await expect(callHandler(resetAssistantThread, ctx, {})).resolves.toMatchObject({
      success: true,
    })
    expect(ctx.db.all('assistantThreads')).toHaveLength(0)
    expect(ctx.db.all('assistantMessages')).toHaveLength(0)
  })

  it('drains threads beyond the 64-row batch window', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const threadId = await seedThread(ctx, userId)
    await seedMessages(ctx, threadId, 70)
    ctx.__testUserId = userId

    await expect(callHandler(resetAssistantThread, ctx, {})).resolves.toMatchObject({
      success: true,
    })
    expect(await ctx.db.get(threadId)).toBeNull()
    expect(ctx.db.all('assistantMessages')).toHaveLength(0)
  })
})

describe('sendAssistantMessage: archived plant', () => {
  it('succeeds but deactivates plant context (activePlant null, no sensors)', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    await seedDeviceWithPlant(ctx, userId, 'GM-ARC', { archived: true })
    ctx.__testUserId = userId

    const res = await callHandler(sendAssistantMessage, ctx, {
      body: 'halo',
      deviceId: 'GM-ARC',
    })
    expect(res.success).toBe(true)

    const context = schedulerContext(ctx)
    expect(context.activePlant).toBeNull()
    expect(context.sensors).toHaveLength(0)
    expect(context.schedules).toHaveLength(0)
    // Thread keeps the user message + assistant placeholder.
    expect(ctx.db.all('assistantMessages')).toHaveLength(2)
  })
})

describe('sendAssistantMessage: plant thresholds take precedence over device defaults', () => {
  it('evaluates sensors against the plant sensorProfile, surfaces both thresholds', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-THR')
    // Plant demands soil >= 50 (stricter than the 30 default); device keeps
    // its own looser watering threshold. Value 40 is optimal under defaults
    // but low under the plant profile.
    await ctx.db.patch(plantId, {
      sensorProfile: { soil: { min: 50, max: 80 } },
      wateringThreshold: 45,
    })
    const deviceDocId = ctx.db
      .all('devices')
      .find((d) => d.deviceId === 'GM-THR')!._id as string
    await ctx.db.patch(deviceDocId, { wateringThreshold: 25 })
    await ctx.db.insert('sensors', {
      plantId,
      kind: 'soil',
      value: 40,
      unit: '%',
    })
    ctx.__testUserId = userId

    const res = await callHandler(sendAssistantMessage, ctx, {
      body: 'bagaimana tanahku?',
      deviceId: 'GM-THR',
    })
    expect(res.success).toBe(true)

    const context = schedulerContext(ctx)
    expect(context.activePlant.wateringThreshold).toBe(45)
    expect(context.activeDevice.wateringThreshold).toBe(25)
    const soil = context.sensors.find((s: any) => s.kind === 'soil')
    expect(soil.status).toBe('low')
    expect(soil.target).toContain('50')
  })
})

describe('assistantCreateSchedule: validation', () => {
  it('rejects an empty title and writes nothing', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    await seedDeviceWithPlant(ctx, userId, 'GM-S1')
    const before = ctx.db.all('careSchedules').length

    await expect(
      callHandler(assistantCreateSchedule, ctx, {
        userId,
        deviceId: 'GM-S1',
        title: '   ',
        cadenceUnit: 'days',
        cadenceValue: 1,
      }),
    ).rejects.toThrow('Judul jadwal wajib diisi')
    expect(ctx.db.all('careSchedules')).toHaveLength(before)
  })

  it('rejects a device with no active plant', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    await ctx.db.insert('devices', {
      deviceId: 'GM-BARE',
      name: 'Pod GM-BARE',
      userId,
      createdAt: now,
      updatedAt: now,
    })

    await expect(
      callHandler(assistantCreateSchedule, ctx, {
        userId,
        deviceId: 'GM-BARE',
        title: 'Siram pagi',
        cadenceUnit: 'days',
        cadenceValue: 1,
      }),
    ).rejects.toThrow('Perangkat dengan tanaman aktif tidak ditemukan')
  })

  it('rejects an archived plant', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    await seedDeviceWithPlant(ctx, userId, 'GM-ARC2', { archived: true })

    await expect(
      callHandler(assistantCreateSchedule, ctx, {
        userId,
        deviceId: 'GM-ARC2',
        title: 'Siram pagi',
        cadenceUnit: 'days',
        cadenceValue: 1,
      }),
    ).rejects.toThrow('Tanaman tidak ditemukan')
  })

  it('rejects a foreign device', async () => {
    const ctx = freshCtx()
    const owner = await seedUser(ctx, 'Owner')
    const attacker = await seedUser(ctx, 'Attacker')
    await seedDeviceWithPlant(ctx, owner, 'GM-OWN')

    await expect(
      callHandler(assistantCreateSchedule, ctx, {
        userId: attacker,
        deviceId: 'GM-OWN',
        title: 'Jadwal jahat',
        cadenceUnit: 'days',
        cadenceValue: 1,
      }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
    expect(ctx.db.all('careSchedules')).toHaveLength(0)
  })

  it('rejects over the 20-per-plant cap', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-CAP')
    for (let i = 0; i < 20; i++) {
      await ctx.db.insert('careSchedules', {
        plantId,
        title: `Jadwal ${i + 1}`,
        enabled: true,
        createdAt: now,
      })
    }

    await expect(
      callHandler(assistantCreateSchedule, ctx, {
        userId,
        deviceId: 'GM-CAP',
        title: 'Satu lagi',
        cadenceUnit: 'days',
        cadenceValue: 1,
      }),
    ).rejects.toThrow('Batas jadwal perawatan tercapai')
    expect(ctx.db.all('careSchedules')).toHaveLength(20)
  })

  it('clamps non-positive cadence values to 1 instead of throwing', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    await seedDeviceWithPlant(ctx, userId, 'GM-CAD')

    const daily = await callHandler(assistantCreateSchedule, ctx, {
      userId,
      deviceId: 'GM-CAD',
      title: 'Harian',
      cadenceUnit: 'days',
      cadenceValue: 0,
    })
    expect(daily.success).toBe(true)
    expect(daily.cadenceLabel).toBe('Setiap hari pukul 08:00')
    expect((await ctx.db.get(daily.scheduleId))!.cadenceValue).toBe(1)

    const hourly = await callHandler(assistantCreateSchedule, ctx, {
      userId,
      deviceId: 'GM-CAD',
      title: 'Per jam',
      cadenceUnit: 'hours',
      cadenceValue: -3,
    })
    expect(hourly.cadenceLabel).toBe('Setiap jam')
    expect((await ctx.db.get(hourly.scheduleId))!.cadenceValue).toBe(1)
  })
})

describe('assistantTrigger*: foreign-device denial', () => {
  it('rejects watering/lighting on a foreign device and queues nothing', async () => {
    const ctx = freshCtx()
    const owner = await seedUser(ctx, 'Owner')
    const attacker = await seedUser(ctx, 'Attacker')
    const { deviceDocId } = await seedDeviceWithPlant(ctx, owner, 'GM-OWN')

    await expect(
      callHandler(assistantTriggerWatering, ctx, { userId: attacker, deviceId: 'GM-OWN' }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
    await expect(
      callHandler(assistantTriggerLighting, ctx, {
        userId: attacker,
        deviceId: 'GM-OWN',
        enabled: true,
      }),
    ).rejects.toThrow('Perangkat tidak ditemukan')

    expect((await ctx.db.get(deviceDocId))!.queuedCommands).toBeUndefined()
    expect(ctx.db.all('notifications')).toHaveLength(0)
  })

  it('rejects fertilizing/pesticide on a foreign v2 device', async () => {
    const ctx = freshCtx()
    const owner = await seedUser(ctx, 'Owner')
    const attacker = await seedUser(ctx, 'Attacker')
    await seedDeviceWithPlant(ctx, owner, 'GM-V2', { version: 'v2' })

    await expect(
      callHandler(assistantTriggerFertilizing, ctx, { userId: attacker, deviceId: 'GM-V2' }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
    await expect(
      callHandler(assistantTriggerPesticide, ctx, { userId: attacker, deviceId: 'GM-V2' }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
  })

  it('rejects fertilizing/pesticide on v1 devices even for the owner', async () => {
    const ctx = freshCtx()
    const owner = await seedUser(ctx, 'Owner')
    await seedDeviceWithPlant(ctx, owner, 'GM-V1', { version: 'v1' })

    await expect(
      callHandler(assistantTriggerFertilizing, ctx, { userId: owner, deviceId: 'GM-V1' }),
    ).rejects.toThrow('Aksi ini hanya tersedia untuk perangkat V2')
    await expect(
      callHandler(assistantTriggerPesticide, ctx, { userId: owner, deviceId: 'GM-V1' }),
    ).rejects.toThrow('Aksi ini hanya tersedia untuk perangkat V2')
  })

  it('owner watering succeeds and queues a pump command', async () => {
    const ctx = freshCtx()
    const owner = await seedUser(ctx, 'Owner')
    const { deviceDocId } = await seedDeviceWithPlant(ctx, owner, 'GM-MINE')

    const res = await callHandler(assistantTriggerWatering, ctx, {
      userId: owner,
      deviceId: 'GM-MINE',
    })
    expect(res.success).toBe(true)
    const device = (await ctx.db.get(deviceDocId))!
    expect(device.queuedCommands.pump).toMatchObject({ kind: 'pump' })
    expect(device.queuedCommands.fertilizer ?? null).toBeNull()
    expect(ctx.db.all('notifications')).toHaveLength(1)
  })
})
