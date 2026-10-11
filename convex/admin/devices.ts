import { ConvexError } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import {
  getDeviceWateringDuration, getDeviceWateringCooldown, getDeviceLightingHysteresis,
  getDeviceFertilizingDuration, getDeviceFertilizingCooldown,
  getDevicePesticideDuration, getDevicePesticideCooldown,
  getDeviceByExternalId, getDefaultDeviceName,
} from '../helpers/devices'
import { formatTimestamp, isDeviceOnline } from '../helpers/generic'
import {
  DEFAULT_FERTILIZING_THRESHOLD, DEFAULT_FERTILIZING_DURATION, DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_PESTICIDE_THRESHOLD, DEFAULT_PESTICIDE_DURATION, DEFAULT_PESTICIDE_COOLDOWN,
  DEFAULT_TANK_CAPACITY, DEFAULT_TANK_MIN_LEVEL,
  newCommandId,
} from '../types'
import { getQueuedDeviceCommands } from '../helpers/devices/queued'
import { batchGetPlants, batchGetUsers } from './stats'

// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates in
// ../admin.ts. Cores here perform pure DB logic.

// Device-list core: cursor-paginated, enriched to the full admin list-item
// shape (owner/plant names, automation config, connectivity) so the dashboard
// `data.devices` array keeps its fields after the legacy array query is gone.
export async function fetchAdminDevicesPaginated(
  ctx: QueryCtx,
  paginationOpts: { cursor: string | null; numItems: number },
) {
  const result = await ctx.db
    .query('devices')
    .withIndex('by_createdAt')
    .order('desc')
    .paginate(paginationOpts)
  const allPlantIds = result.page.map((d) => d.plantId)
  const plantMap = await batchGetPlants(ctx, allPlantIds)
  const allUserIds = result.page.map((d) => d.userId)
  const userMap = await batchGetUsers(ctx, allUserIds)
  return {
    ...result,
    page: result.page.map((device) => mapAdminDevice(device, userMap, plantMap)),
  }
}

type DeviceDoc = Doc<'devices'>

function mapAdminDevice(
  device: DeviceDoc,
  userMap: Map<string, Doc<'users'> | null>,
  plantMap: Map<string, Doc<'plants'> | null>,
) {
  const owner = device.userId ? userMap.get(String(device.userId)) : null
  const plant = device.plantId ? plantMap.get(String(device.plantId)) : null
  return {
    _id: device._id,
    deviceId: device.deviceId,
    name: device.name,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    firmwareVersion: device.firmwareVersion ?? '',
    isClaimed: Boolean(device.userId),
    plantName: plant && !plant.archived ? plant.name : null,
    autoWatering: device.autoWatering,
    autoLighting: device.autoLighting,
    wateringThreshold: device.wateringThreshold,
    wateringDuration: getDeviceWateringDuration(device),
    wateringCooldown: getDeviceWateringCooldown(device),
    lightingThreshold: device.lightingThreshold,
    lightingHysteresis: getDeviceLightingHysteresis(device),
    lastSeen: device.lastSeen,
    lastSeenLabel: formatTimestamp(device.lastSeen),
    isOnline: isDeviceOnline(device.lastSeen),
    version: device.version ?? 'v1',
    autoFertilizing: device.autoFertilizing,
    autoPesticide: device.autoPesticide,
    fertilizingThreshold: device.fertilizingThreshold,
    fertilizingDuration: getDeviceFertilizingDuration(device),
    fertilizingCooldown: getDeviceFertilizingCooldown(device),
    pesticideThreshold: device.pesticideThreshold,
    pesticideDuration: getDevicePesticideDuration(device),
    pesticideCooldown: getDevicePesticideCooldown(device),
    streamUrl: device.streamUrl,
    tankCapacity: device.tankCapacity,
    tankMinLevel: device.tankMinLevel,
    batteryCapacityAh: device.batteryCapacityAh,
    batterySoC: device.batterySoC,
    batteryCurrent: device.batteryCurrent,
    lastStreaming: device.lastStreaming ?? false,
    lastStreamFps: device.lastStreamFps ?? 0,
    reportedTankSwitchOpen: device.reportedTankSwitchOpen,
    reportedDrawerSwitchOpen: device.reportedDrawerSwitchOpen,
    modemImei: device.modemImei,
    solarPanelWatts: device.solarPanelWatts,
    hasModem: device.hasModem,
    hasSolarPanel: device.hasSolarPanel,
  }
}

