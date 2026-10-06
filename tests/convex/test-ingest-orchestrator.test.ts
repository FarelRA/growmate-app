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
    deviceId: 'GM-ORCH',
    name: 'Orchestrator Pod',
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

describe('ingest orchestrator: rule application order', () => {
  it('v2 applies watering -> fertilizing -> pesticide in order', async () => {
    const ctx = createFakeCtx()
    await seedDeviceWithPlant(ctx, { version: 'v2', autoFertilizing: true, autoPesticide: true })
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-ORCH',
      sensors: [
        { kind: 'soil', value: 20, unit: '%' },
        { kind: 'water', value: 80, unit: '%' },
        { kind: 'air', value: 90, unit: '%' },
      ],
    })
    expect(res.success).toBe(true)
    // All three rules fire; pump is shared (last writer sets its duration).
    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['fertilizer', 'pesticide', 'pump'])
    const automation = ctx.db.all('automationLogs')
    expect(automation.map((l) => l.action)).toEqual([
      'pump_enabled',
      'pump_disabled',
      'fertilizer_opened',
      'fertilizer_closed',
      'pesticide_opened',
      'pesticide_closed',
    ])
  })

  it('v1 applies watering -> lighting in order', async () => {
    const ctx = createFakeCtx()
    await seedDeviceWithPlant(ctx)
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-ORCH',
      sensors: [
        { kind: 'soil', value: 20, unit: '%' },
        { kind: 'water', value: 60, unit: '%' },
        { kind: 'light', value: 10, unit: '%' },
      ],
    })
    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['light', 'pump'])
    const automation = ctx.db.all('automationLogs')
    expect(automation.map((l) => l.action)).toEqual(['pump_enabled', 'pump_disabled', 'light_on'])
  })
})

describe('ingest orchestrator: ack-after-list', () => {
  it('returned commands are ack-cleared from storage after listing', async () => {
    const ctx = createFakeCtx()
    const { deviceId } = await seedDeviceWithPlant(ctx)
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-ORCH',
      sensors: [
        { kind: 'soil', value: 20, unit: '%' },
        { kind: 'water', value: 60, unit: '%' },
      ],
    })
    // Command list is built before the ack-clear, so the caller sees it…
    expect(res.commands).toEqual([{ kind: 'pump', durationMs: 8000 }])
    // …while storage no longer holds the returned key afterwards.
    const stored = (await ctx.db.get(deviceId)) as any
    expect(stored.queuedCommands.pump).toBeNull()
  })
})
