import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import { requireAdmin, resolveStoredImageUrl,
  getDeviceWateringDuration, getDeviceWateringCooldown, getDeviceLightingHysteresis,
  formatTimestamp, isDeviceOnline, getSupportMessages,
  enrichMarketplaceProduct, enrichBlogPost,
  getDeviceByExternalId, getDefaultDeviceName,
  normalizePlantSensorProfile, normalizeLifecycleProfile,
} from './helpers'
import { plantSensorProfile, lifecycleProfileValidator } from './schema'

function normalizePlantPresetKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
}

async function batchGetUsers(ctx: import('./types').Ctx, ids: (Id<'users'> | undefined | null)[]): Promise<Map<string, Doc<'users'> | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is Id<'users'> => id != null).map(String))]
  const userDocs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id as Id<'users'>)))
  const map = new Map<string, Doc<'users'> | null>()
  uniqueIds.forEach((id, i) => map.set(id, userDocs[i] ?? null))
  return map
}

async function batchGetPlants(ctx: import('./types').Ctx, ids: (Id<'plants'> | undefined | null)[]): Promise<Map<string, Doc<'plants'> | null>> {
  const uniqueIds = [...new Set(ids.filter((id): id is Id<'plants'> => id != null).map(String))]
  const plantDocs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id as Id<'plants'>)))
  const map = new Map<string, Doc<'plants'> | null>()
  uniqueIds.forEach((id, i) => map.set(id, plantDocs[i] ?? null))
  return map
}

export const adminConsole = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx)
    const [
      devices,
      supportRequests,
      officialProducts,
      users,
      plants,
      communityPosts,
      blogPosts,
      allProducts,
      recentEvents,
      plantCatalog,
    ] = await Promise.all([
      ctx.db.query('devices').order('desc').take(40),
      ctx.db.query('supportRequests').order('desc').take(30),
      ctx.db
        .query('products')
        .withIndex('by_type', (q) => q.eq('type', 'official'))
        .order('desc')
        .take(20),
      ctx.db.query('users').take(100),
      ctx.db.query('plants').take(100),
      ctx.db.query('communityPosts').take(100),
      ctx.db.query('blogPosts').withIndex('by_createdAt').order('desc').take(24),
      ctx.db.query('products').take(100),
      ctx.db.query('growEvents').withIndex('by_timestamp').order('desc').take(10),
      ctx.db.query('plantCatalog').take(64),
    ])

    const allUserIds = [
      ...devices.map((d) => d.userId),
      ...supportRequests.map((r) => r.userId),
      ...supportRequests.map((r) => r.handledBy),
      ...officialProducts.map((p) => p.sellerId),
      ...blogPosts.map((p) => p.authorId),
    ]
    const allPlantIds = devices.map((d) => d.plantId)

    const [userMap, plantMap] = await Promise.all([
      batchGetUsers(ctx, allUserIds),
      batchGetPlants(ctx, allPlantIds),
    ])

    const deviceRows = devices.map((device) => {
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
      }
    })

    const supportRows = await Promise.all(
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

    const officialRows = await Promise.all(
      officialProducts.map((product) => enrichMarketplaceProduct(ctx, product, admin._id)),
    )
    const plantCatalogRows = await Promise.all(
      plantCatalog.map(async (preset) => ({
        ...preset,
        image:
          (await resolveStoredImageUrl(ctx, preset.imageStorageId, preset.image)) ?? preset.image,
      })),
    )
    const blogRows = await Promise.all(blogPosts.map((post) => enrichBlogPost(ctx, post)))
    const activePlants = plants.filter((plant) => !plant.archived)
    const claimedDevices = devices.filter((device) => Boolean(device.userId))
    const communityProducts = allProducts.filter((product) => product.type === 'community')
    const activeOfficialProducts = allProducts.filter(
      (product) => product.type === 'official' && product.status === 'active',
    )
    const recentEventRows = recentEvents.map((event) => ({
      ...event,
      timestampLabel: formatTimestamp(event.timestamp),
    }))

    return {
      stats: {
        totalUsers: users.length,
        totalDevices: devices.length,
        claimedDevices: claimedDevices.length,
        activePlants: activePlants.length,
        openTickets: supportRows.filter(
          (request) => request.status === 'open' || request.status === 'in_progress',
        ).length,
        officialProducts: activeOfficialProducts.length,
        communityListings: communityProducts.length,
        communityPosts: communityPosts.length,
        blogPosts: blogRows.length,
      },
      devices: deviceRows,
      supportRequests: supportRows.sort((a, b) => b.updatedAt - a.updatedAt),
      officialProducts: officialRows,
      blogPosts: blogRows,
      plantCatalog: plantCatalogRows.sort((a, b) => a.name.localeCompare(b.name)),
      recentEvents: recentEventRows,
      users: users
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
        })),
    }
  },
})

