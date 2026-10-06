import { ConvexError } from 'convex/values'
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
} from '../types'
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
  streamUrl?: string
  tankCapacity?: number
  tankMinLevel?: number
  batteryCapacityAh?: number
  hasModem?: boolean
  hasSolarPanel?: boolean
}

export async function saveAdminDevice(ctx: MutationCtx, args: SaveAdminDeviceArgs) {
  const now = Date.now()

  const existingByDeviceId = await getDeviceByExternalId(ctx, args.deviceId.trim())
  if (existingByDeviceId && String(existingByDeviceId._id) !== String(args.existingDeviceId)) {
     throw new ConvexError('ID perangkat tersebut sudah digunakan')
  }

  const payload = {
    deviceId: args.deviceId.trim(),
    name: args.name?.trim() || getDefaultDeviceName(args.deviceId),
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
    streamUrl?: string
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
  if (args.streamUrl !== undefined) optional.streamUrl = args.streamUrl
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
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
  }
}

async function deleteVideoRecordingsByDevice(ctx: MutationCtx, deviceId: Id<'devices'>) {
  while (true) {
    const rows = await ctx.db
      .query('videoRecordings')
      .withIndex('by_device', (q) => q.eq('deviceId', deviceId))
      .take(CASCADE_BATCH)
    if (rows.length === 0) break
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)))
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