export interface SaveAdminDeviceArgs {
  existingDeviceId?: Id<'devices'>
  deviceId: string
  name?: string
  firmwareVersion?: string
  version?: 'v1' | 'v2'
  autoWatering: boolean
  autoLighting: boolean
  wateringThreshold: number
  wateringDuration: number
  wateringCooldown: number
  lightingThreshold: number
  lightingHysteresis: number
  autoFertilizing?: boolean
  autoPesticide?: boolean
  fertilizingThreshold?: number
  fertilizingDuration?: number
  fertilizingCooldown?: number
  pesticideThreshold?: number
  pesticideDuration?: number
  pesticideCooldown?: number
  tankCapacity?: number
  tankMinLevel?: number
  batteryCapacityAh?: number
  hasModem?: boolean
  hasSolarPanel?: boolean
}

export async function saveAdminDevice(ctx: MutationCtx, args: SaveAdminDeviceArgs) {
  const now = Date.now()

  // Same charset the firmware enforces on claim ([A-Za-z0-9_-], ≤31):
  // reject admin-saved ids the devices would refuse to adopt.
  const trimmedDeviceId = args.deviceId.trim()
  if (!CLAIM_ID_RE.test(trimmedDeviceId)) {
    throw new ConvexError('claim must match [A-Za-z0-9_-] <=31')
  }

  const existingByDeviceId = await getDeviceByExternalId(ctx, trimmedDeviceId)
  if (existingByDeviceId && String(existingByDeviceId._id) !== String(args.existingDeviceId)) {
     throw new ConvexError('ID perangkat tersebut sudah digunakan')
  }

  const payload = {
    deviceId: trimmedDeviceId,
    name: args.name?.trim() || getDefaultDeviceName(trimmedDeviceId),
    firmwareVersion: args.firmwareVersion?.trim() || undefined,
    autoWatering: args.autoWatering,
    autoLighting: args.autoLighting,
    wateringThreshold: args.wateringThreshold,
    wateringDuration: args.wateringDuration,
    wateringCooldown: args.wateringCooldown,
    lightingThreshold: args.lightingThreshold,
    lightingHysteresis: args.lightingHysteresis,
    updatedAt: now,
  }

  const optional: {
    version?: 'v1' | 'v2'
    autoFertilizing?: boolean
    autoPesticide?: boolean
    fertilizingThreshold?: number
    fertilizingDuration?: number
    fertilizingCooldown?: number
    pesticideThreshold?: number
    pesticideDuration?: number
    pesticideCooldown?: number
    tankCapacity?: number
    tankMinLevel?: number
    batteryCapacityAh?: number
    hasModem?: boolean
    hasSolarPanel?: boolean
  } = {}
  if (args.version !== undefined) optional.version = args.version
  if (args.autoFertilizing !== undefined) optional.autoFertilizing = args.autoFertilizing
  if (args.autoPesticide !== undefined) optional.autoPesticide = args.autoPesticide
  if (args.fertilizingThreshold !== undefined) optional.fertilizingThreshold = args.fertilizingThreshold
  if (args.fertilizingDuration !== undefined) optional.fertilizingDuration = args.fertilizingDuration
  if (args.fertilizingCooldown !== undefined) optional.fertilizingCooldown = args.fertilizingCooldown
  if (args.pesticideThreshold !== undefined) optional.pesticideThreshold = args.pesticideThreshold
  if (args.pesticideDuration !== undefined) optional.pesticideDuration = args.pesticideDuration
  if (args.pesticideCooldown !== undefined) optional.pesticideCooldown = args.pesticideCooldown
  if (args.tankCapacity !== undefined) optional.tankCapacity = args.tankCapacity
  if (args.tankMinLevel !== undefined) optional.tankMinLevel = args.tankMinLevel
  if (args.batteryCapacityAh !== undefined) optional.batteryCapacityAh = args.batteryCapacityAh
  if (args.hasModem !== undefined) optional.hasModem = args.hasModem
  if (args.hasSolarPanel !== undefined) optional.hasSolarPanel = args.hasSolarPanel

  if (args.existingDeviceId) {
    const existing = await ctx.db.get(args.existingDeviceId)
    if (!existing) {
       throw new ConvexError('Perangkat tidak ditemukan')
    }

    await ctx.db.patch(args.existingDeviceId, { ...payload, ...optional })
    return { success: true, deviceId: args.existingDeviceId }
  }

  const deviceDocId = await ctx.db.insert('devices', {
    version: 'v1' as const,
    lightEnabled: false,
    queuedCommands: {
      pump: null,
      light: null,
      fertilizer: null,
      pesticide: null,
    },
    autoFertilizing: false,
    autoPesticide: false,
    fertilizingThreshold: DEFAULT_FERTILIZING_THRESHOLD,
    fertilizingDuration: DEFAULT_FERTILIZING_DURATION,
    fertilizingCooldown: DEFAULT_FERTILIZING_COOLDOWN,
    pesticideThreshold: DEFAULT_PESTICIDE_THRESHOLD,
    pesticideDuration: DEFAULT_PESTICIDE_DURATION,
    pesticideCooldown: DEFAULT_PESTICIDE_COOLDOWN,
    tankCapacity: DEFAULT_TANK_CAPACITY,
    tankMinLevel: DEFAULT_TANK_MIN_LEVEL,
    batteryCapacityAh: 5,
    batteryAccumulatedMah: 0,
    batterySoC: 50,
    hasModem: false,
    hasSolarPanel: false,
    lastSeen: now,
    createdAt: now,
    ...payload,
    ...optional,
  })

  return { success: true, deviceId: deviceDocId }
}

