/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest'

import { ingestAndAckSensorData } from '../../convex/sensors'
import type { DeviceDoc } from '../../convex/types'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()
const TEST_DEVICE_KEY = 'test-device-key'

beforeEach(() => {
  process.env.DEVICE_API_KEY = TEST_DEVICE_KEY
})

function baseDevice(overrides: Record<string, any> = {}): DeviceDoc {
  return {
    deviceId: 'GM-MERGE',
    name: 'Merge Pod',
    version: 'v1',
    autoWatering: true,
    autoLighting: true,
    wateringThreshold: 35,
    wateringDuration: 8,
    wateringCooldown: 21600,
    lightingThreshold: 40,
    lightingHysteresis: 8,
    autoFertilizing: false,
    autoPesticide: false,
    fertilizingThreshold: 35,
    fertilizingDuration: 10,
    fertilizingCooldown: 432000,
    pesticideThreshold: 50,
    pesticideDuration: 10,
    pesticideCooldown: 604800,
    lightEnabled: false,
    queuedCommands: { pump: null, light: null, fertilizer: null, pesticide: null },
    tankCapacity: 10,
    tankMinLevel: 10,
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as DeviceDoc
}

async function seedDeviceWithPlant(ctx: FakeCtx, deviceOverrides: Record<string, any> = {}) {
  const userId = await ctx.db.insert('users', {
    name: 'Grower',
    role: 'user',
    points: 0,
    setupComplete: false,
    createdAt: now,
    updatedAt: now,
  })
  const deviceId = await ctx.db.insert('devices', {
    ...baseDevice(),
    ...deviceOverrides,
    userId,
  })
  const plantId = await ctx.db.insert('plants', {
    deviceId,
    name: 'Cabai',
    species: 'Capsicum annuum',
    growthStage: 'vegetative_growth',
    wateringThreshold: 30,
    lightingThreshold: 40,
    archived: false,
    plantedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(deviceId, { plantId })
  return { userId, deviceId, plantId }
}

const drySoilWithWater = [
  { kind: 'soil', value: 20, unit: '%' },
  { kind: 'water', value: 60, unit: '%' },
]

/**
 * Simulate a concurrent manual trigger landing between performIngest's
 * initial snapshot and one of its fresh re-reads.
 *
 * `targetExplicitGet`: 1 = merge re-read (before the final patch),
 * 2 = post-patch refresh re-read (before the response commands are built).
 *
 * NOTE: FakeDb.patch performs an internal db.get, so the counter only
 * tracks explicit reads (a reentrancy flag skips patch-internal gets).
 *
 * NOTE: injected commands carry an `id`, like every real manual trigger
 * (buildQueuedLightAction assigns one via newCommandId()). The device
 * response only delivers queued entries that have an id.
 */
function injectConcurrentCommand(
  ctx: FakeCtx,
  deviceDocId: string,
  targetExplicitGet: number,
  command: { key: 'pump' | 'light' | 'fertilizer' | 'pesticide'; value: unknown },
) {
  const originalGet = ctx.db.get.bind(ctx.db)
  const originalPatch = ctx.db.patch.bind(ctx.db)
  let explicitGets = 0
  let inPatch = false
  ctx.db.patch = (async (id: string, value: Record<string, unknown>) => {
    inPatch = true
    try {
      return await originalPatch(id, value)
    } finally {
      inPatch = false
    }
  }) as any
  ctx.db.get = (async (id: string) => {
    const doc = await originalGet(id)
    if (!inPatch && String(id) === String(deviceDocId)) {
      explicitGets += 1
      if (explicitGets === targetExplicitGet && doc) {
        doc.queuedCommands = {
          ...(doc.queuedCommands ?? { pump: null, light: null, fertilizer: null, pesticide: null }),
          [command.key]: command.value,
        }
      }
    }
    return doc
  }) as any
}

describe('queuedCommands field-wise merge (performIngest)', () => {
  it('concurrent queue+ack preserves both commands (staged pump + stored light)', async () => {
    const ctx = createFakeCtx()
    const { deviceId } = await seedDeviceWithPlant(ctx)

    // Manual light trigger lands AFTER performIngest's initial snapshot but
    // BEFORE its final patch (injected at the merge re-read).
    injectConcurrentCommand(ctx, deviceId, 1, {
      key: 'light',
      value: { kind: 'light', enabled: true, id: 'cmd-manual-light-1' },
    })

    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: drySoilWithWater,
    })

    // Staged pump (dry soil) + concurrent stored light must both survive the
    // merge. Wholesale overwrite would have wiped the light entry from storage.
    // (Pods XOR pacing: pump + light queued → this response carries pump
    // ONLY; the light stays queued for the next response.)
    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['pump'])
    expect(res.commands[0]).toEqual(
      expect.objectContaining({ kind: 'pump', durationMs: 8000, id: expect.any(String) }),
    )
    const pumpId = (res.commands[0] as any).id as string
    const devices = ctx.db.all('devices')
    const stored = devices.find((d) => String(d._id) === String(deviceId)) as any
    expect(stored.queuedCommands.pump).toEqual(
      expect.objectContaining({ kind: 'pump', durationMs: 8000, id: pumpId }),
    )
    expect(stored.queuedCommands.light).toEqual({
      kind: 'light',
      enabled: true,
      id: 'cmd-manual-light-1',
    })

    // The preserved light is deliverable: ack the pump and it comes back next.
    const next = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      acceptedCommandIds: [pumpId],
      sensors: drySoilWithWater,
    })
    expect(next.commands).toEqual([
      expect.objectContaining({ kind: 'light', enabled: true, id: 'cmd-manual-light-1' }),
    ])
  })

  it('no auto-clear on send: both pump and light remain queued after ingest', async () => {
    const ctx = createFakeCtx()
    const { deviceId } = await seedDeviceWithPlant(ctx)

    // First ingest queues a pump for the dry soil (returned, but NOT cleared).
    const first = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: drySoilWithWater,
    })
    const pumpId = (first.commands.find((c: any) => c.kind === 'pump') as any).id as string
    expect(typeof pumpId).toBe('string')

    // A concurrent manual light trigger lands between the two ingests.
    const stored = (await ctx.db.get(deviceId)) as any
    await ctx.db.patch(deviceId, {
      queuedCommands: {
        ...stored.queuedCommands,
        light: { kind: 'light', enabled: true, id: 'cmd-manual-light-2' },
      },
    })

    // Second ingest redelivers the still-queued pump (cooldown blocks a
    // re-queue, so the id is unchanged) and both entries remain in storage.
    const second = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: drySoilWithWater,
    })
    expect(second.commands).toContainEqual(
      expect.objectContaining({ kind: 'pump', durationMs: 8000, id: pumpId }),
    )
    const afterSecond = (await ctx.db.get(deviceId)) as any
    expect(afterSecond.queuedCommands.pump).toEqual(
      expect.objectContaining({ kind: 'pump', durationMs: 8000, id: pumpId }),
    )
    expect(afterSecond.queuedCommands.light).toEqual({
      kind: 'light',
      enabled: true,
      id: 'cmd-manual-light-2',
    })

    // Acking the pump via acceptedCommandIds clears only the pump; the
    // light stays queued for the next response.
    const third = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      acceptedCommandIds: [pumpId],
      sensors: drySoilWithWater,
    })
    expect(third.commands).toEqual([
      expect.objectContaining({ kind: 'light', enabled: true, id: 'cmd-manual-light-2' }),
    ])
    const afterThird = (await ctx.db.get(deviceId)) as any
    expect(afterThird.queuedCommands.pump).toBeNull()
    expect(afterThird.queuedCommands.light).toEqual({
      kind: 'light',
      enabled: true,
      id: 'cmd-manual-light-2',
    })
  })

  it('ingest merges staged + stored; pods pacing returns pump first, both remain queued', async () => {
    const ctx = createFakeCtx()
    const { deviceId } = await seedDeviceWithPlant(ctx)

    injectConcurrentCommand(ctx, deviceId, 1, {
      key: 'light',
      value: { kind: 'light', enabled: true, id: 'cmd-manual-light-3' },
    })

    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: drySoilWithWater,
    })

    // Pods XOR pacing: pump + light queued → pump only in this response.
    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['pump'])
    // Nothing is auto-cleared on send: both entries remain queued in storage
    // until the device echoes their ids in acceptedCommandIds.
    const devices = ctx.db.all('devices')
    const stored = devices.find((d) => String(d._id) === String(deviceId)) as any
    expect(stored.queuedCommands.pump).toEqual(
      expect.objectContaining({ kind: 'pump', durationMs: 8000, id: expect.any(String) }),
    )
    expect(stored.queuedCommands.light).toEqual({
      kind: 'light',
      enabled: true,
      id: 'cmd-manual-light-3',
    })
  })
})

describe('empty sensor array ingest', () => {
  it('ingest with sensors:[] succeeds and returns whatever automation queued', async () => {
    const ctx = createFakeCtx()
    await seedDeviceWithPlant(ctx)
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: [],
    })
    // No readings → no rule fires → no commands, but the call resolves.
    expect(res.commands).toEqual([])
    expect(ctx.db.all('sensors')).toHaveLength(0)
  })
})
