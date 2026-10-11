import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { requireAdmin } from './helpers/auth'
import { plantSensorProfile, lifecycleProfileValidator } from './schema'
import { fetchAdminStats, fetchAdminRecentEvents } from './admin/stats'
import {
  fetchAdminDevicesPaginated, saveAdminDevice, deleteAdminDevice,
  stageDeviceConfig, stageDeviceClaim, clearDeviceClaim,
  stageDeviceOta, clearDeviceOta, queueDeviceCommand,
} from './admin/devices'
import { fetchAdminSupportPaginated } from './admin/support'
import {
  fetchAdminProductsPaginated, saveOfficialProduct, updateOfficialProductStatus, deleteOfficialProduct,
} from './admin/products'
import { fetchAdminPlantCatalogPaginated, savePlantPreset, deletePlantPreset } from './admin/plants'
import { fetchAdminBlogPostsPaginated } from './admin/blog'
import { fetchAdminUsersPaginated, updateUserAccess } from './admin/users'

// ADMIN MODULE MAP (paginated-only lists — every `api.admin.*` list query is
// cursor-paginated; the pre-alpha array-returning list queries are deleted):
//   convex/admin/stats.ts    — batchGetUsers/batchGetPlants, countAllPaginated,
//                              fetchAdminStats, fetchAdminRecentEvents
//   convex/admin/devices.ts  — fetchAdminDevicesPaginated, save/delete device
//                              (delete cascades to all device/plant children)
//   convex/admin/support.ts  — fetchAdminSupportPaginated (enriched tickets)
//   convex/admin/products.ts — fetchAdminProductsPaginated, save/status/delete official product
//   convex/admin/plants.ts   — normalizePlantPresetKey, fetchAdminPlantCatalogPaginated,
//                              save/delete plant preset
//   convex/admin/blog.ts     — fetchAdminBlogPostsPaginated
//   convex/admin/users.ts    — fetchAdminUsersPaginated, updateUserAccess
// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates below
// (auth stays at the API boundary). Cores in convex/admin/* perform pure DB
// logic and never call requireAdmin themselves; where a core needs the admin
// identity as data (sellerId, self-demotion guard), the delegate passes the
// already-authorized `admin._id`.

export const adminStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return fetchAdminStats(ctx)
  },
})

export const adminRecentEvents = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return fetchAdminRecentEvents(ctx)
  },
})

export const adminDevicesPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return fetchAdminDevicesPaginated(ctx, args.paginationOpts)
  },
})

export const adminSupportPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return fetchAdminSupportPaginated(ctx, args.paginationOpts)
  },
})

export const adminProductsPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    return fetchAdminProductsPaginated(ctx, admin._id, args.paginationOpts)
  },
})

export const adminPlantCatalogPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return fetchAdminPlantCatalogPaginated(ctx, args.paginationOpts)
  },
})

export const adminBlogPostsPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return fetchAdminBlogPostsPaginated(ctx, args.paginationOpts)
  },
})

export const adminUsersPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return fetchAdminUsersPaginated(ctx, args.paginationOpts)
  },
})

export const adminSaveDevice = mutation({
  args: {
    existingDeviceId: v.optional(v.id('devices')),
    deviceId: v.string(),
    name: v.optional(v.string()),
    firmwareVersion: v.optional(v.string()),
    version: v.optional(v.union(v.literal('v1'), v.literal('v2'))),
    autoWatering: v.boolean(),
    autoLighting: v.boolean(),
    wateringThreshold: v.number(),
    wateringDuration: v.number(),
    wateringCooldown: v.number(),
    lightingThreshold: v.number(),
    lightingHysteresis: v.number(),
    autoFertilizing: v.optional(v.boolean()),
    autoPesticide: v.optional(v.boolean()),
    fertilizingThreshold: v.optional(v.number()),
    fertilizingDuration: v.optional(v.number()),
    fertilizingCooldown: v.optional(v.number()),
    pesticideThreshold: v.optional(v.number()),
    pesticideDuration: v.optional(v.number()),
    pesticideCooldown: v.optional(v.number()),
    streamUrl: v.optional(v.string()),
    tankCapacity: v.optional(v.number()),
    tankMinLevel: v.optional(v.number()),
    batteryCapacityAh: v.optional(v.number()),
    hasModem: v.optional(v.boolean()),
    hasSolarPanel: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return saveAdminDevice(ctx, args)
  },
})

