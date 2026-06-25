import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import { requireAdmin,
  getDeviceWateringDuration, getDeviceWateringCooldown, getDeviceLightingHysteresis,
  getDeviceFertilizingDuration, getDeviceFertilizingCooldown,
  getDevicePesticideDuration, getDevicePesticideCooldown,
  formatTimestamp, isDeviceOnline, getSupportMessages,
  enrichMarketplaceProduct, enrichBlogPost,
  getDeviceByExternalId, getDefaultDeviceName,
  normalizePlantSensorProfile, normalizeLifecycleProfile,
} from './helpers'
import { plantSensorProfile, lifecycleProfileValidator } from './schema'
import {
  DEFAULT_FERTILIZING_THRESHOLD, DEFAULT_FERTILIZING_DURATION, DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_PESTICIDE_THRESHOLD, DEFAULT_PESTICIDE_DURATION, DEFAULT_PESTICIDE_COOLDOWN,
  DEFAULT_TANK_CAPACITY, DEFAULT_TANK_MIN_LEVEL,
} from './types'

function normalizePlantPresetKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
}

async function batchGetUsers(ctx: QueryCtx, ids: (Id<'users'> | undefined | null)[]): Promise<Map<string, Doc<'users'> | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is Id<'users'> => id != null).map(String))]
  const userDocs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id as Id<'users'>)))
  const map = new Map<string, Doc<'users'> | null>()
  uniqueIds.forEach((id, i) => map.set(id, userDocs[i] ?? null))
  return map
}

async function batchGetPlants(ctx: QueryCtx, ids: (Id<'plants'> | undefined | null)[]): Promise<Map<string, Doc<'plants'> | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is Id<'plants'> => id != null).map(String))]
  const plantDocs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id as Id<'plants'>)))
  const map = new Map<string, Doc<'plants'> | null>()
  uniqueIds.forEach((id, i) => map.set(id, plantDocs[i] ?? null))
  return map
}

async function fetchAdminStats(ctx: QueryCtx) {
  const [users, devices, plants, communityPosts, allProducts, blogPosts, supportRequests] = await Promise.all([
    ctx.db.query('users').take(100),
    ctx.db.query('devices').order('desc').take(40),
    ctx.db.query('plants').take(100),
    ctx.db.query('communityPosts').take(100),
    ctx.db.query('products').take(100),
    ctx.db.query('blogPosts').withIndex('by_createdAt').order('desc').take(24),
    ctx.db.query('supportRequests').order('desc').take(30),
  ])

  const activePlants = plants.filter((plant) => !plant.archived)
  const claimedDevices = devices.filter((device) => Boolean(device.userId))
  const communityProducts = allProducts.filter((product) => product.type === 'community')
  const activeOfficialProducts = allProducts.filter(
    (product) => product.type === 'official' && product.status === 'active',
  )

  return {
    totalUsers: users.length,
    totalDevices: devices.length,
    claimedDevices: claimedDevices.length,
    activePlants: activePlants.length,
    openTickets: supportRequests.filter(
      (request) => request.status === 'open' || request.status === 'in_progress',
    ).length,
    officialProducts: activeOfficialProducts.length,
    communityListings: communityProducts.length,
    communityPosts: communityPosts.length,
    blogPosts: blogPosts.length,
  }
}

async function fetchAdminDevices(ctx: QueryCtx) {
  const devices = await ctx.db.query('devices').order('desc').take(40)
  const allPlantIds = devices.map((d) => d.plantId)
  const plantMap = await batchGetPlants(ctx, allPlantIds)

  const allUserIds = devices.map((d) => d.userId)
  const userMap = await batchGetUsers(ctx, allUserIds)

  return devices.map((device) => {
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
  })
}

