/**
 * Seed DB helpers (internal functions only).
 *
 * Companion to `./seed`, which is the public CLI entry point
 * (`convex run seed:admin|plants|products|blog`). Everything exported here
 * is an `internalQuery`/`internalMutation`/`internalAction` invoked from
 * `seed.ts` via `internal.seedInternal.*` — never run directly from the CLI.
 * Kept as a separate file because `"use node"` (required by `seed.ts` for
 * Buffer/RustFS uploads) forbids `internalQuery`/`internalMutation`.
 */
import { v, type GenericId } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { plantSensorProfile, lifecycleProfileValidator } from "./schema";
import { api, internal } from "./_generated/api";

// ─── Plant Catalog ────────────────────────────────────────

export const lookupPlantByKey = internalQuery({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    return await ctx.db
      .query("plantCatalog")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
  },
});

export const insertPlantPreset = internalMutation({
  args: {
    key: v.string(),
    name: v.string(),
    species: v.string(),
    description: v.string(),
    location: v.string(),
    category: v.union(
      v.literal("herb"),
      v.literal("leafy"),
      v.literal("fruiting"),
      v.literal("houseplant"),
      v.literal("flower"),
      v.literal("microgreen"),
    ),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("advanced")),
    wateringThreshold: v.number(),
    lightingThreshold: v.number(),
    fertilizingThreshold: v.optional(v.number()),
    fertilizerCadenceDays: v.optional(v.number()),
    pesticideCadenceDays: v.optional(v.number()),
    nutrientNotes: v.optional(v.string()),
    suitableFor: v.optional(v.array(v.union(v.literal("pod"), v.literal("field")))),
    sensorProfile: plantSensorProfile,
    lifecycleProfile: lifecycleProfileValidator,
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("plantCatalog", {
      key: args.key,
      name: args.name,
      species: args.species,
      growthStage: "vegetative_growth",
      imageUrl: args.imageUrl,
      description: args.description,
      location: args.location,
      category: args.category,
      difficulty: args.difficulty,
      wateringThreshold: args.wateringThreshold,
      lightingThreshold: args.lightingThreshold,
      fertilizingThreshold: args.fertilizingThreshold,
      fertilizerCadenceDays: args.fertilizerCadenceDays,
      pesticideCadenceDays: args.pesticideCadenceDays,
      nutrientNotes: args.nutrientNotes,
      suitableFor: args.suitableFor,
      sensorProfile: args.sensorProfile,
      lifecycleProfile: args.lifecycleProfile,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ─── Official Products ────────────────────────────────────

export const lookupOfficialProductByTitle = internalQuery({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    return await ctx.db
      .query("products")
      .withIndex("by_type", (q) => q.eq("type", "official"))
      .filter((q) => q.eq(q.field("title"), title))
      .first();
  },
});

export const insertOfficialProduct = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    quantityAvailable: v.number(),
    priceUnit: v.string(),
    featured: v.boolean(),
    shopeeUrl: v.optional(v.string()),
    imageUrl: v.string(),
    sellerId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("products", {
      title: args.title,
      description: args.description,
      price: args.price,
      category: args.category,
      type: "official",
      sellerId: args.sellerId,
      status: "active",
      quantityAvailable: args.quantityAvailable,
      priceUnit: args.priceUnit,
      locationLabel: "Shopee",
      imageUrl: args.imageUrl,
      featured: args.featured,
      shopeeUrl: args.shopeeUrl,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Reseed sync: refresh display fields when the dataset moved on.
export const updateOfficialProductMedia = internalMutation({
  args: {
    productId: v.id("products"),
    imageUrl: v.string(),
    shopeeUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      imageUrl: args.imageUrl,
      shopeeUrl: args.shopeeUrl,
      updatedAt: Date.now(),
    });
  },
});

// ─── Blog Posts ───────────────────────────────────────────

export const lookupBlogPostByTitle = internalQuery({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    return await ctx.db
      .query("blogPosts")
      .filter((q) => q.eq(q.field("title"), title))
      .first();
  },
});

export const insertBlogPost = internalMutation({
  args: {
    title: v.string(),
    excerpt: v.string(),
    body: v.string(),
    published: v.boolean(),
    featured: v.boolean(),
    imageUrl: v.string(),
    authorId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("blogPosts", {
      authorId: args.authorId,
      title: args.title,
      excerpt: args.excerpt,
      body: args.body,
      imageUrl: args.imageUrl,
      published: args.published,
      featured: args.featured,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listAllDevices = internalQuery({
  args: {},
  handler: async (ctx) => {
    // Batched paginated read to avoid a single unbounded collect().
    const all: Array<Doc<'devices'>> = []
    let cursor: string | null = null
    while (true) {
      const page = await ctx.db
        .query('devices')
        .withIndex('by_createdAt')
        .order('desc')
        .paginate({ cursor, numItems: 100 })
      for (const d of page.page) all.push(d)
      if (page.isDone) break
      cursor = page.continueCursor
    }
    return all
  },
});

// ─── Users (via action) ──────────────────────────────────

export const patchUserProfile = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    handle: v.string(),
    role: v.union(v.literal("grower"), v.literal("company")),
    tier: v.union(v.literal("basic"), v.literal("advanced")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      name: args.name,
      handle: args.handle,
      role: args.role,
      tier: args.tier,
      avatar: args.name.split(" ").map((n) => n[0]).join("").toUpperCase(),
      setupComplete: true,
      points: 0,
      updatedAt: now,
    });
  },
});

export const signUpUser = internalAction({
  args: {
    email: v.string(),
    password: v.string(),
    name: v.string(),
    handle: v.string(),
    role: v.union(v.literal("grower"), v.literal("company")),
    tier: v.union(v.literal("basic"), v.literal("advanced")),
  },
  handler: async (ctx, args): Promise<{ _id: GenericId<"users">; created: boolean }> => {
    const existing = await ctx.runQuery(internal.users.adminLookupByEmail, { email: args.email });
    if (existing) return { _id: existing._id, created: false };

    try {
      await ctx.runAction(api.auth.signIn, {
        provider: "password",
        params: { email: args.email, password: args.password, flow: "signUp" },
      });
    } catch (error) {
      if (
        !(error instanceof Error && error.message.toLowerCase().includes("already exists"))
      ) {
        throw error;
      }
    }

    const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: args.email });
    if (!user) throw new Error(`User not found after signUp: ${args.email}`);

    await ctx.runMutation(internal.seedInternal.patchUserProfile, {
      userId: user._id,
      name: args.name,
      handle: args.handle,
      role: args.role,
      tier: args.tier,
    });

    return { _id: user._id, created: true };
  },
});

// ─── Devices ─────────────────────────────────────────────

export const lookupUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const lookupDeviceById = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    return await ctx.db
      .query("devices")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .first();
  },
});

