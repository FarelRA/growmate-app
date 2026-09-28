/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { ingestSensorData, clearDeviceCommands } from '../../convex/sensors'
import { assignPlantToDevice } from '../../convex/devices'
import { evaluateFertilizingRule, evaluatePesticideRule } from '../../convex/helpers/v2sensors'
import type { DeviceDoc, PlantDoc } from '../../convex/types'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

function baseDevice(overrides: Record<string, any> = {}): DeviceDoc {
  return {
    deviceId: 'GM-TEST',
    name: 'Test Pod',
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

function sensorState(entries: [string, number][]): Map<string, { value: number; unit: string }> {
  return new Map(entries.map(([kind, value]) => [kind, { value, unit: '%' }]))
}

/** Seed a user + device + active plant; returns ids. Plant thresholds win over device ones. */
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
  ctx.__testUserId = userId
  return { userId, deviceId, plantId }
}

const soilDry = [{ kind: 'soil', value: 20, unit: '%' }]
const soilWet = [{ kind: 'soil', value: 50, unit: '%' }]

describe('evaluateFertilizingRule (v2)', () => {
  const device = baseDevice({ autoFertilizing: true })

  it('triggers below threshold with healthy tank', () => {
    const r = evaluateFertilizingRule(
      device,
      null,
      sensorState([
        ['soil', 20],
        ['water', 80],
      ]),
      now,
    )
    expect(r.shouldFertilize).toBe(true)
    expect(r.cooledDown).toBe(true)
    expect(r.effectiveThreshold).toBe(35)
  })

  it('prefers the active plant threshold over the device threshold', () => {
    const plant = { fertilizingThreshold: 25 } as PlantDoc
    const below = evaluateFertilizingRule(device, plant, sensorState([['soil', 20]]), now)
    expect(below.shouldFertilize).toBe(true)
    const above = evaluateFertilizingRule(device, plant, sensorState([['soil', 28]]), now)
    expect(above.shouldFertilize).toBe(false)
  })

  it('does not trigger when autoFertilizing is off', () => {
    const off = baseDevice({ autoFertilizing: false })
    const r = evaluateFertilizingRule(
      off,
      null,
      sensorState([
        ['soil', 5],
        ['water', 90],
      ]),
      now,
    )
    expect(r.shouldFertilize).toBe(false)
  })

  it('does not trigger at or above threshold', () => {
    const r = evaluateFertilizingRule(
      device,
      null,
      sensorState([
        ['soil', 35],
        ['water', 90],
      ]),
      now,
    )
    expect(r.shouldFertilize).toBe(false)
  })

  it('dry-tank interlock: blocks when tank level is at/below tankMinLevel', () => {
    const dry = evaluateFertilizingRule(
      device,
      null,
      sensorState([
        ['soil', 10],
        ['water', 10],
      ]),
      now,
    )
    expect(dry.shouldFertilize).toBe(false)
    const ok = evaluateFertilizingRule(
      device,
      null,
      sensorState([
        ['soil', 10],
        ['water', 11],
      ]),
      now,
    )
    expect(ok.shouldFertilize).toBe(true)
  })

  it('reports shouldFertilize without cooldown when fertilizing too recently', () => {
    const recent = baseDevice({ autoFertilizing: true, lastFertilized: now - 60_000 })
    const r = evaluateFertilizingRule(
      recent,
      null,
      sensorState([
        ['soil', 10],
        ['water', 80],
      ]),
      now,
    )
    expect(r.shouldFertilize).toBe(true)
    expect(r.cooledDown).toBe(false)
  })

  it('cools down after the fertilizing cooldown elapses', () => {
    const old = baseDevice({ autoFertilizing: true, lastFertilized: now - 432001_000 })
    const r = evaluateFertilizingRule(
      old,
      null,
      sensorState([
        ['soil', 10],
        ['water', 80],
      ]),
      now,
    )
    expect(r.cooledDown).toBe(true)
  })
})

describe('evaluatePesticideRule (v2)', () => {
  const device = baseDevice({ autoPesticide: true, pesticideThreshold: 50 })

  it('triggers when humidity implies pest risk above threshold', () => {
    const r = evaluatePesticideRule(device, null, sensorState([['air', 90]]), now)
    expect(r.pestRisk).toBe(70)
    expect(r.shouldApply).toBe(true)
  })

  it('does not trigger when humidity is normal (risk 0)', () => {
    const r = evaluatePesticideRule(device, null, sensorState([['air', 60]]), now)
    expect(r.pestRisk).toBe(0)
    expect(r.shouldApply).toBe(false)
  })

  it('humidity boundary: 80 is safe, 81 is risky', () => {
    expect(evaluatePesticideRule(device, null, sensorState([['air', 80]]), now).pestRisk).toBe(0)
    expect(evaluatePesticideRule(device, null, sensorState([['air', 81]]), now).pestRisk).toBe(70)
  })

  it('does not trigger when autoPesticide is off', () => {
    const off = baseDevice({ autoPesticide: false })
    const r = evaluatePesticideRule(off, null, sensorState([['air', 95]]), now)
    expect(r.shouldApply).toBe(false)
  })

  it('respects the pesticide cooldown', () => {
    const recent = baseDevice({
      autoPesticide: true,
      pesticideThreshold: 50,
      lastPesticideApplied: now - 1000,
    })
    expect(evaluatePesticideRule(recent, null, sensorState([['air', 95]]), now).shouldApply).toBe(
      false,
    )
  })
})

describe('ingestSensorData watering rule (v1)', () => {
  let ctx: FakeCtx
  beforeEach(() => {
    ctx = createFakeCtx()
  })

  it('queues a pump command when soil is below the plant threshold', async () => {
    await seedDeviceWithPlant(ctx)
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [...soilDry, { kind: 'water', value: 60, unit: '%' }],
    })
    expect(res.success).toBe(true)
    expect(res.updated).toBe(2)
    expect(res.commands).toEqual([{ kind: 'pump', durationMs: 8000 }])
    const automation = ctx.db.all('automationLogs')
    expect(automation.map((l) => l.action)).toEqual(['pump_enabled', 'pump_disabled'])
  })

  it('does nothing when soil is above threshold', async () => {
    await seedDeviceWithPlant(ctx)
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [...soilWet, { kind: 'water', value: 60, unit: '%' }],
    })
    expect(res.commands).toEqual([])
  })

  it('dry-tank interlock: blocks watering when water level <= 5', async () => {
    await seedDeviceWithPlant(ctx)
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [...soilDry, { kind: 'water', value: 3, unit: '%' }],
    })
    expect(res.commands).toEqual([])
    expect(ctx.db.all('automationLogs')).toEqual([])
  })

  it('cooldown: second dry ingest does not re-queue until cooldown elapses', async () => {
    const { deviceId } = await seedDeviceWithPlant(ctx)
    const first = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [...soilDry, { kind: 'water', value: 60, unit: '%' }],
    })
    expect(first.commands).toHaveLength(1)
    const lastWatered = (await ctx.db.get(deviceId))!.lastWatered
    await callHandler(clearDeviceCommands, ctx, { deviceId: 'GM-TEST', commands: ['pump'] })

    const second = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [...soilDry, { kind: 'water', value: 60, unit: '%' }],
    })
    expect(second.commands).toEqual([])
    expect((await ctx.db.get(deviceId))!.lastWatered).toBe(lastWatered)
  })

  it('does not water when autoWatering is off', async () => {
    await seedDeviceWithPlant(ctx, { autoWatering: false })
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [...soilDry, { kind: 'water', value: 60, unit: '%' }],
    })
    expect(res.commands).toEqual([])
  })
})

