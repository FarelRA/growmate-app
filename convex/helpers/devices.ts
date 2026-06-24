import { ConvexError } from 'convex/values'
import type { Ctx, MutationCtx, DeviceDoc, DeviceQueuedCommands, QueuedDeviceAction } from '../types'
import type { Id } from '../_generated/dataModel'
import {
  DEFAULT_WATERING_THRESHOLD, DEFAULT_LIGHTING_THRESHOLD,
  DEFAULT_WATERING_DURATION, DEFAULT_WATERING_COOLDOWN, DEFAULT_LIGHTING_HYSTERESIS,
  DEFAULT_FERTILIZING_THRESHOLD, DEFAULT_FERTILIZING_DURATION, DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_PESTICIDE_THRESHOLD, DEFAULT_PESTICIDE_DURATION, DEFAULT_PESTICIDE_COOLDOWN,
} from '../types'
import { formatTimestamp, isDeviceOnline } from './generic'
import { formatPlantStage } from './plants'
import { recordGrowEvent, recordAutomationEvent, getRecentGrowEvents } from './events'

export function computeWaterReservoirDays(
  waterLevel: number,
  dailyUsage: number = 5,
): number {
  const reservoirCapacity = 60
  const currentLiters = (waterLevel / 100) * reservoirCapacity
  return Math.floor(currentLiters / dailyUsage)
}

export function getDeviceWateringDuration(device: Pick<DeviceDoc, 'wateringDuration'>) {
  return Number.isFinite(device.wateringDuration)
    ? device.wateringDuration
    : DEFAULT_WATERING_DURATION
}

export function getDeviceWateringCooldown(device: Pick<DeviceDoc, 'wateringCooldown'>) {
  return Number.isFinite(device.wateringCooldown)
    ? device.wateringCooldown
    : DEFAULT_WATERING_COOLDOWN
}

export function getDeviceLightingHysteresis(device: Pick<DeviceDoc, 'lightingHysteresis'>) {
  return Number.isFinite(device.lightingHysteresis)
    ? device.lightingHysteresis
    : DEFAULT_LIGHTING_HYSTERESIS
}

export function getQueuedDeviceCommands(device: DeviceDoc): DeviceQueuedCommands {
  return (
    device.queuedCommands ?? {
      pump: null,
      light: null,
      fertilizer: null,
      pesticide: null,
    }
  )
}

export function buildDeviceCommandList(device: DeviceDoc) {
  return Object.values(getQueuedDeviceCommands(device)).filter(
    (command): command is QueuedDeviceAction => command !== null,
  )
}

export function buildQueuedPumpAction(device: DeviceDoc, durationSeconds: number) {
  const queuedCommands = getQueuedDeviceCommands(device)
  return {
    queuedCommands: {
      ...queuedCommands,
      pump: { kind: 'pump' as const, durationMs: durationSeconds * 1000 },
    },
  }
}

export function buildQueuedLightAction(device: DeviceDoc, enabled: boolean) {
  const queuedCommands = getQueuedDeviceCommands(device)
  return {
    queuedCommands: {
      ...queuedCommands,
      light: { kind: 'light' as const, enabled },
    },
  }
}

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

export async function buildDeviceSummary(ctx: Ctx, device: DeviceDoc) {
  const currentPlant = device.plantId ? await ctx.db.get(device.plantId) : null
  const archivedPlants = await ctx.db
    .query('plants')
    .withIndex('by_device_archived', (q) => q.eq('deviceId', device._id).eq('archived', true))
    .collect()
  const recentEvents = await getRecentGrowEvents(ctx, device._id, 4)

  const plantImageUrl =
    currentPlant && !currentPlant.archived
      ? currentPlant.imageUrl ?? null
      : null

  return {
    _id: device._id,
    deviceId: device.deviceId,
    name: device.name,
    firmwareVersion: device.firmwareVersion,
    autoWatering: device.autoWatering,
    autoLighting: device.autoLighting,
    wateringThreshold: device.wateringThreshold,
    wateringDuration: getDeviceWateringDuration(device),
    wateringCooldown: getDeviceWateringCooldown(device),
    lightingThreshold: device.lightingThreshold,
    lightingHysteresis: getDeviceLightingHysteresis(device),
    lightEnabled: device.lightEnabled,
    lastWatered: device.lastWatered,
    lastSeen: device.lastSeen,
    isOnline: isDeviceOnline(device.lastSeen),
    hasPlant: Boolean(currentPlant && !currentPlant.archived),
    plant:
      currentPlant && !currentPlant.archived
        ? {
            _id: currentPlant._id,
            name: currentPlant.name,
            species: currentPlant.species,
            growthStage: currentPlant.growthStage,
            growthStageLabel: formatPlantStage(currentPlant.growthStage),
            wateringThreshold: currentPlant.wateringThreshold,
            lightingThreshold: currentPlant.lightingThreshold,
            location: currentPlant.location,
            imageUrl: plantImageUrl,
            plantedAt: currentPlant.plantedAt,
          }
        : null,
    archivedPlantCount: archivedPlants.length,
    archivedPlants: archivedPlants
      .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
      .slice(0, 3)
      .map((plant) => ({
        _id: plant._id,
        name: plant.name,
        species: plant.species,
        growthStage: plant.growthStage,
        growthStageLabel: formatPlantStage(plant.growthStage),
        archivedAt: plant.archivedAt,
        archivedAtLabel: plant.archivedAt ? formatTimestamp(plant.archivedAt) : null,
      })),
    recentEvents,
  }
}

