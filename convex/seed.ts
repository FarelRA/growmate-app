"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import plantsData from "./seedData/plants";
import productsData from "./seedData/products";
import blogData from "./seedData/blog";
import { ensureBucket, uploadFile } from "./seedData/storage";

// ─── Env helpers ──────────────────────────────────────────

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
}

function parseDataUri(uri: string): Buffer {
  const base64 = uri.split(",")[1]!;
  return Buffer.from(base64, "base64");
}

const IMAGE_SIZES_FOR_SEED = ["50w", "200w", "400w", "800w", "1200w"] as const;

async function uploadSeedImages(
  bucket: string,
  hash: string,
  sizes: Record<string, string>,
): Promise<string> {
  for (const size of IMAGE_SIZES_FOR_SEED) {
    const uri = sizes[size];
    if (!uri) continue;
    const buffer = parseDataUri(uri);
    await uploadFile(bucket, `${hash}/${size}.webp`, buffer, "image/webp");
  }
  return hash;
}

function getSensorProfile(v: {
  soil: { min: number; max: number };
  light: { min: number; max: number };
  temperature: { min: number; max: number };
  air: { min: number; max: number };
  water: { min: number; max: number };
}) {
  return {
    soil: { min: v.soil.min, max: v.soil.max },
    light: { min: v.light.min, max: v.light.max },
    temperature: { min: v.temperature.min, max: v.temperature.max },
    air: { min: v.air.min, max: v.air.max },
    water: { min: v.water.min, max: v.water.max },
  };
}

function getLifecycleProfile(v: {
  seedDormancyDays: number;
  germinationDays: number;
  seedlingDevelopmentDays: number;
  vegetativeGrowthDays: number;
  floweringReproductionDays: number;
  maturitySenescenceDays: number;
}) {
  return {
    seedDormancyDays: v.seedDormancyDays,
    germinationDays: v.germinationDays,
    seedlingDevelopmentDays: v.seedlingDevelopmentDays,
    vegetativeGrowthDays: v.vegetativeGrowthDays,
    floweringReproductionDays: v.floweringReproductionDays,
    maturitySenescenceDays: v.maturitySenescenceDays,
  };
}

// ─── Admin ────────────────────────────────────────────────

export const admin = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const email = env.ADMIN_EMAIL;
    const password = env.ADMIN_PASSWORD;

    if (!email || !password) return;

    const existing = await ctx.runQuery(internal.users.adminLookupByEmail, { email });
    if (existing && existing.role === "admin") return;

    try {
      await ctx.runAction(api.auth.signIn, {
        provider: "password",
        params: { email, password, flow: "signUp" },
      });
    } catch (error) {
      if (
        !(error instanceof Error && error.message.toLowerCase().includes("already exists"))
      ) {
        throw error;
      }
    }

    const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email });
    if (user && user.role !== "admin") {
      await ctx.runMutation(internal.users.internalSetAdminRole, {
        userId: user._id,
      });
    }
  },
});

// ─── Plant Catalog ────────────────────────────────────────

export const plants = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";

    await ensureBucket(bucket);

    for (const plant of plantsData) {
      const existing = await ctx.runQuery(internal.seedInternal.lookupPlantByKey, {
        key: plant.key,
      });
      if (existing) {
        console.log(`[seed] Plant "${plant.key}" already exists, skipping`);
        continue;
      }

      const imageUrl = await uploadSeedImages(
        bucket,
        plant.image.hash,
        plant.image.sizes,
      );

      await ctx.runMutation(internal.seedInternal.insertPlantPreset, {
        key: plant.key,
        name: plant.name,
        species: plant.species,
        description: plant.description,
        location: plant.location,
        category: plant.category,
        difficulty: plant.difficulty,
        wateringThreshold: plant.wateringThreshold,
        lightingThreshold: plant.lightingThreshold,
        sensorProfile: getSensorProfile(plant.sensorProfile),
        lifecycleProfile: getLifecycleProfile(plant.lifecycleProfile),
        imageUrl,
      });

      console.log(`[seed] Plant "${plant.key}" seeded`);
    }
  },
});

// ─── Official Products ────────────────────────────────────

export const products = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";
    const adminEmail = env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.log("[seed] ADMIN_EMAIL not set, skipping products");
      return;
    }

    const admin = await ctx.runQuery(internal.users.adminLookupByEmail, {
      email: adminEmail,
    });
    if (!admin) {
      console.log("[seed] Admin user not found, skipping products");
      return;
    }

    await ensureBucket(bucket);

    for (const product of productsData) {
      const existing = await ctx.runQuery(
        internal.seedInternal.lookupOfficialProductByTitle,
        { title: product.title },
      );
      if (existing) {
        console.log(`[seed] Product "${product.title}" already exists, skipping`);
        continue;
      }

      const imageUrl = await uploadSeedImages(
        bucket,
        product.image.hash,
        product.image.sizes,
      );

      await ctx.runMutation(internal.seedInternal.insertOfficialProduct, {
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        quantityAvailable: product.quantityAvailable,
        priceUnit: product.priceUnit,
        featured: product.featured,
        shopeeUrl: product.shopeeUrl,
        imageUrl,
        sellerId: admin._id,
      });

      console.log(`[seed] Product "${product.title}" seeded`);
    }
  },
});

// ─── Blog Posts ───────────────────────────────────────────

export const blog = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";
    const adminEmail = env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.log("[seed] ADMIN_EMAIL not set, skipping blog");
      return;
    }

    const admin = await ctx.runQuery(internal.users.adminLookupByEmail, {
      email: adminEmail,
    });
    if (!admin) {
      console.log("[seed] Admin user not found, skipping blog");
      return;
    }

    await ensureBucket(bucket);

    for (const post of blogData) {
      const existing = await ctx.runQuery(internal.seedInternal.lookupBlogPostByTitle, {
        title: post.title,
      });
      if (existing) {
        console.log(`[seed] Blog post "${post.title}" already exists, skipping`);
        continue;
      }

      const imageUrl = await uploadSeedImages(
        bucket,
        post.image.hash,
        post.image.sizes,
      );

      await ctx.runMutation(internal.seedInternal.insertBlogPost, {
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        published: post.published,
        featured: post.featured,
        imageUrl,
        authorId: admin._id,
      });

      console.log(`[seed] Blog post "${post.title}" seeded`);
    }
  },
});
