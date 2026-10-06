/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest'

import { ingestAndAckSensorData } from '../../convex/sensors'
import { validateSensors } from '../../server/utils/ingestHandler'
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
 * 2 = ack re-read (after commands are built, before the ack-clear patch).
 *
 * NOTE: FakeDb.patch performs an internal db.get, so the counter only
 * tracks explicit reads (a reentrancy flag skips patch-internal gets).
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
      value: { kind: 'light', enabled: true },
    })

    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: drySoilWithWater,
    })

    // Staged pump (dry soil) + concurrent stored light must both be returned.
    // Wholesale overwrite would have wiped the light entry → only pump.
    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['light', 'pump'])
  })

  it('ack clears only returned keys (delayed ack after new queue preserves light)', async () => {
    const ctx = createFakeCtx()
    const { deviceId } = await seedDeviceWithPlant(ctx)

    // Manual light trigger lands AFTER commands are built but BEFORE the
    // ack-clear patch (injected at the ack re-read). Ingest itself only
    // queues pump.
    injectConcurrentCommand(ctx, deviceId, 2, {
      key: 'light',
      value: { kind: 'light', enabled: true },
    })

    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: drySoilWithWater,
    })

    // Only pump was returned (light arrived after commands were built).
    expect(res.commands).toEqual([{ kind: 'pump', durationMs: 8000 }])

    // Ack must clear pump but preserve the concurrently queued light.
    // Wholesale ack-clear would wipe both → light null.
    const devices = ctx.db.all('devices')
    const finalDevice = devices.find((d) => String(d._id) === String(deviceId)) as any
    expect(finalDevice.queuedCommands.pump).toBeNull()
    expect(finalDevice.queuedCommands.light).toEqual({ kind: 'light', enabled: true })
  })

  it('ingest + ack merges staged + stored, returns both, and acks only returned keys', async () => {
    const ctx = createFakeCtx()
    const { deviceId } = await seedDeviceWithPlant(ctx)

    injectConcurrentCommand(ctx, deviceId, 1, {
      key: 'light',
      value: { kind: 'light', enabled: true },
    })

    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-MERGE',
      sensors: drySoilWithWater,
    })

    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['light', 'pump'])
    const devices = ctx.db.all('devices')
    const stored = devices.find((d) => String(d._id) === String(deviceId)) as any
    // Both were returned, so ack clears both.
    expect(stored.queuedCommands.pump).toBeNull()
    expect(stored.queuedCommands.light).toBeNull()
  })
})

describe('empty ingest rejected', () => {
  it('validateSensors rejects an empty array with 400 (v1 + v2)', () => {
    expect(() => validateSensors([], 'v1')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
    expect(() => validateSensors([], 'v2')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
  })
})