export async function executeManualWatering(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  now = Date.now(),
) {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null
  const durationSeconds = getDeviceWateringDuration(device)

  const updates: Record<string, unknown> = {
    ...buildQueuedPumpAction(device, durationSeconds),
    updatedAt: now,
  }

  // V2 devices also queue fertilizer during manual watering
  if (device.version === 'v2') {
    Object.assign(updates, buildQueuedFertilizerAction(device, durationSeconds))
  }

  await ctx.db.patch(device._id, updates)

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_pump',
      duration: durationSeconds,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_watering_triggered',
      title: 'Penyiraman manual dipicu',
      detail: `${device.name} memulai siklus penyiraman manual.`,
      data: { duration: durationSeconds },
      timestamp: now,
    })
  }

  await ctx.db.insert('notifications', {
    userId: user._id,
    title: 'Penyiraman manual dipicu',
    detail: `${device.name} berhasil menjalankan siklus penyiraman manual.`,
    kind: 'system',
    read: false,
    createdAt: now,
  })
}

// ============================================
// V2 HELPERS
// ============================================

export function buildQueuedFertilizerAction(device: DeviceDoc, durationSeconds: number) {
  const queuedCommands = getQueuedDeviceCommands(device)
  return {
    queuedCommands: {
      ...queuedCommands,
      fertilizer: { kind: 'fertilizer' as const, durationMs: durationSeconds * 1000 },
    },
  }
}

export function buildQueuedPesticideAction(device: DeviceDoc, durationSeconds: number) {
  const queuedCommands = getQueuedDeviceCommands(device)
  return {
    queuedCommands: {
      ...queuedCommands,
      pesticide: { kind: 'pesticide' as const, durationMs: durationSeconds * 1000 },
    },
  }
}

export function getDeviceFertilizingDuration(device: Pick<DeviceDoc, 'fertilizingDuration'>) {
  return Number.isFinite(device.fertilizingDuration)
    ? device.fertilizingDuration
    : DEFAULT_FERTILIZING_DURATION
}

export function getDevicePesticideDuration(device: Pick<DeviceDoc, 'pesticideDuration'>) {
  return Number.isFinite(device.pesticideDuration)
    ? device.pesticideDuration
    : DEFAULT_PESTICIDE_DURATION
}

export function getDeviceFertilizingCooldown(device: Pick<DeviceDoc, 'fertilizingCooldown'>) {
  return Number.isFinite(device.fertilizingCooldown)
    ? device.fertilizingCooldown
    : DEFAULT_FERTILIZING_COOLDOWN
}

export function getDevicePesticideCooldown(device: Pick<DeviceDoc, 'pesticideCooldown'>) {
  return Number.isFinite(device.pesticideCooldown)
    ? device.pesticideCooldown
    : DEFAULT_PESTICIDE_COOLDOWN
}

export async function executeManualFertilizing(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  now = Date.now(),
): Promise<void> {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null
  const durationSeconds = getDeviceFertilizingDuration(device)

  await ctx.db.patch(device._id, {
    ...buildQueuedFertilizerAction(device, durationSeconds),
    ...buildQueuedPumpAction(device, durationSeconds),
    updatedAt: now,
  })

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_fertilizer',
      duration: durationSeconds,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_fertilizing_triggered',
      title: 'Pemupukan manual dipicu',
      detail: `${device.name} memulai siklus pemupukan manual.`,
      data: { duration: durationSeconds },
      timestamp: now,
    })
  }
}

export async function executeManualPesticide(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  now = Date.now(),
): Promise<void> {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null
  const durationSeconds = getDevicePesticideDuration(device)

  await ctx.db.patch(device._id, {
    ...buildQueuedPesticideAction(device, durationSeconds),
    ...buildQueuedPumpAction(device, durationSeconds),
    updatedAt: now,
  })

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_pesticide',
      duration: durationSeconds,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_pesticide_triggered',
      title: 'Pestisida manual dipicu',
      detail: `${device.name} memulai siklus pestisida manual.`,
      data: { duration: durationSeconds },
      timestamp: now,
    })
  }
}

export async function executeManualLighting(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  enabled: boolean,
  now = Date.now(),
) {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null

  await ctx.db.patch(device._id, {
    ...buildQueuedLightAction(device, enabled),
    lightEnabled: enabled,
    updatedAt: now,
  })

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_light',
      lightValue: undefined,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_lighting_triggered',
      title: enabled ? 'Pencahayaan manual dinyalakan' : 'Pencahayaan manual dimatikan',
      detail: `${device.name} lampu tumbuh ${enabled ? 'dinyalakan' : 'dimatikan'} secara manual.`,
      data: { enabled },
      timestamp: now,
    })
  }
}
