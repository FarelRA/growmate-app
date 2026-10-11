import type { Infer } from 'convex/values'
import type {
  QueryCtx, MutationCtx, UserDoc, DeviceDoc, PlantDoc, SensorDoc,
  PlantStageValue, DeviceAutomationKey, SensorKind,
} from '../types'
import { recordGrowEvent, recordPlantImage, getRecentGrowEvents, getRecentAutomationLogs } from '../helpers/events'
import {
  addUserActivity, getAutomationModeLabel, formatEventValue, getRelativeTime,
} from '../helpers/generic'
import {
  getSensorHistory, getPlantImageHistory, normalizePlantSensorProfile,
  computePlantHealth, getSensorStatus, getSensorTarget,
  getSensorLabel, getSensorAccent, getSensorSort, generateAlerts,
} from '../helpers/sensors'
import {
  getUserDevices, archivePlant,
  buildDeviceSummary, computeWaterReservoirDays,
} from '../helpers/devices'
import {
  buildPlantView, normalizeLifecycleProfile,
  computePlantProgress, formatPlantStage, getHealthComputationGuide,
} from '../helpers/plants'
import { plantSensorProfile, lifecycleProfileValidator } from '../schema'
import { formatDeviceDetail } from '../helpers/devices'
import { formatScheduleSummary } from '../care/schedules'

// Query + mutation cores for convex/devices.ts. Delegates in devices.ts own
// the ownership gates (requireOwnedDevice / getSelectedDevice stay visible
// there) and the bounded read windows; these cores own assembly + writes.

export async function getUnclaimedDeviceCore(ctx: QueryCtx, deviceId: string) {
  const device = await ctx.db
    .query('devices')
    .withIndex('by_deviceId', (q) => q.eq('deviceId', deviceId.trim()))
    .first()

  if (!device) return null
  if (device.userId) return null

  return {
    deviceId: device.deviceId,
    name: device.name,
  }
}

export async function userDevicesCore(ctx: QueryCtx, user: UserDoc) {
  const devices = await getUserDevices(ctx, user._id)
  return await Promise.all(devices.map((device) => buildDeviceSummary(ctx, device)))
}

export type AssignPlantArgs = {
  deviceId: string
  plantName: string
  plantSpecies: string
  growthStage?: 'seed_dormancy' | 'germination' | 'seedling_development' | 'vegetative_growth' | 'flowering_reproduction' | 'maturity_senescence'
  wateringThreshold?: number
  lightingThreshold?: number
  fertilizingThreshold?: number
  fertilizerCadenceDays?: number
  pesticideCadenceDays?: number
  nutrientNotes?: string
  sensorProfile?: Infer<typeof plantSensorProfile>
  lifecycleProfile?: Infer<typeof lifecycleProfileValidator>
  location?: string
  imageUrl?: string
}

export async function assignPlantCore(
  ctx: MutationCtx,
  user: UserDoc,
  device: DeviceDoc,
  args: AssignPlantArgs,
) {
  const now = Date.now()
  const previousPlant = device.plantId ? await ctx.db.get(device.plantId) : null

  if (device.plantId) {
    await archivePlant(ctx, device.plantId, now, user._id, 'Plant replaced')
  }

  const lifecycleProfile = normalizeLifecycleProfile(args.lifecycleProfile)
  const wateringThreshold = args.wateringThreshold ?? device.wateringThreshold
  const lightingThreshold = args.lightingThreshold ?? device.lightingThreshold
  const sensorProfile = normalizePlantSensorProfile(args.sensorProfile)

  const plantId = await ctx.db.insert('plants', {
    deviceId: device._id,
    name: args.plantName.trim(),
    species: args.plantSpecies.trim(),
    growthStage: args.growthStage ?? 'seed_dormancy',
    wateringThreshold,
    lightingThreshold,
    fertilizingThreshold: args.fertilizingThreshold,
    fertilizerCadenceDays: args.fertilizerCadenceDays,
    pesticideCadenceDays: args.pesticideCadenceDays,
    nutrientNotes: args.nutrientNotes?.trim(),
    sensorProfile,
    lifecycleProfile,
    location: args.location?.trim() || device.name,
    imageUrl: args.imageUrl || undefined,
    archived: false,
    plantedAt: now,
    createdAt: now,
    updatedAt: now,
  })

  await ctx.db.patch(device._id, {
    plantId,
    wateringThreshold,
    lightingThreshold,
    updatedAt: now,
  })

  await recordGrowEvent(ctx, {
    deviceId: device._id,
    plantId,
    userId: user._id,
    source: 'user',
    entityType: 'plant',
    eventType: 'plant_assigned',
    title: previousPlant ? 'Tanaman diganti' : 'Tanaman dipasang',
    detail: `${args.plantName.trim()} sekarang menjadi tanaman aktif di ${device.name}.`,
    data: {
      growthStage: formatPlantStage((args.growthStage ?? 'seed_dormancy') as PlantStageValue),
      wateringThreshold,
      lightingThreshold,
      previousPlant: previousPlant?.name ?? 'none',
    },
    timestamp: now,
  })

  if (args.imageUrl) {
    await recordPlantImage(ctx, {
      plantId,
      deviceId: device._id,
      imageUrl: args.imageUrl,
      source: 'manual',
      capturedAt: now,
    })
  }

  await ctx.db.patch(user._id, {
    setupComplete: true,
    updatedAt: now,
  })

  await addUserActivity(ctx, {
    userId: user._id,
    activityType: 'plant_added',
    relatedId: plantId,
    createdAt: now,
  })

  return { success: true, plantId }
}

