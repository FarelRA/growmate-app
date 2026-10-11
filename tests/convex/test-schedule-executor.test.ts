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
  executeDueSchedules,
  inferScheduleAction,
  SCHEDULE_EXECUTOR_BATCH_CAP,
} from '../../convex/care'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const NOW = 1_700_000_000_000
const HOUR_MS = 60 * 60 * 1000

/**
 * Same query-upgrade pattern as test-assistant-extended.test.ts, but with
 * `lte` support for the executor's `.withIndex('by_nextRunAt', q =>
 * q.lte('nextRunAt', …))` query (the shared fake only implements `eq`).
 */
function withScheduleSupport(ctx: FakeCtx): FakeCtx {
  const apply = (
    docs: any[],
    eq: { field: string; value: unknown }[],
    lte: { field: string; value: any }[],
  ) =>
    docs.filter(
      (d) => eq.every((f) => d[f.field] === f.value) && lte.every((f) => d[f.field] <= f.value),
    )
  const makeRunner = (
    docs: () => any[],
    eq: { field: string; value: unknown }[],
    lte: { field: string; value: any }[],
    desc: boolean,
  ) => {
    const run = () => {
      const out = apply(docs(), eq, lte)
      out.sort((a, b) => (desc ? b._seq - a._seq : a._seq - b._seq))
      return out
    }
    return {
      order: (dir: 'asc' | 'desc') => makeRunner(docs, eq, lte, dir === 'desc'),
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
      const lte: { field: string; value: any }[] = []
      const q: any = {
        eq: (field: string, value: unknown) => {
          eq.push({ field, value })
          return q
        },
        lte: (field: string, value: any) => {
          lte.push({ field, value })
          return q
        },
      }
      fn(q)
      return makeRunner(() => ctx.db.all(table), eq, lte, false)
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
  return withScheduleSupport(createFakeCtx())
}

async function seedUser(ctx: FakeCtx, name: string): Promise<string> {
  return await ctx.db.insert('users', { name, role: 'grower' })
}

async function seedDeviceWithPlant(
  ctx: FakeCtx,
  ownerId: string,
  externalId: string,
): Promise<{ deviceDocId: string; plantId: string }> {
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: externalId,
    name: `Pod ${externalId}`,
    userId: ownerId,
    version: 'v1',
    createdAt: NOW,
    updatedAt: NOW,
  })
  const plantId = await ctx.db.insert('plants', {
    deviceId: deviceDocId,
    name: 'Cabai',
    archived: false,
    plantedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  })
  await ctx.db.patch(deviceDocId, { plantId })
  return { deviceDocId, plantId }
}

async function seedSchedule(
  ctx: FakeCtx,
  plantId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  return await ctx.db.insert('careSchedules', {
    plantId,
    title: 'Penyiraman Otomatis',
    cadenceUnit: 'hours',
    cadenceValue: 1,
    nextRunAt: NOW - 1000,
    enabled: true,
    createdAt: NOW,
    ...overrides,
  })
}

describe('inferScheduleAction', () => {
  it('defaults free-text titles to watering', () => {
    expect(inferScheduleAction('Penyiraman Otomatis')).toEqual({ kind: 'watering' })
    expect(inferScheduleAction('Siram pagi')).toEqual({ kind: 'watering' })
  })

  it('routes lighting titles to the light queue (on by default)', () => {
    expect(inferScheduleAction('Nyalakan lampu tumbuh')).toEqual({ kind: 'lighting', enabled: true })
    expect(inferScheduleAction('Pencahayaan tambahan')).toEqual({ kind: 'lighting', enabled: true })
  })

  it('routes light-off titles to light disabled', () => {
    expect(inferScheduleAction('Matikan lampu malam')).toEqual({ kind: 'lighting', enabled: false })
  })
})

