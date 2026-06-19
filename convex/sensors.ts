import { v } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import type { DeviceDoc, PlantDoc, SensorDoc, SensorKind } from './types'
import {
  ensureDeviceExists, getQueuedDeviceCommands, buildDeviceCommandList, buildQueuedPumpAction,
  buildQueuedLightAction,
  normalizeRawSensorValue, recordGrowEvent, recordPlantImage,
  recordAutomationEvent, getDeviceByExternalId,
} from './helpers'

type DeviceUpdateValue = boolean | number | string | Record<string, unknown> | null | undefined

interface IngestionResult {
  sensorState: Map<string, { value: number; unit: string }>
  deviceUpdates: Record<string, DeviceUpdateValue>
  updated: number
}

interface WateringDecision {
  shouldWater: boolean
  cooledDown: boolean
  effectiveThreshold: number
  soilValue: number | undefined
  waterLevel: number | undefined
}

interface LightingDecision {
  shouldActivate: boolean
  nextLightEnabled: boolean
  effectiveThreshold: number
  lightValue: number | undefined
}

async function ingestSensorReadings(
  ctx: MutationCtx,
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensors: { kind: SensorKind; value: number; unit: string; raw?: number }[],
  now: number,
  currentState?: { pumpEnabled: boolean; lightEnabled: boolean },
  firmwareVersion?: string,
): Promise<IngestionResult> {
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

  let updated = 0
  const deviceUpdates: Record<string, DeviceUpdateValue> = {
    lastSeen: now,
    updatedAt: now,
    firmwareVersion: firmwareVersion?.trim() || device.firmwareVersion,
  }

  if (currentState) {
    deviceUpdates.reportedPumpEnabled = currentState.pumpEnabled
    deviceUpdates.reportedLightEnabled = currentState.lightEnabled
    deviceUpdates.lastStateSyncAt = now
  }

  for (const sensorUpdate of sensors) {
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

  return { sensorState, deviceUpdates, updated }
}

function evaluateWateringRule(
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: Map<string, { value: number; unit: string }>,
  now: number,
): WateringDecision {
  if (!device.autoWatering) {
    return { shouldWater: false, cooledDown: false, effectiveThreshold: 0, soilValue: undefined, waterLevel: undefined }
  }

  const soilValue = sensorState.get('soil')?.value
  const waterLevel = sensorState.get('water')?.value
  const effectiveThreshold = activePlant?.wateringThreshold ?? device.wateringThreshold

  if (soilValue === undefined || soilValue >= effectiveThreshold) {
    return { shouldWater: false, cooledDown: false, effectiveThreshold, soilValue, waterLevel }
  }

  if (waterLevel !== undefined && waterLevel <= 5) {
    return { shouldWater: false, cooledDown: false, effectiveThreshold, soilValue, waterLevel }
  }

  const cooldownMs = device.wateringCooldown * 1000
  const cooledDown = !device.lastWatered || now - device.lastWatered >= cooldownMs

  return { shouldWater: true, cooledDown, effectiveThreshold, soilValue, waterLevel }
}

function evaluateLightingRule(
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: Map<string, { value: number; unit: string }>,
  currentLightDesired: boolean,
): LightingDecision {
  if (!device.autoLighting) {
    return { shouldActivate: false, nextLightEnabled: false, effectiveThreshold: 0, lightValue: undefined }
  }

  const lightValue = sensorState.get('light')?.value
  const effectiveThreshold = activePlant?.lightingThreshold ?? device.lightingThreshold

  if (lightValue === undefined) {
    return { shouldActivate: false, nextLightEnabled: false, effectiveThreshold, lightValue }
  }

  const shouldEnableLight = !currentLightDesired && lightValue < effectiveThreshold
  const shouldDisableLight = currentLightDesired && lightValue > effectiveThreshold + device.lightingHysteresis
  const shouldActivate = shouldEnableLight || shouldDisableLight
  const nextLightEnabled = shouldEnableLight

  return { shouldActivate, nextLightEnabled, effectiveThreshold, lightValue }
}

export const ingestSensorData = mutation({
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
    const plant: PlantDoc | null = device.plantId ? await ctx.db.get(device.plantId) as PlantDoc | null : null
    const activePlant = plant && !plant.archived ? plant : null
    const now = Date.now()

    const { sensorState, deviceUpdates, updated } = await ingestSensorReadings(
      ctx, device, activePlant, args.sensors, now, args.currentState, args.firmwareVersion,
    )

    const watering = evaluateWateringRule(device, activePlant, sensorState, now)
    if (watering.shouldWater && watering.cooledDown) {
      deviceUpdates.lastWatered = now
      Object.assign(deviceUpdates, buildQueuedPumpAction(device, device.wateringDuration))

      if (activePlant) {
        await recordAutomationEvent(ctx, {
          deviceId: device._id,
          plantId: activePlant._id,
          action: 'pump_enabled',
          soilValue: watering.soilValue!,
          threshold: watering.effectiveThreshold,
          duration: device.wateringDuration,
          timestamp: now,
        })

        await recordAutomationEvent(ctx, {
          deviceId: device._id,
          plantId: activePlant._id,
          action: 'pump_disabled',
          soilValue: watering.soilValue!,
          threshold: watering.effectiveThreshold,
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
            soilValue: watering.soilValue!,
            threshold: watering.effectiveThreshold,
            duration: device.wateringDuration,
          },
          timestamp: now,
        })
      }
    }

    const currentLightDesired = typeof deviceUpdates.lightEnabled === 'boolean'
      ? Boolean(deviceUpdates.lightEnabled)
      : device.lightEnabled
    const lighting = evaluateLightingRule(device, activePlant, sensorState, currentLightDesired)
    if (lighting.shouldActivate) {
      deviceUpdates.lightEnabled = lighting.nextLightEnabled
      deviceUpdates.lastLightChange = now
      Object.assign(deviceUpdates, buildQueuedLightAction(device, lighting.nextLightEnabled))

      if (activePlant) {
        await recordAutomationEvent(ctx, {
          deviceId: device._id,
          plantId: activePlant._id,
          action: lighting.nextLightEnabled ? 'light_on' : 'light_off',
          lightValue: lighting.lightValue!,
          threshold: lighting.effectiveThreshold,
          timestamp: now,
        })

        await recordGrowEvent(ctx, {
          deviceId: device._id,
          plantId: activePlant._id,
          source: 'automation',
          entityType: 'automation',
          eventType: 'automation_action_executed',
          title: 'Status lampu tumbuh diperbarui',
          detail: lighting.nextLightEnabled
            ? `${device.name} meminta lampu tumbuh menyala karena cahaya lingkungan terlalu rendah.`
            : `${device.name} meminta lampu tumbuh mati karena cahaya lingkungan sudah pulih.`,
          data: {
            lightValue: lighting.lightValue!,
            threshold: lighting.effectiveThreshold,
            hysteresis: device.lightingHysteresis,
          },
          timestamp: now,
        })
      }
    }

    await ctx.db.patch(device._id, deviceUpdates)

    const nextQueuedCommands = Object.prototype.hasOwnProperty.call(deviceUpdates, 'queuedCommands')
      ? (deviceUpdates.queuedCommands as unknown as DeviceDoc['queuedCommands'])
      : getQueuedDeviceCommands(device)

    const commands = buildDeviceCommandList({
      ...device,
      queuedCommands: nextQueuedCommands,
    })

    return { success: true, updated, commands }
  },
})

export const clearDeviceCommands = mutation({
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

export const ingestCameraImage = mutation({
  args: {
    deviceId: v.string(),
    imageUrl: v.string(),
    capturedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const device = await ensureDeviceExists(ctx, args.deviceId)
    const plant: PlantDoc | null = device.plantId ? await ctx.db.get(device.plantId) as PlantDoc | null : null
    const activePlant = plant && !plant.archived ? plant : null
    const capturedAt = args.capturedAt ?? Date.now()

    await recordPlantImage(ctx, {
      plantId: activePlant?._id,
      deviceId: device._id,
      imageUrl: args.imageUrl,
      source: 'camera',
      capturedAt,
    })

    if (activePlant) {
      await ctx.db.patch(activePlant._id, {
        imageUrl: args.imageUrl,
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

    return { success: true, imageUrl: args.imageUrl }
  },
})