// Cascade batch size for device deletion. Every child-table loop below
// re-queries until a batch comes back empty, so datasets larger than one
// batch are fully drained.
const CASCADE_BATCH = 100

export async function deleteAdminDevice(ctx: MutationCtx, args: { deviceId: Id<'devices'> }) {
  const device = await ctx.db.get(args.deviceId)
  if (!device) {
    throw new ConvexError('Perangkat tidak ditemukan')
  }
  if (device.userId) {
    throw new ConvexError('Lepaskan klaim perangkat sebelum menghapus perangkat ini')
  }

  // Plants are only reachable via plantId for careSchedules and plant-keyed
  // events, so collect every plant id owned by this device first (paginated
  // until exhausted). The device's active-plant pointer is included
  // defensively in case it ever diverges from the by_device index.
  const plantIds = await collectDevicePlantIds(ctx, device._id)
  if (device.plantId && !plantIds.some((id) => String(id) === String(device.plantId))) {
    plantIds.push(device.plantId)
  }

  // Plant-keyed children first.
  for (const plantId of plantIds) {
    await deleteCareSchedulesByPlant(ctx, plantId)
    await deleteGrowEventsByPlant(ctx, plantId)
    await deleteAutomationLogsByPlant(ctx, plantId)
  }

  // Device-keyed children (each loop drains its table in batches).
  await deletePlantsByDevice(ctx, device._id)
  await deleteSensorsByDevice(ctx, device._id)
  await deleteSensorReadingsByDevice(ctx, device._id)
  await deletePlantImagesByDevice(ctx, device._id)
  await deleteVideoRecordingsByDevice(ctx, device._id)
  await deleteGrowEventsByDevice(ctx, device._id)
  await deleteAutomationLogsByDevice(ctx, device._id)

  await ctx.db.delete(args.deviceId)
  return { success: true }
}

async function collectDevicePlantIds(
  ctx: MutationCtx,
  deviceId: Id<'devices'>,
): Promise<Id<'plants'>[]> {
  const ids: Id<'plants'>[] = []
  let cursor: string | null = null
  while (true) {
    const page = await ctx.db
      .query('plants')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .paginate({ cursor, numItems: CASCADE_BATCH })
    for (const plant of page.page) ids.push(plant._id)
    if (page.isDone) break
    cursor = page.continueCursor
  }
  return ids
}

async function deletePlantsByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('plants')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deleteSensorsByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('sensors')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deleteSensorReadingsByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('sensorReadings')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deletePlantImagesByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('plantImages')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    for (const row of rows) {
      if (row.imageUrl) {
        await ctx.scheduler.runAfter(0, internal.crons.deletePlantImageS3Objects, {
          pathPrefix: row.imageUrl,
        })
      }
      await ctx.db.delete(row._id)
    }
  }
}

