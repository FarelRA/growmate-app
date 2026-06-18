import { v } from 'convex/values'
import { internalMutation } from './_generated/server'
import type { SensorDoc, SensorKind } from './types'
import {
  ensureDeviceExists, getQueuedDeviceCommands, buildDeviceCommandList, buildQueuedPumpAction,
  buildQueuedLightAction,
  normalizeRawSensorValue, recordGrowEvent, recordPlantImage,
  recordAutomationEvent, getDeviceByExternalId,
} from './helpers'

export const updateSensorData = internalMutation({
  args: {
    deviceId: v.string(),
    firmwareVersion: v.optional(v.string()),
    currentState: v.optional(
      v.object({
        pumpEnabled: v.boolean(),
        lightEnabled: v.boolean(),
      }),
    ),
    sensors: v.array(
      v.object({
        kind: v.union(
          v.literal('soil'),
          v.literal('light'),
          v.literal('temperature'),
          v.literal('air'),
          v.literal('water'),
        ),
        value: v.number(),
        unit: v.string(),
        raw: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const device = await ensureDeviceExists(ctx, args.deviceId, args.firmwareVersion)
    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const activePlant = plant && !plant.archived ? plant : null

    const currentSensors = await ctx.db
      .query('sensors')
      .withIndex('by_device', (q) => q.eq('deviceId', device._id))
      .collect()

    const sensorState = new Map<string, { value: number; unit: string }>()
    const existingSensorByKind = new Map<string, SensorDoc>()
    for (const sensor of currentSensors) {
      sensorState.set(sensor.kind, { value: sensor.value, unit: sensor.unit })
      existingSensorByKind.set(sensor.kind, sensor)
    }

    const now = Date.now()
    let updated = 0
    const deviceUpdates: Record<string, boolean | number | string | undefined> = {
      lastSeen: now,
      updatedAt: now,
      firmwareVersion: args.firmwareVersion?.trim() || device.firmwareVersion,
    }

    if (args.currentState) {
      deviceUpdates.reportedPumpEnabled = args.currentState.pumpEnabled
      deviceUpdates.reportedLightEnabled = args.currentState.lightEnabled
      deviceUpdates.lastStateSyncAt = now
    }

    for (const sensorUpdate of args.sensors) {
      const unit = sensorUpdate.unit.trim()
      const value =
        typeof sensorUpdate.raw === 'number' &&
        (sensorUpdate.kind === 'soil' ||
          sensorUpdate.kind === 'light' ||
          sensorUpdate.kind === 'water')
          ? normalizeRawSensorValue(sensorUpdate.kind as SensorKind, sensorUpdate.raw)
          : sensorUpdate.value

      sensorState.set(sensorUpdate.kind, { value, unit })

      const existingSensor = existingSensorByKind.get(sensorUpdate.kind)

      if (existingSensor) {
        await ctx.db.patch(existingSensor._id, {
          plantId: activePlant?._id,
          value,
          unit,
          raw: sensorUpdate.raw,
          measuredAt: now,
        })
      } else {
        await ctx.db.insert('sensors', {
          deviceId: device._id,
          plantId: activePlant?._id,
          kind: sensorUpdate.kind,
          value,
          unit,
          raw: sensorUpdate.raw,
          measuredAt: now,
          createdAt: now,
        })
      }

      await ctx.db.insert('sensorReadings', {
        deviceId: device._id,
        plantId: activePlant?._id,
        kind: sensorUpdate.kind,
        value,
        unit,
        raw: sensorUpdate.raw,
        measuredAt: now,
      })

      const previousValue = existingSensor?.value
      const shouldRecordSensorEvent =
        previousValue === undefined || Math.abs(previousValue - value) >= 5
      if (shouldRecordSensorEvent) {
        await recordGrowEvent(ctx, {
          deviceId: device._id,
          plantId: activePlant?._id,
          source: 'device',
          entityType: 'sensor',
          eventType: 'sensor_recorded',
          title: 'Telemetri dicatat',
          detail: `Sensor ${sensorUpdate.kind} diperbarui ke ${value}${unit}.`,
          data: {
            kind: sensorUpdate.kind,
            value,
            previousValue: previousValue ?? 'none',
          },
          timestamp: now,
        })
      }

      updated += 1
    }

    const soilValue = sensorState.get('soil')?.value
    const lightValue = sensorState.get('light')?.value
    const waterLevel = sensorState.get('water')?.value
    const effectiveWateringThreshold = activePlant?.wateringThreshold ?? device.wateringThreshold
    const effectiveLightingThreshold = activePlant?.lightingThreshold ?? device.lightingThreshold

    if (
      device.autoWatering &&
      soilValue !== undefined &&
      soilValue < effectiveWateringThreshold &&
      (waterLevel === undefined || waterLevel > 5)
    ) {
      const cooldownMs = device.wateringCooldown * 1000
      const cooledDown = !device.lastWatered || now - device.lastWatered >= cooldownMs

      if (cooledDown) {
        deviceUpdates.lastWatered = now
        Object.assign(deviceUpdates, buildQueuedPumpAction(device, device.wateringDuration))

        if (activePlant) {
          await recordAutomationEvent(ctx, {
            deviceId: device._id,
            plantId: activePlant._id,
            action: 'pump_enabled',
            soilValue,
            threshold: effectiveWateringThreshold,
            duration: device.wateringDuration,
            timestamp: now,
          })

          await recordAutomationEvent(ctx, {
            deviceId: device._id,
            plantId: activePlant._id,
            action: 'pump_disabled',
            soilValue,
            threshold: effectiveWateringThreshold,
            duration: device.wateringDuration,
            timestamp: now + device.wateringDuration * 1000,
          })

          await recordGrowEvent(ctx, {
            deviceId: device._id,
            plantId: activePlant._id,
            source: 'automation',
            entityType: 'automation',
            eventType: 'automation_action_executed',
            title: 'Penyiraman otomatis dijadwalkan',
            detail: `${device.name} menjadwalkan penyiraman karena kelembapan tanah di bawah ambang batas.`,
            data: {
              soilValue,
              threshold: effectiveWateringThreshold,
              duration: device.wateringDuration,
            },
            timestamp: now,
          })
        }
      }
    }

    if (device.autoLighting && lightValue !== undefined) {
      const currentLightDesired =
        typeof deviceUpdates.lightEnabled === 'boolean'
          ? Boolean(deviceUpdates.lightEnabled)
          : device.lightEnabled
      const shouldEnableLight = !currentLightDesired && lightValue < effectiveLightingThreshold
      const shouldDisableLight =
        currentLightDesired && lightValue > effectiveLightingThreshold + device.lightingHysteresis

      if (shouldEnableLight || shouldDisableLight) {
        const nextLightEnabled = shouldEnableLight
        deviceUpdates.lightEnabled = nextLightEnabled
        deviceUpdates.lastLightChange = now
        Object.assign(deviceUpdates, buildQueuedLightAction(device, nextLightEnabled))

        if (activePlant) {
          await recordAutomationEvent(ctx, {
            deviceId: device._id,
            plantId: activePlant._id,
            action: nextLightEnabled ? 'light_on' : 'light_off',
            lightValue,
            threshold: effectiveLightingThreshold,
            timestamp: now,
          })

          await recordGrowEvent(ctx, {
            deviceId: device._id,
            plantId: activePlant._id,
            source: 'automation',
            entityType: 'automation',
            eventType: 'automation_action_executed',
            title: 'Status lampu tumbuh diperbarui',
            detail: nextLightEnabled
              ? `${device.name} meminta lampu tumbuh menyala karena cahaya lingkungan terlalu rendah.`
              : `${device.name} meminta lampu tumbuh mati karena cahaya lingkungan sudah pulih.`,
            data: {
              lightValue,
              threshold: effectiveLightingThreshold,
              hysteresis: device.lightingHysteresis,
            },
            timestamp: now,
          })
        }
      }
    }

    await ctx.db.patch(device._id, deviceUpdates)

    const nextQueuedCommands = Object.prototype.hasOwnProperty.call(deviceUpdates, 'queuedCommands')
      ? (deviceUpdates.queuedCommands as unknown as import('./types').DeviceDoc['queuedCommands'])
      : getQueuedDeviceCommands(device)

    const commands = buildDeviceCommandList({
      ...device,
      queuedCommands: nextQueuedCommands,
    })

    return { success: true, updated, commands }
  },
})

export const clearDeliveredDeviceCommands = internalMutation({
  args: {
    deviceId: v.string(),
    commands: v.array(v.union(v.literal('pump'), v.literal('light'))),
  },
  handler: async (ctx, args) => {
    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device) {
      return { success: false, cleared: false }
    }

    const queuedCommands = getQueuedDeviceCommands(device)
    let cleared = false

    for (const command of args.commands) {
      if (command === 'pump' && queuedCommands.pump) {
        queuedCommands.pump = null
        cleared = true
      }
      if (command === 'light' && queuedCommands.light) {
        queuedCommands.light = null
        cleared = true
      }
    }

    if (!cleared) return { success: true, cleared: false }

    await ctx.db.patch(device._id, {
      queuedCommands,
      updatedAt: Date.now(),
    })

    return { success: true, cleared: true }
  },
})

export const updatePlantImage = internalMutation({
  args: {
    deviceId: v.string(),
    imageStorageId: v.id('_storage'),
    capturedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const device = await ensureDeviceExists(ctx, args.deviceId)
    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const activePlant = plant && !plant.archived ? plant : null
    const capturedAt = args.capturedAt ?? Date.now()

    await recordPlantImage(ctx, {
      plantId: activePlant?._id,
      deviceId: device._id,
      imageStorageId: args.imageStorageId,
      source: 'camera',
      capturedAt,
    })

    if (activePlant) {
      await ctx.db.patch(activePlant._id, {
        imageStorageId: args.imageStorageId,
        image: undefined,
        updatedAt: capturedAt,
      })

      await recordGrowEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        source: 'device',
        entityType: 'plant',
        eventType: 'plant_image_updated',
        title: 'Gambar tanaman diambil',
        detail: `${activePlant.name} menerima gambar baru dari kamera.`,
        timestamp: capturedAt,
      })
    }

    return { success: true, imageStorageId: args.imageStorageId }
  },
})
