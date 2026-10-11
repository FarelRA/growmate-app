import { v, ConvexError } from 'convex/values'
import { mutation, type MutationCtx } from './_generated/server'
import type { DeviceDoc, PlantDoc, SensorDoc, SensorKind } from './types'
import { MAX_SENSORS_PER_POST } from './types'
import {
  ensureDeviceExists, getQueuedDeviceCommands, ackQueuedCommands,
  getDeviceByExternalId,
} from './helpers/devices'
import { normalizeRawSensorValue, convertCurrentRawToMilliamps } from './helpers/generic'
import { recordGrowEvent, recordPlantImage } from './helpers/events'
import {
  evaluateFertilizingRule, evaluatePesticideRule, estimateBatterySoC,
} from './helpers/v2sensors'
import { shouldSkipSensorRecordedEvent } from './helpers/events'
import {
  applyWateringRule, applyFertilizingRule, applyPesticideRule, applyLightingRule,
  mergeQueuedCommands,
} from './sensors/apply'
import type { WateringDecision, LightingDecision } from './sensors/apply'

export { MAX_SENSORS_PER_POST }

// Device auth: all device-facing mutations below require `deviceKey: v.string()`.
// The expected value comes from the `DEVICE_API_KEY` env var, which MUST be set
// on the Convex deployment (self-hosted actions read container env). Nitro
// passes the key server-side; browsers never see it. Fail closed when unset.
// The device sends it as `Authorization: Bearer <token>`; Nitro also accepts
// the `x-api-key` tooling header and forwards the matched key here.

function assertDeviceKey(deviceKey: string) {
  const expected = process.env.DEVICE_API_KEY
  if (!expected) {
    throw new ConvexError('server misconfigured')
  }
  if (deviceKey !== expected) {
    throw new ConvexError('Unauthorized')
  }
}

import type { DeviceUpdates } from './sensors/apply'

interface IngestionResult {
  sensorState: Map<string, { value: number; unit: string }>
  deviceUpdates: DeviceUpdates
  updated: number
}

