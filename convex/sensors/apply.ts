import { ConvexError } from 'convex/values'
import type { MutationCtx } from '../_generated/server'
import type { DeviceDoc, PlantDoc } from '../types'
import {
  getQueuedDeviceCommands, buildDeviceCommandList, buildQueuedPumpAction,
  buildQueuedLightAction, buildQueuedFertilizerAction, buildQueuedPesticideAction,
  stagedQueuedCommands,
} from '../helpers/devices'
import { recordGrowEvent, recordAutomationEvent } from '../helpers/events'
import type { V2FertilizingDecision, V2PesticideDecision } from '../helpers/v2sensors'

// Plain (non-Convex-function) helpers for the sensor ingest pipeline.
// Extracted verbatim from performIngest in ../sensors.ts: same thresholds,
// same events, same merge/ack semantics. Each apply* mutates deviceUpdates
// in place; finalizeIngest performs the patch + command-list + ack-clear.

export type DeviceUpdateValue = boolean | number | string | Record<string, unknown> | null | undefined

export type DeviceUpdates = Record<string, DeviceUpdateValue>

export type SensorState = Map<string, { value: number; unit: string }>

export interface WateringDecision {
  shouldWater: boolean
  cooledDown: boolean
  effectiveThreshold: number
  soilValue: number | undefined
  waterLevel: number | undefined
}

export interface LightingDecision {
  shouldActivate: boolean
  nextLightEnabled: boolean
  effectiveThreshold: number
  lightValue: number | undefined
}

export async function applyWateringRule(
  ctx: MutationCtx,
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: SensorState,
  deviceUpdates: DeviceUpdates,
  now: number,
  watering: WateringDecision,
): Promise<void> {
  void sensorState
  if (watering.shouldWater && watering.cooledDown) {
    deviceUpdates.lastWatered = now
    Object.assign(
      deviceUpdates,
      buildQueuedPumpAction(device, device.wateringDuration, stagedQueuedCommands(deviceUpdates, device)),
    )

    if (activePlant) {
      const soilValue = watering.soilValue
      if (soilValue === undefined) {
        throw new ConvexError('soilValue tidak tersedia untuk automation penyiraman')
      }
      await recordAutomationEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        action: 'pump_enabled',
        soilValue,
        threshold: watering.effectiveThreshold,
        duration: device.wateringDuration,
        timestamp: now,
      })

      await recordAutomationEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        action: 'pump_disabled',
        soilValue,
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
          soilValue,
          threshold: watering.effectiveThreshold,
          duration: device.wateringDuration,
        },
        timestamp: now,
      })
    }
  }
}

export async function applyFertilizingRule(
  ctx: MutationCtx,
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: SensorState,
  deviceUpdates: DeviceUpdates,
  now: number,
  fertilizing: V2FertilizingDecision,
): Promise<void> {
  void sensorState
  if (fertilizing.shouldFertilize && fertilizing.cooledDown) {
    deviceUpdates.lastFertilized = now
    Object.assign(
      deviceUpdates,
      buildQueuedFertilizerAction(device, device.fertilizingDuration, stagedQueuedCommands(deviceUpdates, device)),
    )
    Object.assign(
      deviceUpdates,
      buildQueuedPumpAction(device, device.fertilizingDuration, stagedQueuedCommands(deviceUpdates, device)),
    )

    if (activePlant) {
      const soilValue = fertilizing.soilValue
      if (soilValue === undefined) {
        throw new ConvexError('soilValue tidak tersedia untuk automation pemupukan')
      }
      await recordAutomationEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        action: 'fertilizer_opened',
        soilValue,
        threshold: fertilizing.effectiveThreshold,
        duration: device.fertilizingDuration,
        timestamp: now,
      })
      await recordAutomationEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        action: 'fertilizer_closed',
        soilValue,
        threshold: fertilizing.effectiveThreshold,
        duration: device.fertilizingDuration,
        timestamp: now + device.fertilizingDuration * 1000,
      })
      await recordGrowEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        source: 'automation',
        entityType: 'automation',
        eventType: 'automation_action_executed',
        title: 'Pemupukan otomatis dijadwalkan',
        detail: `${device.name} menjadwalkan pemupukan karena kelembapan tanah di bawah ambang batas.`,
        data: {
          soilValue,
          threshold: fertilizing.effectiveThreshold,
          duration: device.fertilizingDuration,
        },
        timestamp: now,
      })
    }
  }
}

