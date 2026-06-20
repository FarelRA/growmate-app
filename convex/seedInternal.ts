import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { plantSensorProfile, lifecycleProfileValidator } from "./schema";

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