function clampAgeMs(ageMs: number, effectiveIntervalSec: number): number {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0
  return Math.min(ageMs, Math.max(45_000, effectiveIntervalSec * 3 * 1000))
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

async function ingestSensorReadings(
  ctx: MutationCtx,
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensors: { kind: SensorKind; value?: number; unit: string; raw?: number }[],
  sampleAt: number,
  now: number,
  currentState?: {
    pumpEnabled: boolean
    lightEnabled: boolean
    fertilizerEnabled?: boolean
    pesticideEnabled?: boolean
    tankSwitchOpen?: boolean
    drawerSwitchOpen?: boolean
    batteryCurrent?: number | null
    streaming?: boolean
    streamFps?: number
  },
  firmwareVersion?: string,
): Promise<IngestionResult> {
  // Hard bound: exactly one row per sensor kind (soil/light/temperature/air/
  // water/current = 6 max). take(10) freezes the ≤6-rows invariant with
  // headroom — never an unbounded read on this hot ingest path.
  const currentSensors = await ctx.db
    .query('sensors')
    .withIndex('by_device', (q) => q.eq('deviceId', device._id))
    .take(10)

  const recentSensorEvents: {
    eventType: string
    timestamp: number
    data?: Record<string, string | number | boolean>
  }[] = await ctx.db
    .query('growEvents')
    .withIndex('by_device_and_timestamp', (q) => q.eq('deviceId', device._id))
    .order('desc')
    .take(100)

  const sensorState = new Map<string, { value: number; unit: string }>()
  const existingSensorByKind = new Map<string, SensorDoc>()
  for (const sensor of currentSensors) {
    sensorState.set(sensor.kind, { value: sensor.value, unit: sensor.unit })
    existingSensorByKind.set(sensor.kind, sensor)
  }

  let updated = 0
  const deviceUpdates: DeviceUpdates = {
    lastSeen: now,
    updatedAt: now,
    firmwareVersion: firmwareVersion?.trim() || device.firmwareVersion,
  }

  if (currentState) {
    deviceUpdates.reportedPumpEnabled = currentState.pumpEnabled
    deviceUpdates.reportedLightEnabled = currentState.lightEnabled
    if (currentState.fertilizerEnabled !== undefined) {
      deviceUpdates.reportedFertilizerEnabled = currentState.fertilizerEnabled
    }
    if (currentState.pesticideEnabled !== undefined) {
      deviceUpdates.reportedPesticideEnabled = currentState.pesticideEnabled
    }
    if (currentState.tankSwitchOpen !== undefined) {
      deviceUpdates.reportedTankSwitchOpen = currentState.tankSwitchOpen
    }
    if (currentState.drawerSwitchOpen !== undefined) {
      deviceUpdates.reportedDrawerSwitchOpen = currentState.drawerSwitchOpen
    }
    // Firmware sends batteryCurrent: null always (RAW-only current rides
    // sensors[] kind=current). Only legacy/app clients send a number.
    if (isFiniteNumber(currentState.batteryCurrent)) {
      const timeDeltaMs = now - (device.lastBatteryReading ?? now)
      let prevAccumulated = device.batteryAccumulatedMah ?? 0

      // Full-charge detection: charging current near 0mA means battery is full
      // Reset accumulator and mark SoC as 100%
      if (currentState.batteryCurrent >= 0 && currentState.batteryCurrent < 50) {
        prevAccumulated = 0
        deviceUpdates.batteryAccumulatedMah = 0
        deviceUpdates.batterySoC = 100
        deviceUpdates.batteryLastFullCharge = now
      } else {
        const { accumulatedMah, soc } = estimateBatterySoC(
          currentState.batteryCurrent,
          prevAccumulated,
          device.batteryCapacityAh ?? 5,
          timeDeltaMs,
        )
        deviceUpdates.batteryAccumulatedMah = accumulatedMah
        deviceUpdates.batterySoC = soc
      }
      deviceUpdates.batteryCurrent = currentState.batteryCurrent
    }
    if (typeof currentState.streaming === 'boolean') {
      deviceUpdates.lastStreaming = currentState.streaming
    }
    if (isFiniteNumber(currentState.streamFps)) {
      deviceUpdates.lastStreamFps = currentState.streamFps
    }
    deviceUpdates.lastBatteryReading = now
    deviceUpdates.lastStateSyncAt = now
  }

  for (const sensorUpdate of sensors) {
    const unit = sensorUpdate.unit.trim()
    let value: number
    let storeUnit = unit
    if (sensorUpdate.kind === 'current') {
      // Tech current leg: raw-only A0 code, server converts to milliamps.
      const raw = sensorUpdate.raw ?? 0
      value = convertCurrentRawToMilliamps(raw)
      storeUnit = 'mA'
      // Feed the battery accumulator from the converted leg current.
      const timeDeltaMs = now - (device.lastBatteryReading ?? now)
      const { accumulatedMah, soc } = estimateBatterySoC(
        value,
        device.batteryAccumulatedMah ?? 0,
        device.batteryCapacityAh ?? 5,
        timeDeltaMs,
      )
      deviceUpdates.batteryCurrent = value
      deviceUpdates.batteryAccumulatedMah = accumulatedMah
      deviceUpdates.batterySoC = soc
      deviceUpdates.lastBatteryReading = now
    } else if (
      typeof sensorUpdate.raw === 'number' &&
      (sensorUpdate.kind === 'soil' ||
        sensorUpdate.kind === 'light' ||
        sensorUpdate.kind === 'water')
    ) {
      value = normalizeRawSensorValue(sensorUpdate.kind as SensorKind, sensorUpdate.raw, device.version)
    } else {
      value = sensorUpdate.value ?? 0
    }

    sensorState.set(sensorUpdate.kind, { value, unit: storeUnit })

    const existingSensor = existingSensorByKind.get(sensorUpdate.kind)

    if (existingSensor) {
      await ctx.db.patch(existingSensor._id, {
        plantId: activePlant?._id,
        value,
        unit: storeUnit,
        raw: sensorUpdate.raw,
        measuredAt: sampleAt,
      })
    } else {
      await ctx.db.insert('sensors', {
        deviceId: device._id,
        plantId: activePlant?._id,
        kind: sensorUpdate.kind,
        value,
        unit: storeUnit,
        raw: sensorUpdate.raw,
        measuredAt: sampleAt,
        createdAt: now,
      })
    }

    await ctx.db.insert('sensorReadings', {
      deviceId: device._id,
      plantId: activePlant?._id,
      kind: sensorUpdate.kind,
      value,
      unit: storeUnit,
      raw: sensorUpdate.raw,
      measuredAt: sampleAt,
    })

    const previousValue = existingSensor?.value
    const shouldRecordSensorEvent =
      previousValue === undefined || Math.abs(previousValue - value) >= 5
    if (
      shouldRecordSensorEvent &&
      activePlant &&
      !shouldSkipSensorRecordedEvent(recentSensorEvents, sensorUpdate.kind, now)
    ) {
      await recordGrowEvent(ctx, {
        deviceId: device._id,
        plantId: activePlant?._id,
        source: 'device',
        entityType: 'sensor',
        eventType: 'sensor_recorded',
        title: 'Telemetri dicatat',
        detail: `Sensor ${sensorUpdate.kind} diperbarui ke ${value}${storeUnit}.`,
        data: {
          kind: sensorUpdate.kind,
          value,
          previousValue: previousValue ?? 'none',
        },
        timestamp: now,
      })
      recentSensorEvents.push({
        eventType: 'sensor_recorded',
        timestamp: now,
        data: {
          kind: sensorUpdate.kind,
          value,
          previousValue: previousValue ?? 'none',
        },
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

const deviceSensorEntry = v.object({
  kind: v.union(
    v.literal('soil'),
    v.literal('light'),
    v.literal('temperature'),
    v.literal('air'),
    v.literal('water'),
    v.literal('current'),
  ),
  value: v.optional(v.number()),
  unit: v.string(),
  raw: v.optional(v.number()),
})

const ingestSensorDataArgs = {
  deviceKey: v.string(),
  deviceId: v.string(),
  firmwareVersion: v.optional(v.string()),
  hardwareId: v.optional(v.string()),
  // Tech envelopes always carry variant (tech | tech-addon); pods send none.
  // Closed union: unknown variants fail closed instead of forking rows.
  variant: v.optional(v.union(v.literal('tech'), v.literal('tech-addon'))),
  snapshotId: v.optional(v.string()),
  ageMs: v.optional(v.number()),
  appliedConfigRev: v.optional(v.number()),
  acceptedCommandIds: v.optional(v.array(v.string())),
  currentState: v.optional(
    v.object({
      pumpEnabled: v.boolean(),
      lightEnabled: v.boolean(),
      fertilizerEnabled: v.optional(v.boolean()),
      pesticideEnabled: v.optional(v.boolean()),
      tankSwitchOpen: v.optional(v.boolean()),
      drawerSwitchOpen: v.optional(v.boolean()),
      batteryCurrent: v.optional(v.union(v.number(), v.null())),
      batteryAccumulatedMah: v.optional(v.number()),
      streaming: v.optional(v.boolean()),
      streamFps: v.optional(v.number()),
    }),
  ),
  health: v.optional(
    v.object({
      heapFree: v.optional(v.number()),
      rssi: v.optional(v.number()),
      uptimeS: v.optional(v.number()),
      bootCount: v.optional(v.number()),
      resetReason: v.optional(v.string()),
      dhtFails: v.optional(v.number()),
      adcFails: v.optional(v.number()),
    }),
  ),
  sensors: v.array(deviceSensorEntry),
}

type IngestSensorDataArgs = {
  deviceKey: string
  deviceId: string
  firmwareVersion?: string
  hardwareId?: string
  variant?: 'tech' | 'tech-addon'
  snapshotId?: string
  ageMs?: number
  appliedConfigRev?: number
  acceptedCommandIds?: string[]
  currentState?: {
    pumpEnabled: boolean
    lightEnabled: boolean
    fertilizerEnabled?: boolean
    pesticideEnabled?: boolean
    tankSwitchOpen?: boolean
    drawerSwitchOpen?: boolean
    batteryCurrent?: number | null
    batteryAccumulatedMah?: number
    streaming?: boolean
    streamFps?: number
  }
  health?: {
    heapFree?: number
    rssi?: number
    uptimeS?: number
    bootCount?: number
    resetReason?: string
    dhtFails?: number
    adcFails?: number
  }
  sensors: { kind: SensorKind; value?: number; unit: string; raw?: number }[]
}

function assertSensorCap(sensors: unknown[]) {
  if (sensors.length > MAX_SENSORS_PER_POST) {
    throw new ConvexError(`Maksimal ${MAX_SENSORS_PER_POST} sensor per permintaan`)
  }
}

const DEVICE_ID_RE = /^[A-Za-z0-9_-]{1,31}$/

async function performIngest(
  ctx: MutationCtx,
  args: IngestSensorDataArgs,
) {
    // Identity resolution: hardwareId is the immutable birth identity (MAC
    // hex, always sent), deviceId is the renameable effective identity.
    // Resolve via hardwareId FIRST: a claimed unit reports its NEW deviceId
    // with the SAME hardwareId, so history follows the rename instead of
    // forking a fresh row. Resolving by deviceId first would ingest into the
    // wrong row when the new id collides with an existing one.
    const externalId = args.deviceId.trim()
    if (!DEVICE_ID_RE.test(externalId)) {
      throw new ConvexError('deviceId tidak valid')
    }
    let device: DeviceDoc | null = null
    if (args.hardwareId) {
      device = await ctx.db
        .query('devices')
        .withIndex('by_hardwareId', (q) => q.eq('hardwareId', args.hardwareId))
        .first() ?? null
      if (device && device.deviceId !== externalId) {
        const taken = await getDeviceByExternalId(ctx, externalId)
        if (taken && String(taken._id) !== String(device._id)) {
          throw new ConvexError('ID perangkat tersebut sudah digunakan')
        }
        await ctx.db.patch(device._id, {
          deviceId: externalId,
          updatedAt: Date.now(),
        })
        device = (await ctx.db.get(device._id))!
      }
    }
    if (!device) {
      device = await getDeviceByExternalId(ctx, externalId)
    }
    if (!device) {
      device = await ensureDeviceExists(ctx, externalId, args.firmwareVersion, args.variant)
    }
    if (!device) {
      throw new ConvexError('Perangkat tidak ditemukan')
    }
    if (device.version !== 'v1' && device.version !== 'v2') {
      throw new ConvexError(`Unknown device version: ${String(device.version)}`)
    }
    const plant: PlantDoc | null = device.plantId ? await ctx.db.get(device.plantId) : null
    const activePlant = plant && !plant.archived ? plant : null
    const now = Date.now()

    // Variant patching: tech envelopes always carry variant, pods send none.
    // Patch variant AND version together — a pre-variant v1 row that starts
    // reporting variant is a tech unit and must join the v2 automation
    // branch. Pods (no variant) never touch either field: no downgrades.
    const patchIdentity: Record<string, string | number> = { updatedAt: now }
    if (args.hardwareId && !device.hardwareId) {
      patchIdentity.hardwareId = args.hardwareId
    }
    if (args.variant && device.variant !== args.variant) {
      patchIdentity.variant = args.variant
    }
    if (args.variant && device.version !== 'v2') {
      patchIdentity.version = 'v2'
    }
    if (Object.keys(patchIdentity).length > 1) {
      await ctx.db.patch(device._id, patchIdentity)
      device = (await ctx.db.get(device._id))!
    }

    // At-least-once ack (device rule): drop every queued command whose id
    // the device echoed in acceptedCommandIds. Delivery is redriven below
    // until acked or superseded — never cleared merely for being sent.
    const acceptedIds = args.acceptedCommandIds ?? []
    if (acceptedIds.length > 0) {
      const { queued } = ackQueuedCommands(getQueuedDeviceCommands(device), acceptedIds)
      await ctx.db.patch(device._id, { queuedCommands: queued, updatedAt: now })
      device = (await ctx.db.get(device._id))!
    }

    if (typeof args.appliedConfigRev === 'number' && Number.isInteger(args.appliedConfigRev) && args.appliedConfigRev >= 0) {
      await ctx.db.patch(device._id, { appliedConfigRev: args.appliedConfigRev, updatedAt: now })
      device = (await ctx.db.get(device._id))!
    }

    // At-least-once dedup (device rule): the same snapshotId must never
    // double-count. Duplicate POSTs still ack and still receive pending
    // commands/config/claim below.
    let duplicate = false
    if (args.snapshotId) {
      const seen = await ctx.db
        .query('deviceSnapshots')
        .withIndex('by_device_and_snapshot', (q) =>
          q.eq('deviceId', device!._id).eq('snapshotId', args.snapshotId!),
        )
        .first()
      if (seen) {
        duplicate = true
      } else {
        await ctx.db.insert('deviceSnapshots', {
          deviceId: device._id,
          snapshotId: args.snapshotId,
          receivedAt: now,
        })
      }
    }

    const effectiveIntervalSec =
      device.pendingReportIntervalSec ?? (device.version === 'v2' ? 60 : 15)
    const sampleAt = now - clampAgeMs(args.ageMs ?? 0, effectiveIntervalSec)

    let sensorState = new Map<string, { value: number; unit: string }>()
    let deviceUpdates: DeviceUpdates = { lastSeen: now, updatedAt: now }
    if (!duplicate) {
      const result = await ingestSensorReadings(
        ctx, device, activePlant, args.sensors, sampleAt, now, args.currentState, args.firmwareVersion,
      )
      sensorState = result.sensorState
      deviceUpdates = result.deviceUpdates
    } else {
      deviceUpdates = {
        lastSeen: now,
        updatedAt: now,
        firmwareVersion: args.firmwareVersion?.trim() || device.firmwareVersion,
      }
      // Rebuild sensor state from the latest stored rows so automation
      // evaluates on current values even for duplicate deliveries. Same
      // ≤6-rows bound as the ingest path above.
      const currentSensors = await ctx.db
        .query('sensors')
        .withIndex('by_device', (q) => q.eq('deviceId', device!._id))
        .take(10)
      for (const s of currentSensors) {
        sensorState.set(s.kind, { value: s.value, unit: s.unit })
      }
    }

    if (args.snapshotId) deviceUpdates.lastSnapshotId = args.snapshotId
    if (typeof args.ageMs === 'number') deviceUpdates.lastAgeMs = args.ageMs
    deviceUpdates.lastSampleAt = sampleAt
    if (args.health) {
      if (isFiniteNumber(args.health.rssi)) deviceUpdates.lastRssi = args.health.rssi
      if (isFiniteNumber(args.health.bootCount)) deviceUpdates.lastBootCount = args.health.bootCount
      if (typeof args.health.resetReason === 'string') deviceUpdates.lastResetReason = args.health.resetReason
      if (isFiniteNumber(args.health.heapFree)) deviceUpdates.lastHeapFree = args.health.heapFree
      if (isFiniteNumber(args.health.uptimeS)) deviceUpdates.lastUptimeS = args.health.uptimeS
      if (isFiniteNumber(args.health.dhtFails)) deviceUpdates.lastDhtFails = args.health.dhtFails
      if (isFiniteNumber(args.health.adcFails)) deviceUpdates.lastAdcFails = args.health.adcFails
    }

    const watering: WateringDecision = duplicate
      ? { shouldWater: false, cooledDown: false, effectiveThreshold: 0, soilValue: undefined, waterLevel: undefined }
      : evaluateWateringRule(device, activePlant, sensorState, now)
    if (!duplicate) {
      await applyWateringRule(ctx, device, activePlant, sensorState, deviceUpdates, now, watering)
    }

    if (device.version === 'v2') {
      // V2-specific: fertilizing + pesticide rules
      // V2 has no grow light — skip lighting evaluation
      if (!duplicate) {
        const fertilizing = evaluateFertilizingRule(device, activePlant, sensorState, now)
        await applyFertilizingRule(ctx, device, activePlant, sensorState, deviceUpdates, now, fertilizing)

        const pesticide = evaluatePesticideRule(device, activePlant, sensorState, now)
        await applyPesticideRule(ctx, device, activePlant, sensorState, deviceUpdates, now, pesticide)
      }
    } else {
      // V1-specific: lighting
      if (!duplicate) {
        const currentLightDesired = typeof deviceUpdates.lightEnabled === 'boolean'
          ? Boolean(deviceUpdates.lightEnabled)
          : device.lightEnabled
        const lighting: LightingDecision = evaluateLightingRule(device, activePlant, sensorState, currentLightDesired)
        await applyLightingRule(ctx, device, activePlant, sensorState, deviceUpdates, now, lighting)
      }
    }

    // Merge staged automation queues field-wise against a fresh read so a
    // concurrent manual trigger is preserved. No ack-clear here: commands
    // stay queued until the device echoes their id in acceptedCommandIds.
    const merged = await mergeQueuedCommands(ctx, device, deviceUpdates)
    await ctx.db.patch(device._id, { ...deviceUpdates, queuedCommands: merged, updatedAt: now })
    device = (await ctx.db.get(device._id))!

    const commands = buildDeviceResponseCommands(device)

    const response: {
      commands: ReturnType<typeof buildDeviceResponseCommands>
      config?: { rev: number; reportIntervalSec: number }
      claim?: { deviceId: string }
      minFirmware?: string
      firmwareUrl?: string
    } = { commands }

    const appliedRev = device.appliedConfigRev ?? args.appliedConfigRev ?? 0
    if (
      device.pendingConfigRev !== undefined &&
      device.pendingConfigRev >= 1 &&
      device.pendingConfigRev > appliedRev &&
      device.pendingReportIntervalSec !== undefined
    ) {
      response.config = {
        rev: device.pendingConfigRev,
        reportIntervalSec: device.pendingReportIntervalSec,
      }
    }

    if (
      device.pendingClaimDeviceId &&
      DEVICE_ID_RE.test(device.pendingClaimDeviceId) &&
      device.pendingClaimDeviceId !== device.deviceId
    ) {
      response.claim = { deviceId: device.pendingClaimDeviceId }
    }

    if (device.otaMinFirmware && device.otaFirmwareUrl) {
      response.minFirmware = device.otaMinFirmware
      response.firmwareUrl = device.otaFirmwareUrl
    }

    // Device response buffer is ~3KB: never exceed it. Convex isolates have
    // no Node Buffer — measure with TextEncoder instead.
    if (responseByteLength(response) > 3072 && response.commands.length > 1) {
      response.commands = response.commands.slice(0, 1)
    }

    return response
}

function responseByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length
}

function buildDeviceResponseCommands(device: DeviceDoc) {
  const queued = getQueuedDeviceCommands(device)
  const out: Record<string, unknown>[] = []
  // Pump XOR light is SERVER-PACED on pods (v1): never send both in one
  // response — combined stall browns out the 4A boost (06-api). Tech legs
  // run independent per-channel timers and may combine pump+fert+pest.
  // Gate on version only: v1 rows never carry a variant, and any varianted
  // row is promoted to v2 on ingest, so variant sniffing here would split
  // the branch and risk pacing the wrong family.
  const isPods = device.version === 'v1'
  const pump = queued.pump && queued.pump.id
    ? { kind: 'pump', durationMs: queued.pump.durationMs, id: queued.pump.id }
    : null
  const light = queued.light && queued.light.id
    ? { kind: 'light', enabled: queued.light.enabled, id: queued.light.id }
    : null
  if (isPods && pump && light) {
    out.push(pump)
  } else {
    if (pump) out.push(pump)
    if (light) out.push(light)
  }
  if (queued.fertilizer && queued.fertilizer.id) {
    out.push({ kind: 'fertilizer', durationMs: queued.fertilizer.durationMs, id: queued.fertilizer.id })
  }
  if (queued.pesticide && queued.pesticide.id) {
    out.push({ kind: 'pesticide', durationMs: queued.pesticide.durationMs, id: queued.pesticide.id })
  }
  if (queued.videoStart) {
    out.push({ ...queued.videoStart })
  }
  if (queued.videoStop) {
    out.push({ ...queued.videoStop })
  }
  return out
}

export const ingestAndAckSensorData = mutation({
  args: ingestSensorDataArgs,
  handler: async (ctx, args) => {
    assertDeviceKey(args.deviceKey)
    assertSensorCap(args.sensors)
    return await performIngest(ctx, args)
  },
})

export const clearDeviceCommands = mutation({
  args: {
    deviceKey: v.string(),
    deviceId: v.string(),
    commands: v.array(v.union(
      v.literal('pump'),
      v.literal('light'),
      v.literal('fertilizer'),
      v.literal('pesticide'),
      v.literal('video_start'),
      v.literal('video_stop'),
    )),
  },
  handler: async (ctx, args) => {
    assertDeviceKey(args.deviceKey)
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
      if (command === 'fertilizer' && queuedCommands.fertilizer) {
        queuedCommands.fertilizer = null
        cleared = true
      }
      if (command === 'pesticide' && queuedCommands.pesticide) {
        queuedCommands.pesticide = null
        cleared = true
      }
      if (command === 'video_start' && queuedCommands.videoStart) {
        queuedCommands.videoStart = null
        cleared = true
      }
      if (command === 'video_stop' && queuedCommands.videoStop) {
        queuedCommands.videoStop = null
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
    deviceKey: v.string(),
    deviceId: v.string(),
    imageUrl: v.string(),
    capturedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertDeviceKey(args.deviceKey)
    const device = await ensureDeviceExists(ctx, args.deviceId)
    const plant: PlantDoc | null = device.plantId ? await ctx.db.get(device.plantId) : null
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