export const insertDevice = internalMutation({
  args: {
    deviceId: v.string(),
    name: v.string(),
    version: v.union(v.literal("v1"), v.literal("v2")),
    variant: v.optional(v.union(v.literal("tech"), v.literal("tech-addon"))),
    lastSeen: v.number(),
    firmwareVersion: v.optional(v.string()),
    hasModem: v.optional(v.boolean()),
    hasSolarPanel: v.optional(v.boolean()),
    batteryCapacityAh: v.optional(v.number()),
    batterySoC: v.optional(v.number()),
    tankCapacity: v.optional(v.number()),
    autoWatering: v.optional(v.boolean()),
    autoLighting: v.optional(v.boolean()),
    wateringThreshold: v.optional(v.number()),
    wateringDuration: v.optional(v.number()),
    wateringCooldown: v.optional(v.number()),
    lightingThreshold: v.optional(v.number()),
    lightingHysteresis: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("devices", {
      deviceId: args.deviceId,
      name: args.name,
      version: args.version,
      variant: args.variant,
      autoWatering: args.autoWatering ?? false,
      autoLighting: args.autoLighting ?? false,
      wateringThreshold: args.wateringThreshold ?? 50,
      wateringDuration: args.wateringDuration ?? 5,
      wateringCooldown: args.wateringCooldown ?? 120,
      lightingThreshold: args.lightingThreshold ?? 50,
      lightingHysteresis: args.lightingHysteresis ?? 10,
      autoFertilizing: false,
      autoPesticide: false,
      fertilizingThreshold: 300,
      fertilizingDuration: 10,
      fertilizingCooldown: 240,
      pesticideThreshold: 300,
      pesticideDuration: 10,
      pesticideCooldown: 240,
      lightEnabled: false,
      lastSeen: args.lastSeen,
      tankCapacity: args.tankCapacity,
      firmwareVersion: args.firmwareVersion,
      hasModem: args.hasModem,
      hasSolarPanel: args.hasSolarPanel,
      batteryCapacityAh: args.batteryCapacityAh,
      batterySoC: args.batterySoC,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const claimDeviceByUser = internalMutation({
  args: { deviceId: v.id("devices"), userId: v.id("users") },
  handler: async (ctx, { deviceId, userId }) => {
    await ctx.db.patch(deviceId, {
      userId,
      updatedAt: Date.now(),
    });
  },
});

// Backfill the static v2 hardware variant on rows inserted before the
// field existed (fresh inserts already carry it). Firmware versions are
// intentionally NOT backfilled here: they change with OTA updates.
export const patchDeviceVariant = internalMutation({
  args: {
    deviceId: v.id("devices"),
    variant: v.optional(v.union(v.literal("tech"), v.literal("tech-addon"))),
    batteryCapacityAh: v.optional(v.number()),
  },
  handler: async (ctx, { deviceId, variant, batteryCapacityAh }) => {
    await ctx.db.patch(deviceId, {
      ...(variant !== undefined ? { variant } : {}),
      ...(batteryCapacityAh !== undefined ? { batteryCapacityAh } : {}),
      updatedAt: Date.now(),
    });
  },
});

// ─── User Plants ─────────────────────────────────────────

export const insertUserPlant = internalMutation({
  args: {
    deviceId: v.id("devices"),
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
    wateringThreshold: v.number(),
    lightingThreshold: v.number(),
    fertilizingThreshold: v.optional(v.number()),
    fertilizerCadenceDays: v.optional(v.number()),
    pesticideCadenceDays: v.optional(v.number()),
    sensorProfile: v.optional(plantSensorProfile),
    lifecycleProfile: lifecycleProfileValidator,
    location: v.string(),
    plantedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const plantId = await ctx.db.insert("plants", {
      deviceId: args.deviceId,
      name: args.name,
      species: args.species,
      growthStage: args.growthStage,
      wateringThreshold: args.wateringThreshold,
      lightingThreshold: args.lightingThreshold,
      fertilizingThreshold: args.fertilizingThreshold,
      fertilizerCadenceDays: args.fertilizerCadenceDays,
      pesticideCadenceDays: args.pesticideCadenceDays,
      sensorProfile: args.sensorProfile,
      lifecycleProfile: args.lifecycleProfile,
      location: args.location,
      archived: false,
      plantedAt: args.plantedAt,
      createdAt: now,
      updatedAt: now,
    });

    // Link plant to device
    await ctx.db.patch(args.deviceId, {
      plantId,
      updatedAt: now,
    });

    return plantId;
  },
});

// ─── Care Schedules ──────────────────────────────────────

export const insertCareSchedule = internalMutation({
  args: {
    plantId: v.id("plants"),
    title: v.string(),
    cadenceUnit: v.union(v.literal("hours"), v.literal("days")),
    cadenceValue: v.number(),
    enabled: v.boolean(),
    nextRunAt: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("careSchedules", {
      plantId: args.plantId,
      title: args.title,
      cadenceUnit: args.cadenceUnit,
      cadenceValue: args.cadenceValue,
      enabled: args.enabled,
      nextRunAt: args.nextRunAt,
      createdAt: now,
    });
  },
});

// ─── Community Listings ──────────────────────────────────

export const insertCommunityListing = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    quantityAvailable: v.number(),
    priceUnit: v.string(),
    sellerId: v.id("users"),
    imageUrl: v.optional(v.string()),
    locationLabel: v.optional(v.string()),
    contactPreference: v.optional(v.union(v.literal("chat"), v.literal("pickup"), v.literal("delivery"))),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("products", {
      title: args.title,
      description: args.description,
      price: args.price,
      category: args.category,
      type: "community",
      sellerId: args.sellerId,
      status: "active",
      quantityAvailable: args.quantityAvailable,
      priceUnit: args.priceUnit,
      imageUrl: args.imageUrl,
      locationLabel: args.locationLabel ?? "",
      contactPreference: args.contactPreference ?? "chat",
      featured: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Reseed sync: refresh the photo when the dataset moved on.
export const updateCommunityListingMedia = internalMutation({
  args: {
    productId: v.id("products"),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.productId, {
      imageUrl: args.imageUrl,
      updatedAt: Date.now(),
    });
  },
});

// ─── Community Posts ─────────────────────────────────────

export const insertCommunityPost = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const postId = await ctx.db.insert("communityPosts", {
      userId: args.userId,
      title: args.title,
      body: args.body,
      imageUrl: args.imageUrl,
      createdAt: now,
      updatedAt: now,
    });
    return postId;
  },
});

export const insertPostComment = internalMutation({
  args: {
    postId: v.id("communityPosts"),
    userId: v.id("users"),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("postComments", {
      postId: args.postId,
      userId: args.userId,
      body: args.body,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const insertPostLike = internalMutation({
  args: {
    postId: v.id("communityPosts"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("postLikes", {
      postId: args.postId,
      userId: args.userId,
      createdAt: Date.now(),
    });
  },
});

// ─── Grow Events ─────────────────────────────────────────

export const insertGrowEvent = internalMutation({
  args: {
    deviceId: v.optional(v.id("devices")),
    plantId: v.optional(v.id("plants")),
    userId: v.id("users"),
    source: v.union(v.literal("user"), v.literal("device"), v.literal("system"), v.literal("automation")),
    entityType: v.union(v.literal("device"), v.literal("plant"), v.literal("schedule"), v.literal("automation"), v.literal("sensor")),
    eventType: v.union(
      v.literal("device_claimed"),
      v.literal("device_unclaimed"),
      v.literal("plant_assigned"),
      v.literal("plant_archived"),
      v.literal("plant_added"),
      v.literal("plant_image_updated"),
      v.literal("sensor_recorded"),
      v.literal("system_watering"),
      v.literal("manual_watering_triggered"),
      v.literal("automation_settings_updated"),
      v.literal("care_schedule_toggled"),
      v.literal("automation_action_executed"),
      v.literal("care_schedule_saved"),
      v.literal("care_schedule_completed"),
      v.literal("care_schedule_deleted"),
      v.literal("manual_lighting_triggered"),
      v.literal("manual_fertilizing_triggered"),
      v.literal("manual_pesticide_triggered"),
      v.literal("manual_stream_started"),
      v.literal("manual_stream_stopped"),
      v.literal("stream_registered"),
    ),
    title: v.string(),
    detail: v.optional(v.string()),
    timestamp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("growEvents", {
      deviceId: args.deviceId,
      plantId: args.plantId,
      userId: args.userId,
      source: args.source,
      entityType: args.entityType,
      eventType: args.eventType,
      title: args.title,
      detail: args.detail,
      timestamp: args.timestamp,
    });
  },
});

// ─── User Activities ─────────────────────────────────────

export const insertUserActivity = internalMutation({
  args: {
    userId: v.id("users"),
    activityType: v.union(
      v.literal("post_created"),
      v.literal("comment_created"),
      v.literal("post_liked"),
      v.literal("plant_added"),
      v.literal("watering_completed"),
    ),
    points: v.number(),
    relatedId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("userActivities", {
      userId: args.userId,
      activityType: args.activityType,
      points: args.points,
      relatedId: args.relatedId,
      createdAt: Date.now(),
    });
  },
});

// ─── Community Products ────────────────────────────────

export const lookupCommunityProductByTitle = internalQuery({
  args: { title: v.string() },
  handler: async (ctx, { title }) => {
    return await ctx.db
      .query("products")
      .withIndex("by_type", (q) => q.eq("type", "community"))
      .filter((q) => q.eq(q.field("title"), title))
      .first();
  },
});

// ─── Marketplace Threads ───────────────────────────────

export const lookupThreadByProductBuyer = internalQuery({
  args: { productId: v.id("products"), buyerId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("marketplaceThreads")
      .withIndex("by_product_and_buyer", (q) =>
        q.eq("productId", args.productId).eq("buyerId", args.buyerId),
      )
      .first();
  },
});

export const seedThread = internalMutation({
  args: {
    productId: v.id("products"),
    buyerId: v.id("users"),
    sellerId: v.id("users"),
    buyerName: v.optional(v.string()),
    sellerName: v.optional(v.string()),
    productTitle: v.optional(v.string()),
    productImage: v.optional(v.string()),
    productStatus: v.optional(
      v.union(v.literal("active"), v.literal("reserved"), v.literal("sold"), v.literal("archived")),
    ),
    messages: v.array(
      v.object({ senderId: v.id("users"), body: v.string(), createdAt: v.number() }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.messages.length === 0) throw new Error("[seed] thread needs messages");
    const first = args.messages[0]!;
    const last = args.messages[args.messages.length - 1]!;
    const threadId = await ctx.db.insert("marketplaceThreads", {
      productId: args.productId,
      buyerId: args.buyerId,
      sellerId: args.sellerId,
      buyerName: args.buyerName,
      sellerName: args.sellerName,
      productTitle: args.productTitle,
      productImage: args.productImage,
      productStatus: args.productStatus ?? "active",
      lastMessagePreview: last.body.slice(0, 160),
      lastMessageAt: last.createdAt,
      buyerUnreadCount: String(last.senderId) !== String(args.buyerId) ? 1 : 0,
      sellerUnreadCount: String(last.senderId) !== String(args.sellerId) ? 1 : 0,
      createdAt: first.createdAt,
      updatedAt: last.createdAt,
    });
    for (const m of args.messages) {
      await ctx.db.insert("marketplaceMessages", {
        threadId,
        senderId: m.senderId,
        body: m.body,
        createdAt: m.createdAt,
      });
    }
    await ctx.db.insert("notifications", {
      userId: args.sellerId,
      title: "Pertanyaan marketplace baru",
      detail: `${args.buyerName ?? "Seorang pembeli"} menghubungi Anda tentang ${args.productTitle ?? "produk Anda"}.`,
      kind: "commerce",
      read: false,
      createdAt: first.createdAt,
    });
    return threadId;
  },
});

// ─── Support Tickets ───────────────────────────────────

export const hasTicket = internalQuery({
  args: { userId: v.id("users"), topic: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("supportRequests")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("topic"), args.topic))
      .first();
    return row !== null;
  },
});

export const seedTicket = internalMutation({
  args: {
    userId: v.id("users"),
    topic: v.string(),
    status: v.union(
      v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed"),
    ),
    priority: v.union(v.literal("low"), v.literal("normal"), v.literal("high"), v.literal("urgent")),
    handledBy: v.optional(v.id("users")),
    createdAt: v.number(),
    messages: v.array(
      v.object({
        senderRole: v.union(v.literal("user"), v.literal("admin"), v.literal("system")),
        senderUserId: v.optional(v.id("users")),
        body: v.string(),
        createdAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const requestId = await ctx.db.insert("supportRequests", {
      userId: args.userId,
      status: args.status,
      priority: args.priority,
      topic: args.topic,
      handledBy: args.handledBy,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    });
    for (const m of args.messages) {
      await ctx.db.insert("supportMessages", {
        requestId,
        senderUserId: m.senderUserId,
        senderRole: m.senderRole,
        body: m.body,
        createdAt: m.createdAt,
      });
    }
    if (args.status === "closed") {
      await ctx.db.insert("supportMessages", {
        requestId,
        senderUserId: undefined,
        senderRole: "system",
        body: "Tiket ditutup. Terima kasih telah menghubungi dukungan GrowMate.",
        createdAt: Date.now(),
      });
    }
    await ctx.db.insert("notifications", {
      userId: args.userId,
      title: "Tiket dukungan dibuat",
      detail: `Permintaan Anda tentang ${args.topic.toLowerCase()} sudah kami catat dan masuk ke antrean dukungan.`,
      kind: "system",
      read: false,
      createdAt: args.createdAt,
    });
    return requestId;
  },
});

// ─── Notifications & Drafts ────────────────────────────

export const hasNotification = internalQuery({
  args: { userId: v.id("users"), title: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();
    return row !== null;
  },
});

export const seedNotification = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    detail: v.string(),
    kind: v.union(v.literal("assistant"), v.literal("system"), v.literal("commerce"), v.literal("social")),
    read: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("notifications", {
      userId: args.userId,
      title: args.title,
      detail: args.detail,
      kind: args.kind,
      read: args.read,
      readAt: args.readAt,
      createdAt: args.createdAt,
    });
  },
});

export const hasDraft = internalQuery({
  args: { userId: v.id("users"), title: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("listingDrafts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("title"), args.title))
      .first();
    return row !== null;
  },
});

export const seedDraft = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    quantity: v.number(),
    quantityUnit: v.string(),
    price: v.number(),
    priceUnit: v.string(),
    locationLabel: v.string(),
    contactPreference: v.union(v.literal("chat"), v.literal("pickup"), v.literal("delivery")),
    status: v.union(v.literal("draft"), v.literal("published"), v.literal("archived")),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("listingDrafts", {
      userId: args.userId,
      title: args.title,
      description: args.description,
      category: args.category,
      quantity: args.quantity,
      quantityUnit: args.quantityUnit,
      price: args.price,
      priceUnit: args.priceUnit,
      locationLabel: args.locationLabel,
      contactPreference: args.contactPreference,
      status: args.status,
      createdAt: args.createdAt,
      updatedAt: args.createdAt,
    });
  },
});

// ─── Activities ────────────────────────────────────────

export const hasActivity = internalQuery({
  args: { userId: v.id("users"), activityType: v.string(), relatedId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userActivities")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("activityType"), args.activityType),
          q.eq(q.field("relatedId"), args.relatedId),
        ),
      )
      .first();
    return row !== null;
  },
});

// ─── Sensor History ────────────────────────────────────

const sensorKindValidator = v.union(
  v.literal("soil"), v.literal("light"), v.literal("temperature"), v.literal("air"), v.literal("water"),
  v.literal("current"),
);

export const hasSensorHistory = internalQuery({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("sensorReadings")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .first();
    return row !== null;
  },
});

export const bulkInsertSensorReadings = internalMutation({
  args: {
    deviceId: v.id("devices"),
    plantId: v.optional(v.id("plants")),
    readings: v.array(
      v.object({
        kind: sensorKindValidator,
        value: v.number(),
        unit: v.string(),
        measuredAt: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const latest = new Map<
      "soil" | "light" | "temperature" | "air" | "water" | "current",
      { value: number; unit: string; measuredAt: number }
    >();
    for (const r of args.readings) {
      await ctx.db.insert("sensorReadings", {
        deviceId: args.deviceId,
        plantId: args.plantId,
        kind: r.kind,
        value: r.value,
        unit: r.unit,
        measuredAt: r.measuredAt,
      });
      const prev = latest.get(r.kind);
      if (!prev || r.measuredAt > prev.measuredAt) {
        latest.set(r.kind, { value: r.value, unit: r.unit, measuredAt: r.measuredAt });
      }
    }
    for (const [kind, l] of latest) {
      const existing = await ctx.db
        .query("sensors")
        .withIndex("by_device_and_kind", (q) =>
          q.eq("deviceId", args.deviceId).eq("kind", kind),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, {
          plantId: args.plantId,
          value: l.value,
          unit: l.unit,
          measuredAt: l.measuredAt,
        });
      } else {
        await ctx.db.insert("sensors", {
          deviceId: args.deviceId,
          plantId: args.plantId,
          kind,
          value: l.value,
          unit: l.unit,
          measuredAt: l.measuredAt,
          createdAt: now,
        });
      }
    }
    return args.readings.length;
  },
});
