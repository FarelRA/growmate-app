import { v } from 'convex/values'
import { paginationOptsValidator } from 'convex/server'
import { mutation, query } from './_generated/server'
import { requireAdmin } from './helpers/auth'
import { plantSensorProfile, lifecycleProfileValidator } from './schema'
import { fetchAdminStats, fetchAdminRecentEvents } from './admin/stats'
import {
  fetchAdminDevices, fetchAdminDevicesPaginated, saveAdminDevice, deleteAdminDevice,
} from './admin/devices'
import { fetchAdminSupport, fetchAdminSupportPaginated } from './admin/support'
import {
  fetchAdminProducts, saveOfficialProduct, updateOfficialProductStatus, deleteOfficialProduct,
} from './admin/products'
import { fetchAdminPlantCatalog, savePlantPreset, deletePlantPreset } from './admin/plants'
import { fetchAdminBlogPosts } from './admin/blog'
import { fetchAdminUsers, fetchAdminUsersPaginated, updateUserAccess } from './admin/users'

// ADMIN MODULE MAP (pre-alpha extraction, zero API change — every
// `api.admin.*` path stays byte-identical):
//   convex/admin/stats.ts    — batchGetUsers/batchGetPlants, countAllPaginated,
//                              fetchAdminStats, fetchAdminRecentEvents
//   convex/admin/devices.ts  — fetchAdminDevices(+Paginated), save/delete device
//   convex/admin/support.ts  — fetchAdminSupport(+Paginated)
//   convex/admin/products.ts — fetchAdminProducts, save/status/delete official product
//   convex/admin/plants.ts   — normalizePlantPresetKey, fetchAdminPlantCatalog,
//                              save/delete plant preset
//   convex/admin/blog.ts     — fetchAdminBlogPosts
//   convex/admin/users.ts    — fetchAdminUsers(+Paginated), updateUserAccess
// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates below
// (auth stays at the API boundary). Cores in convex/admin/* perform pure DB
// logic and never call requireAdmin themselves; where a core needs the admin
// identity as data (sellerId, self-demotion guard), the delegate passes the
// already-authorized `admin._id`. The adminOverview/adminConsole compositions
// stay here as fan-out over the cores.

export const adminOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    const [stats, devices, recentEvents] = await Promise.all([
      fetchAdminStats(ctx),
      fetchAdminDevices(ctx),
      fetchAdminRecentEvents(ctx),
    ])
    return { stats, devices, recentEvents }
  },
})

export const adminDevicesList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return fetchAdminDevices(ctx)
  },
})

export const adminSupportTickets = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return fetchAdminSupport(ctx)
  },
})

export const adminProductsList = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx)
    return fetchAdminProducts(ctx, admin._id)
  },
})

export const adminPlantCatalogList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return fetchAdminPlantCatalog(ctx)
  },
})

export const adminBlogPostsList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return fetchAdminBlogPosts(ctx)
  },
})

export const adminUsersList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)
    return fetchAdminUsers(ctx)
  },
})

// Cursor-paginated admin lists (20/page default). Existing array-returning
// queries above are kept for backward compatibility with the dashboard.
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

export const adminUsersPaginated = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    return fetchAdminUsersPaginated(ctx, args.paginationOpts)
  },
})

export const adminConsole = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx)
    const [stats, devices, supportRequests, officialProducts, plantCatalog, blogPosts, users, recentEvents] = await Promise.all([
      fetchAdminStats(ctx),
      fetchAdminDevices(ctx),
      fetchAdminSupport(ctx),
      fetchAdminProducts(ctx, admin._id),
      fetchAdminPlantCatalog(ctx),
      fetchAdminBlogPosts(ctx),
      fetchAdminUsers(ctx),
      fetchAdminRecentEvents(ctx),
    ])

    return {
      stats,
      devices,
      supportRequests,
      officialProducts,
      blogPosts,
      plantCatalog,
      recentEvents,
      users,
    }
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