export const adminDeleteDevice = mutation({
  args: { deviceId: v.id('devices') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return deleteAdminDevice(ctx, args)
  },
})

// Device fleet operator staging (firmware contract 06-api retry/ack + §6/§10):
// config pushes (rev discipline), server-driven claim renames, OTA offers,
// and manual dose/video commands. Each is delivered inside the next sensor
// POST response and redelivered until the device acks or it is superseded.
export const adminStageDeviceConfig = mutation({
  args: { deviceId: v.string(), reportIntervalSec: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return stageDeviceConfig(ctx, args)
  },
})

export const adminStageDeviceClaim = mutation({
  args: { deviceId: v.string(), claimDeviceId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return stageDeviceClaim(ctx, args)
  },
})

export const adminClearDeviceClaim = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return clearDeviceClaim(ctx, args)
  },
})

export const adminStageDeviceOta = mutation({
  args: { deviceId: v.string(), minFirmware: v.string(), firmwareUrl: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return stageDeviceOta(ctx, args)
  },
})

export const adminClearDeviceOta = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return clearDeviceOta(ctx, args)
  },
})

export const adminQueueDeviceCommand = mutation({
  args: {
    deviceId: v.string(),
    kind: v.union(
      v.literal('pump'),
      v.literal('light'),
      v.literal('fertilizer'),
      v.literal('pesticide'),
      v.literal('video_start'),
      v.literal('video_stop'),
    ),
    durationMs: v.optional(v.number()),
    enabled: v.optional(v.boolean()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    quality: v.optional(v.number()),
    maxSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return queueDeviceCommand(ctx, args)
  },
})

export const adminSaveOfficialProduct = mutation({
  args: {
    productId: v.optional(v.id('products')),
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    quantityAvailable: v.number(),
    priceUnit: v.string(),
    imageUrl: v.optional(v.string()),
    featured: v.boolean(),
    status: v.union(
      v.literal('active'),
      v.literal('reserved'),
      v.literal('sold'),
      v.literal('archived'),
    ),
    shopeeUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    return saveOfficialProduct(ctx, admin._id, args)
  },
})

export const adminSavePlantPreset = mutation({
  args: {
    presetId: v.optional(v.id('plantCatalog')),
    key: v.optional(v.string()),
    name: v.string(),
    species: v.string(),
    growthStage: v.union(
      v.literal('seed_dormancy'),
      v.literal('germination'),
      v.literal('seedling_development'),
      v.literal('vegetative_growth'),
      v.literal('flowering_reproduction'),
      v.literal('maturity_senescence'),
    ),
    description: v.string(),
    location: v.string(),
    category: v.union(
      v.literal('herb'),
      v.literal('leafy'),
      v.literal('fruiting'),
      v.literal('houseplant'),
      v.literal('flower'),
      v.literal('microgreen'),
    ),
    difficulty: v.union(v.literal('easy'), v.literal('medium'), v.literal('advanced')),
    wateringThreshold: v.number(),
    lightingThreshold: v.number(),
    fertilizingThreshold: v.optional(v.number()),
    fertilizerCadenceDays: v.optional(v.number()),
    pesticideCadenceDays: v.optional(v.number()),
    nutrientNotes: v.optional(v.string()),
    sensorProfile: plantSensorProfile,
    lifecycleProfile: lifecycleProfileValidator,
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return savePlantPreset(ctx, args)
  },
})

export const adminDeletePlantPreset = mutation({
  args: { presetId: v.id('plantCatalog') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return deletePlantPreset(ctx, args)
  },
})

export const adminUpdateOfficialProductStatus = mutation({
  args: {
    productId: v.id('products'),
    status: v.union(
      v.literal('active'),
      v.literal('reserved'),
      v.literal('sold'),
      v.literal('archived'),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return updateOfficialProductStatus(ctx, args)
  },
})

export const adminDeleteOfficialProduct = mutation({
  args: { productId: v.id('products') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return deleteOfficialProduct(ctx, args)
  },
})

export const adminUpdateUserAccess = mutation({
  args: {
    userId: v.id('users'),
    tier: v.optional(v.union(v.literal('basic'), v.literal('advanced'))),
    role: v.optional(v.union(v.literal('grower'), v.literal('company'), v.literal('admin'))),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    return updateUserAccess(ctx, admin._id, args)
  },
})