async function deleteVideoRecordingsByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('videoRecordings')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    for (const row of rows) {
      await ctx.scheduler.runAfter(0, internal.crons.deleteRecordingS3Object, { key: row.path })
      await ctx.db.delete(row._id)
    }
  }
}

async function deleteGrowEventsByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('growEvents')
      .withIndex('by_device_and_timestamp', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deleteGrowEventsByPlant(ctx: MutationCtx, plantId: Id<'plants'>) {
  while (true) {
    const rows = await ctx.db
      .query('growEvents')
      .withIndex('by_plant_and_timestamp', (q) => q.eq('plantId', plantId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deleteAutomationLogsByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('automationLogs')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deleteAutomationLogsByPlant(ctx: MutationCtx, plantId: Id<'plants'>) {
  while (true) {
    const rows = await ctx.db
      .query('automationLogs')
      .withIndex('by_plant', (q) => q.eq('plantId', plantId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deleteCareSchedulesByPlant(ctx: MutationCtx, plantId: Id<'plants'>) {
  while (true) {
    const rows = await ctx.db
      .query('careSchedules')
      .withIndex('by_plant', (q) => q.eq('plantId', plantId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

// ---------------------------------------------------------------------------
// Fleet operator staging (firmware contract 06-api + 08-server-changes).
// Staged values ride the NEXT sensor POST response for the named deviceId
// and are redelivered until the device acks (appliedConfigRev advance for
// config, new-deviceId report for claim) or the operator clears them.
// ---------------------------------------------------------------------------

const CLAIM_ID_RE = /^[A-Za-z0-9_-]{1,31}$/

async function requireDeviceByExternalId(ctx: MutationCtx, deviceId: string) {
  const device = await getDeviceByExternalId(ctx, deviceId.trim())
  if (!device) {
    throw new ConvexError('Perangkat tidak ditemukan')
  }
  return device
}

export async function stageDeviceConfig(
  ctx: MutationCtx,
  args: { deviceId: string; reportIntervalSec: number },
) {
  const device = await requireDeviceByExternalId(ctx, args.deviceId)
  const interval = args.reportIntervalSec
  if (!Number.isFinite(interval) || interval < 10 || interval > 3600) {
    throw new ConvexError('reportIntervalSec must be between 10-3600')
  }
  const rev = (device.pendingConfigRev ?? device.appliedConfigRev ?? 0) + 1
  await ctx.db.patch(device._id, {
    pendingConfigRev: rev,
    pendingReportIntervalSec: Math.round(interval),
    updatedAt: Date.now(),
  })
  return { success: true, rev, reportIntervalSec: Math.round(interval) }
}

export async function stageDeviceClaim(
  ctx: MutationCtx,
  args: { deviceId: string; claimDeviceId: string },
) {
  const device = await requireDeviceByExternalId(ctx, args.deviceId)
  const claim = args.claimDeviceId.trim()
  if (!CLAIM_ID_RE.test(claim)) {
    throw new ConvexError('claim must match [A-Za-z0-9_-] <=31')
  }
  const taken = await getDeviceByExternalId(ctx, claim)
  if (taken && String(taken._id) !== String(device._id)) {
    throw new ConvexError('ID perangkat tersebut sudah digunakan')
  }
  await ctx.db.patch(device._id, {
    pendingClaimDeviceId: claim,
    updatedAt: Date.now(),
  })
  return { success: true, claim }
}

export async function clearDeviceClaim(ctx: MutationCtx, args: { deviceId: string }) {
  const device = await requireDeviceByExternalId(ctx, args.deviceId)
  await ctx.db.patch(device._id, {
    pendingClaimDeviceId: undefined,
    updatedAt: Date.now(),
  })
  return { success: true }
}

export async function stageDeviceOta(
  ctx: MutationCtx,
  args: { deviceId: string; minFirmware: string; firmwareUrl: string },
) {
  const device = await requireDeviceByExternalId(ctx, args.deviceId)
  const minFirmware = args.minFirmware.trim()
  const firmwareUrl = args.firmwareUrl.trim()
  if (!minFirmware || !firmwareUrl) {
    throw new ConvexError('minFirmware + firmwareUrl required')
  }
  if (!firmwareUrl.startsWith('https://')) {
    throw new ConvexError('firmwareUrl must be https://')
  }
  if (minFirmware.length >= 32 || firmwareUrl.length >= 256) {
    throw new ConvexError('Firmware offer overlong (version <32, url <256)')
  }
  await ctx.db.patch(device._id, {
    otaMinFirmware: minFirmware,
    otaFirmwareUrl: firmwareUrl,
    updatedAt: Date.now(),
  })
  return { success: true }
}

export async function clearDeviceOta(ctx: MutationCtx, args: { deviceId: string }) {
  const device = await requireDeviceByExternalId(ctx, args.deviceId)
  await ctx.db.patch(device._id, {
    otaMinFirmware: undefined,
    otaFirmwareUrl: undefined,
    updatedAt: Date.now(),
  })
  return { success: true }
}

export interface QueueDeviceCommandArgs {
  deviceId: string
  kind: 'pump' | 'light' | 'fertilizer' | 'pesticide' | 'video_start' | 'video_stop'
  durationMs?: number
  enabled?: boolean
  width?: number
  height?: number
  fps?: number
  quality?: number
  maxSec?: number
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export async function queueDeviceCommand(ctx: MutationCtx, args: QueueDeviceCommandArgs) {
  const device = await requireDeviceByExternalId(ctx, args.deviceId)
  const queued = getQueuedDeviceCommands(device)
  const id = newCommandId()

  switch (args.kind) {
    case 'pump': {
      const dur = args.durationMs
      if (!isFiniteNumber(dur) || !(dur > 0) || dur > 30000) {
        throw new ConvexError('0 < durationMs <= 30000')
      }
      queued.pump = { kind: 'pump', durationMs: Math.round(dur), id }
      break
    }
    case 'fertilizer': {
      const dur = args.durationMs
      if (!isFiniteNumber(dur) || !(dur > 0) || dur > 30000) {
        throw new ConvexError('0 < durationMs <= 30000')
      }
      queued.fertilizer = { kind: 'fertilizer', durationMs: Math.round(dur), id }
      break
    }
    case 'pesticide': {
      const dur = args.durationMs
      if (!isFiniteNumber(dur) || !(dur > 0) || dur > 30000) {
        throw new ConvexError('0 < durationMs <= 30000')
      }
      queued.pesticide = { kind: 'pesticide', durationMs: Math.round(dur), id }
      break
    }
    case 'light': {
      const en = args.enabled
      if (typeof en !== 'boolean' && !(isFiniteNumber(en))) {
        throw new ConvexError('enabled must be bool or number')
      }
      queued.light = { kind: 'light', enabled: Boolean(en), id }
      break
    }
    case 'video_start': {
      const { width = 640, height = 480, fps = 5, quality = 70, maxSec = 300 } = args
      if (![320, 640, 1280].includes(width)) throw new ConvexError('width 320|640|1280')
      if (![240, 480, 720].includes(height)) throw new ConvexError('height 240|480|720')
      if (!Number.isInteger(fps) || fps < 1 || fps > 10) throw new ConvexError('fps 1-10')
      if (!Number.isInteger(quality) || quality < 50 || quality > 85) throw new ConvexError('quality 50-85')
      if (!Number.isInteger(maxSec) || maxSec < 5 || maxSec > 600) throw new ConvexError('maxSec 5-600')
      queued.videoStart = { kind: 'video_start', width, height, fps, quality, maxSec, id }
      queued.videoStop = null
      break
    }
    case 'video_stop': {
      queued.videoStart = null
      queued.videoStop = { kind: 'video_stop', id }
      break
    }
  }

  await ctx.db.patch(device._id, { queuedCommands: queued, updatedAt: Date.now() })
  switch (args.kind) {
    case 'pump':
      return { success: true, queued: queued.pump }
    case 'light':
      return { success: true, queued: queued.light }
    case 'fertilizer':
      return { success: true, queued: queued.fertilizer }
    case 'pesticide':
      return { success: true, queued: queued.pesticide }
    case 'video_start':
      return { success: true, queued: queued.videoStart }
    case 'video_stop':
      return { success: true, queued: queued.videoStop }
  }
}
