/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { buildAssistantContext } from '../../convex/assistant/context'
import { buildAssistantContext as buildAssistantContextViaAssistant } from '../../convex/assistant'
import { createFakeCtx, type FakeCtx } from './test-ingest-rules-fake'

const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()

async function seedFixture(ctx: FakeCtx) {
  const userId = await ctx.db.insert('users', { name: 'Snapshot', role: 'grower', tier: 'basic' })
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: 'GM-SNAP',
    name: 'Pod GM-SNAP',
    userId,
    version: 'v1',
    autoWatering: true,
    autoLighting: false,
    wateringThreshold: 25,
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
  })
  const plantId = await ctx.db.insert('plants', {
    deviceId: deviceDocId,
    name: 'Cabai',
    species: 'Capsicum annuum',
    archived: false,
    growthStage: 'vegetative_growth',
    location: 'greenhouse',
    wateringThreshold: 45,
    lightingThreshold: 40,
    // Reversed min/max locks the verbatim min/max-swap normalization.
    sensorProfile: { soil: { min: 80, max: 50 } },
    plantedAt: now - 10 * DAY_MS,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(deviceDocId, { plantId })
  await ctx.db.insert('sensors', { plantId, kind: 'soil', value: 40, unit: '%' })
  await ctx.db.insert('sensors', { plantId, kind: 'temperature', value: 25, unit: 'C' })
  await ctx.db.insert('careSchedules', {
    plantId,
    title: 'Siram pagi',
    enabled: true,
    nextRunAt: now + 3_600_000,
    createdAt: now,
  })
  await ctx.db.insert('growEvents', {
    deviceId: deviceDocId,
    plantId,
    source: 'device',
    entityType: 'sensor',
    eventType: 'sensor_recorded',
    title: 'Pembacaan sensor',
    detail: 'Tanah 40%',
    timestamp: now,
  })
  await ctx.db.insert('automationLogs', {
    deviceId: deviceDocId,
    plantId,
    timestamp: now,
    action: 'manual_pump',
    soilValue: 40,
    lightValue: 60,
    threshold: 25,
    duration: 8,
  })

  const user = (await ctx.db.get(userId)) as any
  const device = (await ctx.db.get(deviceDocId)) as any
  const plant = (await ctx.db.get(plantId)) as any
  return { user, device, plant }
}

function prune(context: any) {
  return {
    user: context.user,
    activeDevice: {
      name: context.activeDevice.name,
      deviceId: context.activeDevice.deviceId,
      version: context.activeDevice.version,
      wateringThreshold: context.activeDevice.wateringThreshold,
      wateringDuration: context.activeDevice.wateringDuration,
    },
    activePlant: {
      name: context.activePlant.name,
      species: context.activePlant.species,
      health: context.activePlant.health,
      growthStage: context.activePlant.growthStage,
      wateringThreshold: context.activePlant.wateringThreshold,
      sensorProfile: context.activePlant.sensorProfile,
    },
    sensors: context.sensors,
    schedules: context.schedules.map((s: any) => ({
      title: s.title,
      enabled: s.enabled,
      cadenceUnit: s.cadenceUnit,
      cadenceValue: s.cadenceValue,
      cadenceLabel: s.cadenceLabel,
    })),
    recentEvents: context.recentEvents.map((e: any) => ({ title: e.title, detail: e.detail })),
    automationLogs: context.automationLogs.map((l: any) => ({
      action: l.action,
      soilValue: l.soilValue,
      threshold: l.threshold,
      duration: l.duration,
    })),
    clientTimezoneOffsetMinutes: context.clientTimezoneOffsetMinutes,
  }
}

describe('assistant/context: buildAssistantContext fixture snapshot', () => {
  it('assistant.ts re-exports the same context builder (delegation)', () => {
    expect(buildAssistantContextViaAssistant).toBe(buildAssistantContext)
  })

  it('produces identical output for a fixed fixture (key fields)', async () => {
    const ctx = createFakeCtx()
    const { user, device, plant } = await seedFixture(ctx)

    const context = await buildAssistantContext(ctx as any, user, device, plant, 420)

    // Identity / delegation surface.
    expect(context.user).toEqual({ name: 'Snapshot', tier: 'basic' })
    expect(context.activeDevice).toMatchObject({
      name: 'Pod GM-SNAP',
      deviceId: 'GM-SNAP',
      version: 'v1',
      wateringThreshold: 25,
    })
    // Plant thresholds take precedence over device defaults, both surfaced.
    expect(context.activePlant).toMatchObject({
      name: 'Cabai',
      species: 'Capsicum annuum',
      growthStage: 'Pertumbuhan vegetatif',
      wateringThreshold: 45,
    })
    // Reversed soil range is normalized verbatim (min/max swap, defaults kept).
    expect(context.activePlant.sensorProfile).toMatchObject({
      soil: { min: 50, max: 80 },
      light: { min: 30, max: 80 },
      temperature: { min: 18, max: 28 },
    })
    // Soil 40 is low under the plant profile (min 50), not under defaults.
    const soil = context.sensors.find((s) => s.kind === 'soil')
    expect(soil.status).toBe('low')
    expect(soil.target).toContain('50')
    const temperature = context.sensors.find((s) => s.kind === 'temperature')
    expect(temperature.status).toBe('optimal')
    // One low + one optimal sensor → health 'good'.
    expect(context.activePlant.health).toBe('good')
    // Schedules / events / logs are mapped through.
    expect(context.schedules).toHaveLength(1)
    expect(context.schedules[0].title).toBe('Siram pagi')
    expect(context.recentEvents).toHaveLength(1)
    expect(context.recentEvents[0].title).toBe('Pembacaan sensor')
    expect(context.automationLogs).toHaveLength(1)
    expect(context.automationLogs[0].action).toBe('manual_pump')
    // Client TZ threads through rounded.
    expect(context.clientTimezoneOffsetMinutes).toBe(420)

    expect(prune(context)).toMatchSnapshot()
  })

  it('rounds fractional TZ offsets and omits the key when the client sends none', async () => {
    const ctx = createFakeCtx()
    const { user, device, plant } = await seedFixture(ctx)

    const rounded = await buildAssistantContext(ctx as any, user, device, plant, 420.7)
    expect(rounded.clientTimezoneOffsetMinutes).toBe(421)

    const omitted = await buildAssistantContext(ctx as any, user, device, plant)
    expect('clientTimezoneOffsetMinutes' in omitted).toBe(false)
  })

  it('deactivates plant context for archived plants (device stays, sensors empty)', async () => {
    const ctx = createFakeCtx()
    const { user, device, plant } = await seedFixture(ctx)
    const archived = { ...plant, archived: true }

    const context = await buildAssistantContext(ctx as any, user, device, archived)
    expect(context.activePlant).toBeNull()
    expect(context.sensors).toHaveLength(0)
    expect(context.schedules).toHaveLength(0)
    expect(context.activeDevice).not.toBeNull()
  })
})
