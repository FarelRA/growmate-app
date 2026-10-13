/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  executeManualWatering,
  executeManualFertilizing,
  executeManualPesticide,
  buildDeviceSummary,
} from '../../convex/helpers/devices'
import {
  toggleScheduleCore,
  deleteScheduleCore,
  requirePlantDevice,
} from '../../convex/care'
import { createFakeCtx, type FakeCtx } from './test-ingest-rules-fake'

const NOW = 1_700_000_000_000

async function seedUser(ctx: FakeCtx, name: string): Promise<string> {
  return await ctx.db.insert('users', { name, role: 'grower' })
}

async function seedDeviceWithPlant(
  ctx: FakeCtx,
  ownerId: string,
  externalId: string,
  overrides: Record<string, any> = {},
): Promise<{ deviceDocId: string; plantId: string }> {
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: externalId,
    name: `Pod ${externalId}`,
    userId: ownerId,
    version: 'v2',
    wateringDuration: 8,
    fertilizingDuration: 12,
    pesticideDuration: 12,
    queuedCommands: { pump: null, light: null, fertilizer: null, pesticide: null },
    createdAt: NOW,
    updatedAt: NOW,
    lastSeen: NOW,
    ...overrides,
  })
  const plantId = await ctx.db.insert('plants', {
    deviceId: deviceDocId,
    name: 'Cabai',
    species: 'Capsicum annuum',
    growthStage: 'vegetative_growth',
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
  title = 'Penyiraman Otomatis',
): Promise<string> {
  return await ctx.db.insert('careSchedules', {
    plantId,
    title,
    cadenceUnit: 'days',
    cadenceValue: 1,
    nextRunAt: NOW + 86_400_000,
    enabled: true,
    createdAt: NOW,
  })
}

describe('manual dose wrappers parity (single executeManualDose core)', () => {
  it('fert/pest queue mirrored dose+pump entries with identical durations', async () => {
    const ctx = createFakeCtx()
    const owner = await seedUser(ctx, 'Owner')
    const fert = await seedDeviceWithPlant(ctx, owner, 'GM-FERT')
    const pest = await seedDeviceWithPlant(ctx, owner, 'GM-PEST')

    await executeManualFertilizing(
      ctx as any,
      { _id: owner } as any,
      (await ctx.db.get(fert.deviceDocId)) as any,
    )
    await executeManualPesticide(
      ctx as any,
      { _id: owner } as any,
      (await ctx.db.get(pest.deviceDocId)) as any,
    )

    const fertDevice = (await ctx.db.get(fert.deviceDocId)) as any
    const pestDevice = (await ctx.db.get(pest.deviceDocId)) as any

    expect(fertDevice.queuedCommands.fertilizer).toEqual(
      expect.objectContaining({
        kind: 'fertilizer',
        durationMs: 12_000,
      }),
    )
    expect(fertDevice.queuedCommands.fertilizer.id).toEqual(expect.any(String))
    expect(fertDevice.queuedCommands.pump).toEqual(
      expect.objectContaining({ kind: 'pump', durationMs: 12_000 }),
    )
    expect(fertDevice.queuedCommands.pump.id).toEqual(expect.any(String))
    expect(fertDevice.queuedCommands.pesticide ?? null).toBeNull()

    expect(pestDevice.queuedCommands.pesticide).toEqual(
      expect.objectContaining({
        kind: 'pesticide',
        durationMs: 12_000,
      }),
    )
    expect(pestDevice.queuedCommands.pesticide.id).toEqual(expect.any(String))
    expect(pestDevice.queuedCommands.pump).toEqual(
      expect.objectContaining({ kind: 'pump', durationMs: 12_000 }),
    )
    expect(pestDevice.queuedCommands.pump.id).toEqual(expect.any(String))
    expect(pestDevice.queuedCommands.fertilizer ?? null).toBeNull()

    // Identical shape modulo the dose key name.
    expect({ dose: fertDevice.queuedCommands.fertilizer, pump: fertDevice.queuedCommands.pump }).toEqual({
      dose: expect.objectContaining({ kind: 'fertilizer', durationMs: 12_000 }),
      pump: expect.objectContaining({ kind: 'pump', durationMs: 12_000 }),
    })
    expect({ dose: pestDevice.queuedCommands.pesticide, pump: pestDevice.queuedCommands.pump }).toEqual({
      dose: expect.objectContaining({ kind: 'pesticide', durationMs: 12_000 }),
      pump: expect.objectContaining({ kind: 'pump', durationMs: 12_000 }),
    })
  })

  it('fert/pest record mirrored automation + grow events (only labels differ)', async () => {
    const ctx = createFakeCtx()
    const owner = await seedUser(ctx, 'Owner')
    const fert = await seedDeviceWithPlant(ctx, owner, 'GM-FERT')
    const pest = await seedDeviceWithPlant(ctx, owner, 'GM-PEST')

    await executeManualFertilizing(
      ctx as any,
      { _id: owner } as any,
      (await ctx.db.get(fert.deviceDocId)) as any,
    )
    await executeManualPesticide(
      ctx as any,
      { _id: owner } as any,
      (await ctx.db.get(pest.deviceDocId)) as any,
    )

    const logs = ctx.db.all('automationLogs')
    expect(
      logs.filter((l) => l.deviceId === fert.deviceDocId).map((l) => [l.action, l.duration]),
    ).toEqual([['manual_fertilizer', 12]])
    expect(
      logs.filter((l) => l.deviceId === pest.deviceDocId).map((l) => [l.action, l.duration]),
    ).toEqual([['manual_pesticide', 12]])

    const events = ctx.db.all('growEvents')
    const fertEvent = events.find((e) => e.deviceId === fert.deviceDocId)
    const pestEvent = events.find((e) => e.deviceId === pest.deviceDocId)
    expect(fertEvent?.eventType).toBe('manual_fertilizing_triggered')
    expect(fertEvent?.title).toBe('Pemupukan manual dipicu')
    expect(pestEvent?.eventType).toBe('manual_pesticide_triggered')
    expect(pestEvent?.title).toBe('Pestisida manual dipicu')
  })
})

describe('manual watering queues pump ONLY (no bundled fertilizer)', () => {
  it.each(['v2', 'v1'] as const)('queues pump only on %s devices', async (version) => {
    const ctx = createFakeCtx()
    const owner = await seedUser(ctx, 'Owner')
    const { deviceDocId } = await seedDeviceWithPlant(ctx, owner, `GM-WATER-${version}`, {
      version,
    })

    await executeManualWatering(
      ctx as any,
      { _id: owner } as any,
      (await ctx.db.get(deviceDocId)) as any,
    )

    const device = (await ctx.db.get(deviceDocId)) as any
    expect(device.queuedCommands.pump).toMatchObject({ kind: 'pump' })
    expect(device.queuedCommands.fertilizer ?? null).toBeNull()
    expect(device.queuedCommands.pesticide ?? null).toBeNull()
  })

  it('clamps a corrupt 3600s duration to the 30s firmware ceiling', async () => {
    const ctx = createFakeCtx()
    const owner = await seedUser(ctx, 'Owner')
    const { deviceDocId } = await seedDeviceWithPlant(ctx, owner, 'GM-WATER-HUGE', {
      wateringDuration: 3600,
    })

    await executeManualWatering(
      ctx as any,
      { _id: owner } as any,
      (await ctx.db.get(deviceDocId)) as any,
    )

    const device = (await ctx.db.get(deviceDocId)) as any
    expect(device.queuedCommands.pump).toMatchObject({ kind: 'pump', durationMs: 30_000 })
  })
})

describe('schedule preamble helper authz (requirePlantDevice)', () => {
  it('rejects foreign devices with no-existence-oracle error, owner passes', async () => {
    const ctx = createFakeCtx()
    const owner = await seedUser(ctx, 'Owner')
    const attacker = await seedUser(ctx, 'Attacker')
    const { deviceDocId } = await seedDeviceWithPlant(ctx, owner, 'GM-OWNED', { version: 'v1' })

    await expect(
      requirePlantDevice(ctx as any, { _id: attacker } as any, deviceDocId as any),
    ).rejects.toThrow('Jadwal tidak ditemukan')
    await expect(
      requirePlantDevice(ctx as any, { _id: owner } as any, deviceDocId as any),
    ).resolves.toMatchObject({ deviceId: 'GM-OWNED' })
  })

  it('toggle + delete cores reject foreign schedules, owner paths still work', async () => {
    const ctx = createFakeCtx()
    const owner = await seedUser(ctx, 'Owner')
    const attacker = await seedUser(ctx, 'Attacker')
    const { plantId } = await seedDeviceWithPlant(ctx, owner, 'GM-OWNED', { version: 'v1' })
    const scheduleId = await seedSchedule(ctx, plantId)

    await expect(
      toggleScheduleCore(ctx as any, { _id: attacker } as any, scheduleId as any, false),
    ).rejects.toThrow('Jadwal tidak ditemukan')
    await expect(
      deleteScheduleCore(ctx as any, { _id: attacker } as any, scheduleId as any),
    ).rejects.toThrow('Jadwal tidak ditemukan')
    expect(await ctx.db.get(scheduleId)).not.toBeNull()

    await expect(
      toggleScheduleCore(ctx as any, { _id: owner } as any, scheduleId as any, false),
    ).resolves.toMatchObject({ enabled: false })
    await expect(
      deleteScheduleCore(ctx as any, { _id: owner } as any, scheduleId as any),
    ).resolves.toMatchObject({ title: 'Penyiraman Otomatis' })
    expect(await ctx.db.get(scheduleId)).toBeNull()
  })
})

describe('archived mini-list bound (buildDeviceSummary)', () => {
  it('reads archived plants with take(4), never collect(), slices to 3', () => {
    const src = readFileSync(join(process.cwd(), 'convex/helpers/devices.ts'), 'utf8')
    const start = src.indexOf('export async function buildDeviceSummary')
    expect(start).toBeGreaterThanOrEqual(0)
    const end = src.indexOf('export async function formatDeviceDetail', start)
    expect(end).toBeGreaterThan(start)
    const block = src.slice(start, end)
    expect(block).toContain('.take(4)')
    expect(block).not.toContain('.collect()')
    expect(block).toContain('.slice(0, 3)')
  })

  it('mini-list shows at most the 3 most recent archived plants', async () => {
    const ctx = createFakeCtx()
    const owner = await seedUser(ctx, 'Owner')
    const { deviceDocId } = await seedDeviceWithPlant(ctx, owner, 'GM-MINI')
    for (let i = 0; i < 6; i++) {
      await ctx.db.insert('plants', {
        deviceId: deviceDocId,
        name: `Arsip ${i}`,
        species: 'Capsicum annuum',
        growthStage: 'maturity_senescence',
        archived: true,
        archivedAt: NOW - i * 1000,
        plantedAt: NOW - 100_000,
        createdAt: NOW - 100_000,
        updatedAt: NOW - 100_000,
      })
    }

    const summary = (await buildDeviceSummary(
      ctx as any,
      (await ctx.db.get(deviceDocId)) as any,
    )) as any
    expect(summary.archivedPlants).toHaveLength(3)
    expect(summary.archivedPlants.map((p: any) => p.archivedAt)).toEqual([
      NOW,
      NOW - 1000,
      NOW - 2000,
    ])
  })
})