describe('ingestSensorData lighting rule (v1)', () => {
  let ctx: FakeCtx
  beforeEach(() => {
    ctx = createFakeCtx()
  })

  it('turns the grow light on when ambient light is below threshold', async () => {
    await seedDeviceWithPlant(ctx)
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [{ kind: 'light', value: 10, unit: '%' }],
    })
    expect(res.commands).toEqual([{ kind: 'light', enabled: true }])
    const automation = ctx.db.all('automationLogs')
    expect(automation.map((l) => l.action)).toEqual(['light_on'])
  })

  it('turns the light off only past threshold + hysteresis', async () => {
    await seedDeviceWithPlant(ctx, { lightEnabled: true })
    const off = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [{ kind: 'light', value: 60, unit: '%' }],
    })
    expect(off.commands).toEqual([{ kind: 'light', enabled: false }])
  })

  it('holds state inside the hysteresis band', async () => {
    await seedDeviceWithPlant(ctx, { lightEnabled: true })
    await callHandler(clearDeviceCommands, ctx, { deviceId: 'GM-TEST', commands: ['light'] })
    const hold = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [{ kind: 'light', value: 44, unit: '%' }],
    })
    expect(hold.commands).toEqual([])
  })
})

describe('ingestSensorData v2 rules (fertilizing + pesticide)', () => {
  let ctx: FakeCtx
  beforeEach(() => {
    ctx = createFakeCtx()
  })

  it('schedules fertilizing when soil is dry and tank is healthy', async () => {
    // Soil 32 sits below the fertilizing threshold (35) but above the plant
    // watering threshold (30), so only the fertilizing rule fires.
    await seedDeviceWithPlant(ctx, { version: 'v2', autoFertilizing: true })
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [
        { kind: 'soil', value: 32, unit: '%' },
        { kind: 'water', value: 80, unit: '%' },
      ],
    })
    expect(res.success).toBe(true)
    const automation = ctx.db.all('automationLogs')
    expect(automation.map((l) => l.action)).toContain('fertilizer_opened')
    // Both valve + pump commands reach the device (staged accumulator —
    // previously the pump staging wiped the fertilizer entry).
    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['fertilizer', 'pump'])
    expect(res.commands.find((c: any) => c.kind === 'pump')).toEqual({
      kind: 'pump',
      durationMs: 10000,
    })
    expect(res.commands.find((c: any) => c.kind === 'fertilizer')).toEqual({
      kind: 'fertilizer',
      durationMs: 10000,
    })
  })

  it('v2 dry-tank interlock blocks fertilizing too', async () => {
    await seedDeviceWithPlant(ctx, { version: 'v2', autoFertilizing: true })
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [...soilDry, { kind: 'water', value: 4, unit: '%' }],
    })
    expect(res.commands).toEqual([])
  })

  it('schedules pesticide on high humidity pest risk', async () => {
    await seedDeviceWithPlant(ctx, { version: 'v2', autoPesticide: true })
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [{ kind: 'air', value: 90, unit: '%' }],
    })
    const automation = ctx.db.all('automationLogs')
    expect(automation.map((l) => l.action)).toContain('pesticide_opened')
    // Both valve + pump commands reach the device (staged accumulator).
    const kinds = res.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['pesticide', 'pump'])
  })

  it('no pesticide on normal humidity', async () => {
    await seedDeviceWithPlant(ctx, { version: 'v2', autoPesticide: true })
    const res = await callHandler(ingestSensorData, ctx, {
      deviceId: 'GM-TEST',
      sensors: [{ kind: 'air', value: 60, unit: '%' }],
    })
    expect(res.commands).toEqual([])
  })
})

