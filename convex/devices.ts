import { v, ConvexError } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { getCurrentUser, requireUser } from './helpers/auth'
import {
  requireOwnedDevice, getSelectedDevice, getDeviceByExternalId,
} from './helpers/devices'
import {
  getUnclaimedDeviceCore, userDevicesCore,
  assignPlantCore, removeDeviceCore, updateAutomationCore, dashboardCore,
} from './devices/queries'
import { deviceHistoryCore, deviceGalleryImagesCore } from './devices/history'
import { plantSensorProfile, lifecycleProfileValidator } from './schema'

export const getUnclaimedDevice = query({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    return await getUnclaimedDeviceCore(ctx, args.deviceId)
  },
})

export const userDevices = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    return await userDevicesCore(ctx, user)
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
    fertilizingThreshold: v.optional(v.number()),
    fertilizerCadenceDays: v.optional(v.number()),
    pesticideCadenceDays: v.optional(v.number()),
    nutrientNotes: v.optional(v.string()),
    sensorProfile: v.optional(plantSensorProfile),
    lifecycleProfile: v.optional(lifecycleProfileValidator),
    location: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await requireOwnedDevice(ctx, user._id, args.deviceId)
    return await assignPlantCore(ctx, user, device, args)
  },
})

export const removeDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await requireOwnedDevice(ctx, user._id, args.deviceId)
    return await removeDeviceCore(ctx, user, device)
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
    // Hard bound: exactly one row per sensor kind (soil/light/temperature/air/
    // water/current = 6 max). take(10) freezes the ≤6-rows invariant with
    // headroom — never an unbounded read on this per-plant read path. View assembly
    // lives in ./devices/queries:dashboardCore.
    const rawSensors = plant && !plant.archived
      ? await ctx.db
        .query('sensors')
        .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
        .take(10)
      : []
    return await dashboardCore(ctx, user, device, plant, rawSensors)
  },
})

export const deviceHistory = query({
  args: {
    deviceId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) return null

    // Cursor-paginated archive, 20/page desc — mirrors the adminDevicesPaginated
    // convention in convex/admin.ts (paginationOptsValidator + paginate()).
    // Pre-alpha: the legacy uncapped full-list path is demolished; no
    // unpaginated export remains. Page mapping lives in
    // ./devices/history:deviceHistoryCore.
    const archivedPage = await ctx.db
      .query('plants')
      .withIndex('by_device_archived', (q) => q.eq('deviceId', device._id).eq('archived', true))
      .order('desc')
      .paginate(args.paginationOpts)
    return await deviceHistoryCore(ctx, device, archivedPage)
  },
})

export const deviceGalleryImages = query({
  args: {
    deviceId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) return []

    return await deviceGalleryImagesCore(ctx, device, args.limit ?? 24)
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
    autoFertilizing: v.optional(v.boolean()),
    autoPesticide: v.optional(v.boolean()),
    fertilizingThreshold: v.optional(v.number()),
    fertilizingDuration: v.optional(v.number()),
    fertilizingCooldown: v.optional(v.number()),
    pesticideThreshold: v.optional(v.number()),
    pesticideDuration: v.optional(v.number()),
    pesticideCooldown: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device =
      user.role === 'admin'
        ? await getDeviceByExternalId(ctx, args.deviceId)
        : await requireOwnedDevice(ctx, user._id, args.deviceId)
    if (!device) {
      throw new ConvexError('Perangkat tidak ditemukan')
    }

    const includesLowLevelAutomation =
      args.wateringThreshold !== undefined ||
      args.wateringDuration !== undefined ||
      args.wateringCooldown !== undefined ||
      args.lightingThreshold !== undefined ||
      args.lightingHysteresis !== undefined ||
      args.fertilizingThreshold !== undefined ||
      args.fertilizingDuration !== undefined ||
      args.fertilizingCooldown !== undefined ||
      args.pesticideThreshold !== undefined ||
      args.pesticideDuration !== undefined ||
      args.pesticideCooldown !== undefined

    if (includesLowLevelAutomation && user.role !== 'admin') {
      throw new ConvexError('Hanya admin yang dapat mengubah pengaturan teknis otomatisasi perangkat')
    }

    return await updateAutomationCore(ctx, user, device, args)
  },
})