export async function removeDeviceCore(
  ctx: MutationCtx,
  user: UserDoc,
  device: DeviceDoc,
) {
  const now = Date.now()

  if (device.plantId) {
    await archivePlant(ctx, device.plantId, now, user._id, 'Tanaman diarsipkan saat perangkat dilepas')
  }

  await ctx.db.patch(device._id, {
    userId: undefined,
    plantId: undefined,
    updatedAt: now,
  })

  await recordGrowEvent(ctx, {
    deviceId: device._id,
    userId: user._id,
    source: 'user',
    entityType: 'device',
    eventType: 'device_unclaimed',
    title: 'Perangkat dilepas dari akun',
    detail: `${device.name} dikembalikan ke daftar perangkat yang belum diklaim.`,
    data: { deviceId: device.deviceId },
    timestamp: now,
  })

  const remainingDevices = await getUserDevices(ctx, user._id)
  await ctx.db.patch(user._id, {
    setupComplete: remainingDevices.some((ownedDevice) => Boolean(ownedDevice.plantId)),
    updatedAt: now,
  })

  return { success: true }
}

export type UpdateAutomationArgs = {
  deviceId: string
  autoWatering?: boolean
  autoLighting?: boolean
  wateringThreshold?: number
  wateringDuration?: number
  wateringCooldown?: number
  lightingThreshold?: number
  lightingHysteresis?: number
  autoFertilizing?: boolean
  autoPesticide?: boolean
  fertilizingThreshold?: number
  fertilizingDuration?: number
  fertilizingCooldown?: number
  pesticideThreshold?: number
  pesticideDuration?: number
  pesticideCooldown?: number
}

export async function updateAutomationCore(
  ctx: MutationCtx,
  user: UserDoc,
  device: DeviceDoc,
  args: UpdateAutomationArgs,
) {
  const updates: Partial<Pick<DeviceDoc, DeviceAutomationKey>> = {}
  if (args.autoWatering !== undefined) updates.autoWatering = args.autoWatering
  if (args.autoLighting !== undefined) updates.autoLighting = args.autoLighting
  if (args.wateringThreshold !== undefined) updates.wateringThreshold = args.wateringThreshold
  if (args.wateringDuration !== undefined) updates.wateringDuration = args.wateringDuration
  if (args.wateringCooldown !== undefined) updates.wateringCooldown = args.wateringCooldown
  if (args.lightingThreshold !== undefined) updates.lightingThreshold = args.lightingThreshold
  if (args.lightingHysteresis !== undefined) updates.lightingHysteresis = args.lightingHysteresis
  if (args.autoFertilizing !== undefined) updates.autoFertilizing = args.autoFertilizing
  if (args.autoPesticide !== undefined) updates.autoPesticide = args.autoPesticide
  if (args.fertilizingThreshold !== undefined) updates.fertilizingThreshold = args.fertilizingThreshold
  if (args.fertilizingDuration !== undefined) updates.fertilizingDuration = args.fertilizingDuration
  if (args.fertilizingCooldown !== undefined) updates.fertilizingCooldown = args.fertilizingCooldown
  if (args.pesticideThreshold !== undefined) updates.pesticideThreshold = args.pesticideThreshold
  if (args.pesticideDuration !== undefined) updates.pesticideDuration = args.pesticideDuration
  if (args.pesticideCooldown !== undefined) updates.pesticideCooldown = args.pesticideCooldown

  const changedFields = Object.entries(updates).reduce<Record<string, string | number | boolean>>(
    (acc, [rawKey, value]) => {
      const key = rawKey as DeviceAutomationKey
      if (device[key] !== value) {
        acc[`${key}Before`] = formatEventValue(device[key])
        acc[`${key}After`] = formatEventValue(value)
      }
      return acc
    },
    {},
  )

  const now = Date.now()
  await ctx.db.patch(device._id, { ...updates, updatedAt: now })

  if (Object.keys(changedFields).length > 0) {
    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: device.plantId,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'automation_settings_updated',
      title: 'Pengaturan otomatisasi diperbarui',
      detail: `${device.name} mengalami perubahan pada mode dan ambang otomatisasi.`,
      data: changedFields,
      timestamp: now,
    })
  }

  return { success: true }
}