async function fetchAdminSupport(ctx: QueryCtx) {
  const supportRequests = await ctx.db.query('supportRequests').order('desc').take(30)
  const allUserIds = [
    ...supportRequests.map((r) => r.userId),
    ...supportRequests.map((r) => r.handledBy),
  ]
  const userMap = await batchGetUsers(ctx, allUserIds)

  return Promise.all(
    supportRequests.map(async (request) => {
      const owner = userMap.get(String(request.userId))
      const handledBy = request.handledBy ? userMap.get(String(request.handledBy)) : null
      const messages = await getSupportMessages(ctx, request._id, 24)
      return {
        ...request,
        userName: owner?.name ?? owner?.email ?? 'Pengguna tidak diketahui',
        userEmail: owner?.email ?? '',
        handledByName: handledBy?.name ?? null,
        createdAtLabel: formatTimestamp(request.createdAt),
        updatedAtLabel: formatTimestamp(request.updatedAt),
        messages: messages.map((message) => ({
          ...message,
          senderName:
            message.senderRole === 'admin'
              ? 'Admin'
              : message.senderRole === 'system'
                ? 'Sistem'
                : (owner?.name ?? owner?.email ?? 'Pengguna'),
          createdAtLabel: formatTimestamp(message.createdAt),
        })),
      }
    }),
  )
}

async function fetchAdminProducts(ctx: QueryCtx, adminId: Id<'users'>) {
  const officialProducts = await ctx.db
    .query('products')
    .withIndex('by_type', (q) => q.eq('type', 'official'))
    .order('desc')
    .take(20)

  return Promise.all(
    officialProducts.map((product) => enrichMarketplaceProduct(ctx, product, adminId)),
  )
}

async function fetchAdminPlantCatalog(ctx: QueryCtx) {
  const plantCatalog = await ctx.db.query('plantCatalog').take(64)

  return Promise.all(
    plantCatalog.map(async (preset) => ({
      ...preset,
      imageUrl: preset.imageUrl ?? null,
    })),
  )
}

async function fetchAdminBlogPosts(ctx: QueryCtx) {
  const blogPosts = await ctx.db.query('blogPosts').withIndex('by_createdAt').order('desc').take(24)
  return Promise.all(blogPosts.map((post) => enrichBlogPost(ctx, post)))
}

async function fetchAdminUsers(ctx: QueryCtx) {
  const users = await ctx.db.query('users').take(100)

  return users
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 24)
    .map((user) => ({
      _id: user._id,
      name: user.name ?? user.email ?? 'Pengguna tanpa nama',
      email: user.email ?? '',
      handle: user.handle ?? '',
      tier: user.tier ?? 'basic',
      role: user.role ?? 'grower',
      setupComplete: Boolean(user.setupComplete),
    }))
}

async function fetchAdminRecentEvents(ctx: QueryCtx) {
  const recentEvents = await ctx.db.query('growEvents').withIndex('by_timestamp').order('desc').take(10)

  return recentEvents.map((event) => ({
    ...event,
    timestampLabel: formatTimestamp(event.timestamp),
  }))
}

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
    } satisfies Record<string, unknown>

    const optional: Record<string, unknown> = {}
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
  },
})