describe('executeDueSchedules', () => {
  it('fires a due watering schedule: queues pump, sets lastRunAt, advances nextRunAt', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { deviceDocId, plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-DUE')
    const scheduleId = await seedSchedule(ctx, plantId)

    const result = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(result).toMatchObject({ checked: 1, fired: 1, skipped: 0 })

    const device = (await ctx.db.get(deviceDocId)) as any
    expect(device.queuedCommands?.pump).not.toBeNull()
    expect(device.queuedCommands?.pump?.durationMs).toBeGreaterThan(0)

    const schedule = (await ctx.db.get(scheduleId)) as any
    expect(schedule.lastRunAt).toBe(NOW)
    expect(schedule.nextRunAt).toBe(NOW + HOUR_MS)
  })

  it('fires a due lighting schedule into the light queue, not the pump queue', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { deviceDocId, plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-LIGHT')
    await seedSchedule(ctx, plantId, { title: 'Nyalakan lampu tumbuh' })

    const result = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(result).toMatchObject({ checked: 1, fired: 1 })

    const device = (await ctx.db.get(deviceDocId)) as any
    expect(device.queuedCommands?.light).toEqual(
      expect.objectContaining({ kind: 'light', enabled: true }),
    )
    expect(device.queuedCommands?.light?.id).toEqual(expect.any(String))
    expect(device.queuedCommands?.pump).toBeNull()
  })

  it('leaves future schedules untouched', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { deviceDocId, plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-FUT')
    const scheduleId = await seedSchedule(ctx, plantId, { nextRunAt: NOW + HOUR_MS })

    const result = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(result).toMatchObject({ checked: 0, fired: 0, skipped: 0 })

    const device = (await ctx.db.get(deviceDocId)) as any
    expect(device.queuedCommands ?? { pump: null }).toMatchObject({ pump: null })
    const schedule = (await ctx.db.get(scheduleId)) as any
    expect(schedule.nextRunAt).toBe(NOW + HOUR_MS)
    expect(schedule.lastRunAt).toBeUndefined()
  })

  it('skips disabled schedules without touching nextRunAt', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { deviceDocId, plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-OFF')
    const scheduleId = await seedSchedule(ctx, plantId, { enabled: false, nextRunAt: NOW - 1000 })

    const result = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(result).toMatchObject({ checked: 1, fired: 0, skipped: 1 })

    const device = (await ctx.db.get(deviceDocId)) as any
    expect(device.queuedCommands ?? { pump: null }).toMatchObject({ pump: null })
    const schedule = (await ctx.db.get(scheduleId)) as any
    expect(schedule.nextRunAt).toBe(NOW - 1000)
    expect(schedule.lastRunAt).toBeUndefined()
  })

  it('skips (does not throw) when the plant is missing', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    await seedDeviceWithPlant(ctx, userId, 'GM-ORPH')
    await seedSchedule(ctx, 'careSchedules|missing-plant' as any)

    const result = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(result).toMatchObject({ checked: 1, fired: 0, skipped: 1 })
    expect(result.errors).toEqual([])
  })

  it('skips (does not throw) when the device is missing', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { deviceDocId, plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-NODEV')
    await ctx.db.delete(deviceDocId)
    await seedSchedule(ctx, plantId)

    const result = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(result).toMatchObject({ checked: 1, fired: 0, skipped: 1 })
    expect(result.errors).toEqual([])
  })

  it('does not double-fire on a repeat run at the same timestamp (idempotent)', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-IDEM')
    await seedSchedule(ctx, plantId)

    const first = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(first).toMatchObject({ fired: 1 })
    const second = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(second).toMatchObject({ checked: 0, fired: 0 })
  })

  it('respects the per-run cap via the limit arg and defaults to 100', async () => {
    expect(SCHEDULE_EXECUTOR_BATCH_CAP).toBe(100)
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'A')
    const { plantId } = await seedDeviceWithPlant(ctx, userId, 'GM-CAP')
    await seedSchedule(ctx, plantId, { title: 'Jadwal 1' })
    await seedSchedule(ctx, plantId, { title: 'Jadwal 2' })
    await seedSchedule(ctx, plantId, { title: 'Jadwal 3' })

    const capped = await callHandler(executeDueSchedules, ctx, { now: NOW, limit: 2 })
    expect(capped).toMatchObject({ checked: 2, fired: 2 })

    const rest = await callHandler(executeDueSchedules, ctx, { now: NOW })
    expect(rest).toMatchObject({ checked: 1, fired: 1 })
  })
})