export async function dashboardCore(
  ctx: QueryCtx,
  user: UserDoc,
  device: DeviceDoc,
  plant: PlantDoc | null,
  rawSensors: SensorDoc[],
) {
  const notifications = await ctx.db
    .query('notifications')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .order('desc')
    .take(8)

  if (!plant || plant.archived) {
    const recentEvents = await getRecentGrowEvents(ctx, device._id, 10)
    return {
      user,
      device: {
        ...(await formatDeviceDetail(ctx, device)),
      },
      plant: null,
      sensors: [],
      schedules: [],
      healthComputation: getHealthComputationGuide(),
      notifications,
      reservoirDays: 0,
      alerts: [],
      automationMode: getAutomationModeLabel(device),
      recentEvents,
      automationLogs: [],
      imageHistory: [],
    }
  }

  const plantView = await buildPlantView(ctx, plant)
  const sensorProfile = normalizePlantSensorProfile(plant.sensorProfile)
  const [sensorHistory, recentEvents, automationLogs, imageHistory] = await Promise.all([
    getSensorHistory(ctx, plant._id, 24),
    getRecentGrowEvents(ctx, device._id, 10),
    getRecentAutomationLogs(ctx, plant._id, 8),
    getPlantImageHistory(ctx, plant._id, 8),
  ])

  const sensors = rawSensors
    .map((s) => ({
      _id: s._id,
      kind: s.kind,
      value: s.value,
      unit: s.unit,
      label: getSensorLabel(s.kind as SensorKind, device.version as 'v1' | 'v2'),
      status: getSensorStatus(s.kind as SensorKind, s.value, sensorProfile),
      target: getSensorTarget(
        s.kind as SensorKind,
        s.value,
        getSensorStatus(s.kind as SensorKind, s.value, sensorProfile),
        sensorProfile,
      ),
      accent: getSensorAccent(s.kind as SensorKind),
      sort: getSensorSort(s.kind as SensorKind),
      history: sensorHistory[s.kind as SensorKind] ?? [],
    }))
    .sort((a, b) => a.sort - b.sort)

  const plantHealth = computePlantHealth(
    rawSensors.map((s) => ({ kind: s.kind as SensorKind, value: s.value })),
    sensorProfile,
  )
  const plantProgress = computePlantProgress(plant)
  const waterSensor = rawSensors.find((s) => s.kind === 'water')
  const waterLevel = waterSensor?.value || 0
  const dailyUsage = device.autoWatering ? 5 : 2
  const reservoirDays = computeWaterReservoirDays(waterLevel, dailyUsage)

  const alerts = generateAlerts(
    rawSensors.map((s) => ({ kind: s.kind as SensorKind, value: s.value })),
    { lastSeen: device.lastSeen, autoWatering: device.autoWatering, version: device.version },
    sensorProfile,
  )

  const schedules = await ctx.db
    .query('careSchedules')
    .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
    .take(6)
  const formattedSchedules = schedules.map((schedule) => {
    const summary = formatScheduleSummary(schedule)
    return {
      ...schedule,
      cadenceUnit: summary.cadence.unit,
      cadenceValue: summary.cadence.value,
      timeOfDayMinutes: summary.cadence.timeOfDayMinutes,
      cadenceLabel: summary.cadenceLabel,
      timeLabel: summary.timeLabel,
      nextRunLabel: getRelativeTime(schedule.nextRunAt),
      lastRunLabel: schedule.lastRunAt ? getRelativeTime(schedule.lastRunAt) : null,
    }
  })

  return {
    user,
    plant: {
      ...plantView,
      health: plantHealth,
      healthReason: rawSensors.length
        ? `${rawSensors.filter((sensor) => getSensorStatus(sensor.kind as SensorKind, sensor.value, sensorProfile) === 'optimal').length} dari ${rawSensors.length} sensor berada pada rentang yang ideal.`
        : 'Belum ada pembacaan sensor yang tersedia, sehingga kondisi tanaman sementara dianggap kurang stabil.',
      growthStageLabel: formatPlantStage(plant.growthStage),
      progress: plantProgress,
    },
    device: {
      ...(await formatDeviceDetail(ctx, device)),
    },
    sensors,
    schedules: formattedSchedules,
    healthComputation: getHealthComputationGuide(sensorProfile),
    notifications,
    reservoirDays,
    alerts,
    automationMode: getAutomationModeLabel(device),
    recentEvents,
    automationLogs,
    imageHistory,
  }
}