export const adminDeleteDevice = mutation({
  args: { deviceId: v.id('devices') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const device = await ctx.db.get(args.deviceId)
    if (!device) {
       throw new ConvexError('Perangkat tidak ditemukan')
    }
    if (device.userId || device.plantId) {
       throw new ConvexError('Lepaskan klaim perangkat dan arsipkan tanaman aktif sebelum menghapus perangkat ini')
    }

    await ctx.db.delete(args.deviceId)
    return { success: true }
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
    const now = Date.now()
    let imageUrl = args.imageUrl

    if (args.productId) {
      const existing = await ctx.db.get(args.productId)
      if (!existing || existing.type !== 'official') {
        throw new ConvexError('Produk resmi tidak ditemukan')
      }

      imageUrl = imageUrl ?? existing.imageUrl
    }

    if (!imageUrl) {
      throw new ConvexError('Gambar produk wajib diisi')
    }

    const payload = {
      title: args.title.trim(),
      description: args.description.trim(),
      price: args.price,
      category: args.category.trim(),
      type: 'official' as const,
      sellerId: admin._id,
      status: args.status,
      quantityAvailable: args.quantityAvailable,
      priceUnit: args.priceUnit.trim(),
      locationLabel: 'Shopee',
      imageUrl,
      featured: args.featured,
      updatedAt: now,
      ...(args.shopeeUrl?.trim() ? { shopeeUrl: args.shopeeUrl.trim() } : {}),
    }

    if (args.productId) {
      await ctx.db.patch(args.productId, payload)
      return { success: true, productId: args.productId }
    }

    const productId = await ctx.db.insert('products', {
      ...payload,
      createdAt: now,
    })

    return { success: true, productId }
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
    const now = Date.now()
    const key = normalizePlantPresetKey(args.key || args.name)
    if (!key) {
      throw new ConvexError('Kunci preset tanaman wajib diisi')
    }

    const existing = args.presetId ? await ctx.db.get(args.presetId) : null
    if (args.presetId && (!existing || existing._id !== args.presetId)) {
      throw new ConvexError('Preset tanaman tidak ditemukan')
    }

    const duplicate = await ctx.db
      .query('plantCatalog')
      .withIndex('by_key', (q) => q.eq('key', key))
      .first()
    if (duplicate && String(duplicate._id) !== String(args.presetId)) {
      throw new ConvexError('Preset tanaman dengan kunci ini sudah ada')
    }

    const finalImageUrl = args.imageUrl ?? existing?.imageUrl
    if (!finalImageUrl) {
      throw new ConvexError('Gambar preset tanaman wajib diisi')
    }

    const payload = {
      key,
      name: args.name.trim(),
      species: args.species.trim(),
      growthStage: args.growthStage,
      imageUrl: finalImageUrl,
      description: args.description.trim(),
      location: args.location.trim(),
      category: args.category,
      difficulty: args.difficulty,
      wateringThreshold: args.wateringThreshold,
      lightingThreshold: args.lightingThreshold,
      sensorProfile: normalizePlantSensorProfile(args.sensorProfile),
      lifecycleProfile: normalizeLifecycleProfile(args.lifecycleProfile),
      updatedAt: now,
    } satisfies Record<string, unknown>

    const optional: Record<string, unknown> = {}
    if (args.fertilizingThreshold !== undefined) optional.fertilizingThreshold = args.fertilizingThreshold
    if (args.fertilizerCadenceDays !== undefined) optional.fertilizerCadenceDays = args.fertilizerCadenceDays
    if (args.pesticideCadenceDays !== undefined) optional.pesticideCadenceDays = args.pesticideCadenceDays
    if (args.nutrientNotes !== undefined) optional.nutrientNotes = args.nutrientNotes.trim()

    if (existing) {
      await ctx.db.patch(existing._id, { ...payload, ...optional })
      return { success: true, presetId: existing._id }
    }

    const presetId = await ctx.db.insert('plantCatalog', {
      ...payload,
      ...optional,
      createdAt: now,
    })
    return { success: true, presetId }
  },
})

export const adminDeletePlantPreset = mutation({
  args: { presetId: v.id('plantCatalog') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const preset = await ctx.db.get(args.presetId)
    if (!preset) {
      throw new ConvexError('Preset tanaman tidak ditemukan')
    }

    await ctx.db.delete(args.presetId)
    return { success: true }
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
    const product = await ctx.db.get(args.productId)
    if (!product || product.type !== 'official') {
      throw new ConvexError('Produk resmi tidak ditemukan')
    }

    await ctx.db.patch(args.productId, {
      status: args.status,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const adminDeleteOfficialProduct = mutation({
  args: { productId: v.id('products') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || product.type !== 'official') {
      throw new ConvexError('Produk resmi tidak ditemukan')
    }

    await ctx.db.delete(args.productId)
    return { success: true }
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
    const target = await ctx.db.get(args.userId)
    if (!target) {
      throw new ConvexError('Pengguna tidak ditemukan')
    }

    if (String(target._id) === String(admin._id) && args.role && args.role !== 'admin') {
      throw new ConvexError('Admin tidak dapat menghapus peran admin miliknya sendiri dari halaman ini')
    }

    await ctx.db.patch(args.userId, {
      tier: args.tier ?? target.tier,
      role: args.role ?? target.role,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})
