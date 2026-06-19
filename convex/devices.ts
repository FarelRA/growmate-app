import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { DeviceDoc, PlantStageValue, DeviceAutomationKey, SensorKind } from './types'
import {
  getCurrentUser, requireUser, recordGrowEvent, recordPlantImage,
  addUserActivity,
  getRecentGrowEvents, getRecentAutomationLogs, getPlantImageHistory,
  getSensorHistory, getUserDevices, requireOwnedDevice, getSelectedDevice, archivePlant,
  buildDeviceSummary, buildPlantView, normalizeLifecycleProfile, normalizePlantSensorProfile,
  computePlantProgress, getDeviceByExternalId,
  formatPlantStage, getAutomationModeLabel, formatEventValue, getHealthComputationGuide,
  computePlantHealth, computeWaterReservoirDays, getSensorStatus, getSensorTarget,
  getSensorLabel, getSensorAccent, getSensorSort, generateAlerts, formatTimestamp, getRelativeTime,
} from './helpers'
import { plantSensorProfile, lifecycleProfileValidator } from './schema'
import { formatScheduleSummary } from './care'

export const getUnclaimedDevice = query({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query('devices')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .first()

    if (!device) return null
    if (device.userId) return null

    return {
      deviceId: device.deviceId,
      name: device.name,
      firmwareVersion: device.firmwareVersion,
    }
  },
})

export const userDevices = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    const devices = await getUserDevices(ctx, user._id)
    return await Promise.all(devices.map((device) => buildDeviceSummary(ctx, device)))
  },
})

export const assignPlantToDevice = mutation({
  args: {
    deviceId: v.string(),
    plantName: v.string(),
    plantSpecies: v.string(),
    growthStage: v.optional(
      v.union(
        v.literal('seed_dormancy'),
        v.literal('germination'),
        v.literal('seedling_development'),
        v.literal('vegetative_growth'),
        v.literal('flowering_reproduction'),
        v.literal('maturity_senescence'),
      ),
    ),
    wateringThreshold: v.optional(v.number()),
    lightingThreshold: v.optional(v.number()),
    sensorProfile: v.optional(plantSensorProfile),
    lifecycleProfile: v.optional(lifecycleProfileValidator),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await requireOwnedDevice(ctx, user._id, args.deviceId)
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
  },
})

export const removeDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await requireOwnedDevice(ctx, user._id, args.deviceId)
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
  },
})

export const dashboard = query({
  args: {
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) return null

    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const notifications = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .take(8)

    if (!plant || plant.archived) {
      const recentEvents = await getRecentGrowEvents(ctx, device._id, 10)
      return {
        user,
        device: await buildDeviceSummary(ctx, device),
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
    const rawSensors = await ctx.db
      .query('sensors')
      .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
      .collect()
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
        label: getSensorLabel(s.kind as SensorKind),
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
      { lastSeen: device.lastSeen, autoWatering: device.autoWatering },
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
      device: await buildDeviceSummary(ctx, device),
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
  },
})

export const deviceHistory = query({
  args: {
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) return null

    const currentPlant = device.plantId ? await ctx.db.get(device.plantId) : null
    const archivedPlants = await ctx.db
      .query('plants')
      .withIndex('by_device_archived', (q) => q.eq('deviceId', device._id).eq('archived', true))
      .collect()

    const [timeline, imageHistory] = await Promise.all([
      getRecentGrowEvents(ctx, device._id, 5),
      currentPlant && !currentPlant.archived
        ? getPlantImageHistory(ctx, currentPlant._id, 16)
        : Promise.resolve([]),
    ])

    if (!currentPlant || currentPlant.archived) {
      return {
        device: await buildDeviceSummary(ctx, device),
        currentPlant: null,
        archivedPlants: archivedPlants
          .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
          .map((plant) => ({
            _id: plant._id,
            name: plant.name,
            species: plant.species,
            growthStage: plant.growthStage,
            location: plant.location,
            plantedAtLabel: formatTimestamp(plant.plantedAt),
            archivedAtLabel: plant.archivedAt ? formatTimestamp(plant.archivedAt) : null,
          })),
        metricHistory: {},
        automationLogs: [],
        timeline,
        imageHistory,
      }
    }

    const [metricHistory, automationLogs] = await Promise.all([
      getSensorHistory(ctx, currentPlant._id, 60),
      getRecentAutomationLogs(ctx, currentPlant._id, 20),
    ])

    return {
      device: await buildDeviceSummary(ctx, device),
      currentPlant: {
        ...(await buildPlantView(ctx, currentPlant)),
        plantedAtLabel: formatTimestamp(currentPlant.plantedAt),
        growthStageLabel: formatPlantStage(currentPlant.growthStage),
        progress: computePlantProgress(currentPlant),
      },
      archivedPlants: archivedPlants
        .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
        .map((plant) => ({
          _id: plant._id,
          name: plant.name,
          species: plant.species,
          growthStage: plant.growthStage,
          location: plant.location,
          plantedAtLabel: formatTimestamp(plant.plantedAt),
          archivedAtLabel: plant.archivedAt ? formatTimestamp(plant.archivedAt) : null,
        })),
      metricHistory,
      automationLogs,
      timeline,
      imageHistory,
    }
  },
})

export const updateDeviceAutomation = mutation({
  args: {
    deviceId: v.string(),
    autoWatering: v.optional(v.boolean()),
    autoLighting: v.optional(v.boolean()),
    wateringThreshold: v.optional(v.number()),
    wateringDuration: v.optional(v.number()),
    wateringCooldown: v.optional(v.number()),
    lightingThreshold: v.optional(v.number()),
    lightingHysteresis: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device =
      user.role === 'admin'
        ? await getDeviceByExternalId(ctx, args.deviceId)
        : await requireOwnedDevice(ctx, user._id, args.deviceId)
    if (!device) {
      throw new Error('Perangkat tidak ditemukan')
    }

    const includesLowLevelAutomation =
      args.wateringThreshold !== undefined ||
      args.wateringDuration !== undefined ||
      args.wateringCooldown !== undefined ||
      args.lightingThreshold !== undefined ||
      args.lightingHysteresis !== undefined

    if (includesLowLevelAutomation && user.role !== 'admin') {
      throw new Error('Hanya admin yang dapat mengubah pengaturan teknis otomatisasi perangkat')
    }

    const updates: Partial<Pick<DeviceDoc, DeviceAutomationKey>> = {}
    if (args.autoWatering !== undefined) updates.autoWatering = args.autoWatering
    if (args.autoLighting !== undefined) updates.autoLighting = args.autoLighting
    if (args.wateringThreshold !== undefined) updates.wateringThreshold = args.wateringThreshold
    if (args.wateringDuration !== undefined) updates.wateringDuration = args.wateringDuration
    if (args.wateringCooldown !== undefined) updates.wateringCooldown = args.wateringCooldown
    if (args.lightingThreshold !== undefined) updates.lightingThreshold = args.lightingThreshold
    if (args.lightingHysteresis !== undefined) updates.lightingHysteresis = args.lightingHysteresis

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
  },
})
