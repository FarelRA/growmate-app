import { v, type GenericId } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "./_generated/server";
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
    return await ctx.db.query("devices").order("desc").collect();
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
    eventType: v.string(),
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eventType: args.eventType as any,
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