export const adminSaveDevice = mutation({
  args: {
    existingDeviceId: v.optional(v.id('devices')),
    deviceId: v.string(),
    name: v.optional(v.string()),
    firmwareVersion: v.optional(v.string()),
    autoWatering: v.boolean(),
    autoLighting: v.boolean(),
    wateringThreshold: v.number(),
    wateringDuration: v.number(),
    wateringCooldown: v.number(),
    lightingThreshold: v.number(),
    lightingHysteresis: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const now = Date.now()

    const existingByDeviceId = await getDeviceByExternalId(ctx, args.deviceId.trim())
    if (existingByDeviceId && String(existingByDeviceId._id) !== String(args.existingDeviceId)) {
       throw new Error('ID perangkat tersebut sudah digunakan')
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

    if (args.existingDeviceId) {
      const existing = await ctx.db.get(args.existingDeviceId)
      if (!existing) {
         throw new Error('Perangkat tidak ditemukan')
      }

      await ctx.db.patch(args.existingDeviceId, payload)
      return { success: true, deviceId: args.existingDeviceId }
    }

    const deviceDocId = await ctx.db.insert('devices', {
      lightEnabled: false,
      queuedCommands: {
        pump: null,
        light: null,
      },
      lastSeen: now,
      createdAt: now,
      ...payload,
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
       throw new Error('Perangkat tidak ditemukan')
    }
    if (device.userId || device.plantId) {
       throw new Error('Lepaskan klaim perangkat dan arsipkan tanaman aktif sebelum menghapus perangkat ini')
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
    imageStorageId: v.optional(v.id('_storage')),
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
    let image = await resolveStoredImageUrl(ctx, args.imageStorageId)
    let imageStorageId = args.imageStorageId

    if (args.productId) {
      const existing = await ctx.db.get(args.productId)
      if (!existing || existing.type !== 'official') {
        throw new Error('Produk resmi tidak ditemukan')
      }

      image = image ?? existing.image
      imageStorageId = imageStorageId ?? existing.imageStorageId
    }

    if (!image) {
      throw new Error('Gambar produk wajib diisi')
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
      image,
      featured: args.featured,
      updatedAt: now,
      ...(imageStorageId ? { imageStorageId } : {}),
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
    sensorProfile: plantSensorProfile,
    lifecycleProfile: lifecycleProfileValidator,
    imageStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const now = Date.now()
    const key = normalizePlantPresetKey(args.key || args.name)
    if (!key) {
      throw new Error('Kunci preset tanaman wajib diisi')
    }

    const image = await resolveStoredImageUrl(ctx, args.imageStorageId)
    const existing = args.presetId ? await ctx.db.get(args.presetId) : null
    if (args.presetId && (!existing || existing._id !== args.presetId)) {
      throw new Error('Preset tanaman tidak ditemukan')
    }

    const duplicate = await ctx.db
      .query('plantCatalog')
      .withIndex('by_key', (q) => q.eq('key', key))
      .first()
    if (duplicate && String(duplicate._id) !== String(args.presetId)) {
      throw new Error('Preset tanaman dengan kunci ini sudah ada')
    }

    const finalImage = image ?? existing?.image
    const finalImageStorageId = args.imageStorageId ?? existing?.imageStorageId
    if (!finalImage) {
      throw new Error('Gambar preset tanaman wajib diisi')
    }

    const payload = {
      key,
      name: args.name.trim(),
      species: args.species.trim(),
      growthStage: args.growthStage,
      image: finalImage,
      imageStorageId: finalImageStorageId,
      description: args.description.trim(),
      location: args.location.trim(),
      category: args.category,
      difficulty: args.difficulty,
      wateringThreshold: args.wateringThreshold,
      lightingThreshold: args.lightingThreshold,
      sensorProfile: normalizePlantSensorProfile(args.sensorProfile),
      lifecycleProfile: normalizeLifecycleProfile(args.lifecycleProfile),
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return { success: true, presetId: existing._id }
    }

    const presetId = await ctx.db.insert('plantCatalog', {
      ...payload,
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
      throw new Error('Preset tanaman tidak ditemukan')
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
      throw new Error('Produk resmi tidak ditemukan')
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
      throw new Error('Produk resmi tidak ditemukan')
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
      throw new Error('Pengguna tidak ditemukan')
    }

    if (String(target._id) === String(admin._id) && args.role && args.role !== 'admin') {
      throw new Error('Admin tidak dapat menghapus peran admin miliknya sendiri dari halaman ini')
    }

    await ctx.db.patch(args.userId, {
      tier: args.tier ?? target.tier,
      role: args.role ?? target.role,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})