export async function applyPesticideRule(
  ctx: MutationCtx,
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: SensorState,
  deviceUpdates: DeviceUpdates,
  now: number,
  pesticide: V2PesticideDecision,
): Promise<void> {
  void sensorState
  if (pesticide.shouldApply && pesticide.cooledDown) {
    deviceUpdates.lastPesticideApplied = now
    Object.assign(
      deviceUpdates,
      buildQueuedPesticideAction(device, device.pesticideDuration, stagedQueuedCommands(deviceUpdates, device)),
    )
    Object.assign(
      deviceUpdates,
      buildQueuedPumpAction(device, device.pesticideDuration, stagedQueuedCommands(deviceUpdates, device)),
    )

    if (activePlant) {
      await recordAutomationEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        action: 'pesticide_opened',
        threshold: device.pesticideThreshold,
        duration: device.pesticideDuration,
        timestamp: now,
      })
      await recordAutomationEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        action: 'pesticide_closed',
        threshold: device.pesticideThreshold,
        duration: device.pesticideDuration,
        timestamp: now + device.pesticideDuration * 1000,
      })
      await recordGrowEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        source: 'automation',
        entityType: 'automation',
        eventType: 'automation_action_executed',
        title: 'Pestisida otomatis dijadwalkan',
        detail: `${device.name} menjadwalkan aplikasi pestisida.`,
        data: {
          pestRisk: pesticide.pestRisk,
          threshold: device.pesticideThreshold,
          duration: device.pesticideDuration,
        },
        timestamp: now,
      })
    }
  }
}

export async function applyLightingRule(
  ctx: MutationCtx,
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: SensorState,
  deviceUpdates: DeviceUpdates,
  now: number,
  lighting: LightingDecision,
): Promise<void> {
  void sensorState
  if (lighting.shouldActivate) {
    deviceUpdates.lightEnabled = lighting.nextLightEnabled
    deviceUpdates.lastLightChange = now
    Object.assign(
      deviceUpdates,
      buildQueuedLightAction(device, lighting.nextLightEnabled, stagedQueuedCommands(deviceUpdates, device)),
    )

    if (activePlant) {
      const lightValue = lighting.lightValue
      if (lightValue === undefined) {
        throw new ConvexError('lightValue tidak tersedia untuk automation lampu tumbuh')
      }
      await recordAutomationEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant._id,
        action: lighting.nextLightEnabled ? 'light_on' : 'light_off',
        lightValue,
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
          lightValue,
          threshold: lighting.effectiveThreshold,
          hysteresis: device.lightingHysteresis,
        },
        timestamp: now,
      })
    }
  }
}

export async function finalizeIngest(
  ctx: MutationCtx,
  device: DeviceDoc,
  deviceUpdates: DeviceUpdates,
  opts: { ack: boolean },
): Promise<{ commands: ReturnType<typeof buildDeviceCommandList> }> {
  // Merge queuedCommands field-wise against a fresh read: staged (this
  // ingest) wins per-key when present, otherwise keep the stored value
  // (concurrent manual trigger). Prevents last-writer-wins wiping commands.
  if (Object.prototype.hasOwnProperty.call(deviceUpdates, 'queuedCommands')) {
    const staged = stagedQueuedCommands(deviceUpdates, device)
    const fresh: DeviceDoc | null = await ctx.db.get(device._id)
    const stored = fresh ? getQueuedDeviceCommands(fresh) : getQueuedDeviceCommands(device)
    deviceUpdates.queuedCommands = {
      pump: staged.pump ?? stored.pump ?? null,
      light: staged.light ?? stored.light ?? null,
      fertilizer: staged.fertilizer ?? stored.fertilizer ?? null,
      pesticide: staged.pesticide ?? stored.pesticide ?? null,
    }
  }

  await ctx.db.patch(device._id, deviceUpdates)

  const nextQueuedCommands = stagedQueuedCommands(deviceUpdates, device)

  const commands = buildDeviceCommandList({
    ...device,
    queuedCommands: nextQueuedCommands,
  })

  if (opts.ack && commands.length > 0) {
    // Ack-clear only the keys that were returned; preserve concurrently
    // queued commands for other keys (delayed ack after new queue).
    const freshBeforeAck: DeviceDoc | null = await ctx.db.get(device._id)
    const storedBeforeAck = freshBeforeAck
      ? getQueuedDeviceCommands(freshBeforeAck)
      : getQueuedDeviceCommands({ ...device, queuedCommands: nextQueuedCommands })
    const returnedKinds = new Set(commands.map((c) => c.kind))
    await ctx.db.patch(device._id, {
      queuedCommands: {
        pump: returnedKinds.has('pump') ? null : (storedBeforeAck.pump ?? null),
        light: returnedKinds.has('light') ? null : (storedBeforeAck.light ?? null),
        fertilizer: returnedKinds.has('fertilizer') ? null : (storedBeforeAck.fertilizer ?? null),
        pesticide: returnedKinds.has('pesticide') ? null : (storedBeforeAck.pesticide ?? null),
      },
      updatedAt: Date.now(),
    })
  }

  return { commands }
}