describe('assignPlantToDevice', () => {
  let ctx: FakeCtx
  let userId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    userId = await ctx.db.insert('users', {
      name: 'Grower',
      role: 'user',
      points: 0,
      setupComplete: false,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('devices', {
      ...baseDevice(),
      deviceId: 'GM-OWNED',
      userId,
    })
    ctx.__testUserId = userId
  })

  it('assigns a plant, links the device, and records activity', async () => {
    const res = await callHandler(assignPlantToDevice, ctx, {
      deviceId: 'GM-OWNED',
      plantName: 'Tomat',
      plantSpecies: 'Solanum lycopersicum',
    })
    expect(res.success).toBe(true)
    const plant = await ctx.db.get(res.plantId)
    expect(plant!.name).toBe('Tomat')
    expect(plant!.archived).toBe(false)
    const device = (await ctx.db.query('devices').collect()).find((d) => d.deviceId === 'GM-OWNED')!
    expect(String(device.plantId)).toBe(String(res.plantId))
    expect((await ctx.db.get(userId))!.setupComplete).toBe(true)
    const activities = ctx.db.all('userActivities')
    expect(activities).toHaveLength(1)
    expect(activities[0]!.activityType).toBe('plant_added')
  })

  it('archives the previous plant when replacing', async () => {
    const first = await callHandler(assignPlantToDevice, ctx, {
      deviceId: 'GM-OWNED',
      plantName: 'Cabai',
      plantSpecies: 'Capsicum',
    })
    await callHandler(assignPlantToDevice, ctx, {
      deviceId: 'GM-OWNED',
      plantName: 'Tomat',
      plantSpecies: 'Solanum',
    })
    expect((await ctx.db.get(first.plantId))!.archived).toBe(true)
    const plants = ctx.db.all('plants')
    expect(plants.filter((p) => !p.archived)).toHaveLength(1)
  })

  it('rejects unauthenticated callers', async () => {
    ctx.__testUserId = null
    await expect(
      callHandler(assignPlantToDevice, ctx, {
        deviceId: 'GM-OWNED',
        plantName: 'Tomat',
        plantSpecies: 'Solanum',
      }),
    ).rejects.toThrow('Autentikasi diperlukan')
  })

  it('rejects devices owned by someone else', async () => {
    const other = await ctx.db.insert('users', { name: 'Other', role: 'user' })
    ctx.__testUserId = other
    await expect(
      callHandler(assignPlantToDevice, ctx, {
        deviceId: 'GM-OWNED',
        plantName: 'Tomat',
        plantSpecies: 'Solanum',
      }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
  })
})
