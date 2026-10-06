import { ConvexError } from 'convex/values'
import type { Ctx, MutationCtx } from '../../types'
import type { Id } from '../../_generated/dataModel'
import {
  DEFAULT_WATERING_THRESHOLD, DEFAULT_LIGHTING_THRESHOLD,
  DEFAULT_WATERING_DURATION, DEFAULT_WATERING_COOLDOWN, DEFAULT_LIGHTING_HYSTERESIS,
  DEFAULT_FERTILIZING_THRESHOLD, DEFAULT_FERTILIZING_DURATION, DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_PESTICIDE_THRESHOLD, DEFAULT_PESTICIDE_DURATION, DEFAULT_PESTICIDE_COOLDOWN,
  DEFAULT_TANK_CAPACITY, DEFAULT_TANK_MIN_LEVEL,
} from '../../types'
import { recordGrowEvent } from '../events'

export async function getDeviceByExternalId(ctx: Ctx, deviceId: string) {
  return await ctx.db
    .query('devices')
    .withIndex('by_deviceId', (q) => q.eq('deviceId', deviceId))
    .first()
}

export function getDefaultDeviceName(deviceId: string) {
  const normalized = deviceId.trim()
  const suffix = normalized.length > 6 ? normalized.slice(-6) : normalized
  return `GrowMate ${suffix.toUpperCase()}`
}

export async function ensureDeviceExists(ctx: MutationCtx, deviceId: string, firmwareVersion?: string) {
  const normalizedDeviceId = deviceId.trim()
  const existing = await getDeviceByExternalId(ctx, normalizedDeviceId)
  if (existing) return existing

  const now = Date.now()
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: normalizedDeviceId,
    name: getDefaultDeviceName(normalizedDeviceId),
    version: 'v1',
    autoWatering: true,
    autoLighting: true,
    wateringThreshold: DEFAULT_WATERING_THRESHOLD,
    wateringDuration: DEFAULT_WATERING_DURATION,
    wateringCooldown: DEFAULT_WATERING_COOLDOWN,
    lightingThreshold: DEFAULT_LIGHTING_THRESHOLD,
    lightingHysteresis: DEFAULT_LIGHTING_HYSTERESIS,
    autoFertilizing: false,
    autoPesticide: false,
    fertilizingThreshold: DEFAULT_FERTILIZING_THRESHOLD,
    fertilizingDuration: DEFAULT_FERTILIZING_DURATION,
    fertilizingCooldown: DEFAULT_FERTILIZING_COOLDOWN,
    pesticideThreshold: DEFAULT_PESTICIDE_THRESHOLD,
    pesticideDuration: DEFAULT_PESTICIDE_DURATION,
    pesticideCooldown: DEFAULT_PESTICIDE_COOLDOWN,
    lightEnabled: false,
    queuedCommands: { pump: null, light: null, fertilizer: null, pesticide: null },
    reportedLightEnabled: false,
    reportedPumpEnabled: false,
    reportedFertilizerEnabled: false,
    reportedPesticideEnabled: false,
    reportedTankSwitchOpen: false,
    reportedDrawerSwitchOpen: false,
    tankCapacity: DEFAULT_TANK_CAPACITY,
    tankMinLevel: DEFAULT_TANK_MIN_LEVEL,
    batteryCapacityAh: 5,
    batteryAccumulatedMah: 0,
    batterySoC: 50,
    hasModem: false,
    hasSolarPanel: false,
    lastSeen: now,
    firmwareVersion: firmwareVersion?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  })

  return (await ctx.db.get(deviceDocId))!
}

export async function getUserDevices(ctx: Ctx, userId: Id<'users'>) {
  const devices = await ctx.db
    .query('devices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  return devices.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function requireOwnedDevice(ctx: Ctx, userId: Id<'users'>, deviceId: string) {
  const device = await getDeviceByExternalId(ctx, deviceId)
  if (!device || device.userId !== userId) {
    throw new ConvexError('Perangkat tidak ditemukan')
  }
  return device
}

export async function getSelectedDevice(ctx: Ctx, userId: Id<'users'>, deviceId?: string) {
  if (deviceId) return await requireOwnedDevice(ctx, userId, deviceId)
  const devices = await getUserDevices(ctx, userId)
  return devices[0] ?? null
}

export async function archivePlant(
  ctx: MutationCtx,
  plantId: Id<'plants'>,
  archivedAt: number,
  userId?: Id<'users'>,
  reason = 'Tanaman diarsipkan',
) {
  const plant = await ctx.db.get(plantId)
  if (!plant || plant.archived) return plant

  await ctx.db.patch(plantId, {
    archived: true,
    archivedAt,
    updatedAt: archivedAt,
  })

  await recordGrowEvent(ctx, {
    deviceId: plant.deviceId,
    plantId,
    userId,
    source: userId ? 'user' : 'system',
    entityType: 'plant',
    eventType: 'plant_archived',
    title: reason,
    detail: `${plant.name} dipindahkan ke riwayat arsip.`,
    data: { archived: true, archivedAt },
    timestamp: archivedAt,
  })

  return await ctx.db.get(plantId)
}
