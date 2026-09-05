"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import plantsData from "./seedData/plants";
import productsData from "./seedData/products";
import blogData from "./seedData/blog";
import usersData from "./seedData/users";
import devicesData from "./seedData/devices";
import userPlantsData from "./seedData/userPlants";
import communityListingsData from "./seedData/communityListings";
import communityPostsData from "./seedData/communityPosts";
import { ensureBucket, uploadFile } from "./seedData/storage";
import type { Id } from "./_generated/dataModel";

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

const day = 86400000;

// ─── Admin ────────────────────────────────────────────────

export const admin = internalAction({
  handler: async (ctx): Promise<string | undefined> => {
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

    return user?._id;
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

// ─── Users ────────────────────────────────────────────────

export const users = internalAction({
  handler: async (ctx) => {
    const userIds: Id<"users">[] = [];

    for (let i = 0; i < usersData.length; i++) {
      const u = usersData[i]!;
      const result = await ctx.runAction(internal.seedInternal.signUpUser, {
        email: u.email,
        password: u.password,
        name: u.name,
        handle: u.handle,
        role: u.role,
        tier: u.tier,
      });

      if (result.created) {
        console.log(`[seed] User ${i} "${u.name}" created`);
      } else {
        console.log(`[seed] User ${i} "${u.name}" already exists`);
      }
      userIds.push(result._id);
    }

    return userIds;
  },
});

// ─── Devices ──────────────────────────────────────────────

export const devices = internalAction({
  handler: async (ctx) => {
    const deviceIds: string[] = [];

    for (let i = 0; i < devicesData.length; i++) {
      const d = devicesData[i]!;

      const existing = await ctx.runQuery(internal.seedInternal.lookupDeviceById, {
        deviceId: d.deviceId,
      });
      if (existing) {
        console.log(`[seed] Device ${i} "${d.deviceId}" already exists, skipping`);
        deviceIds.push(existing._id);
        continue;
      }

      await ctx.runMutation(internal.seedInternal.insertDevice, {
        deviceId: d.deviceId,
        name: d.name,
        version: d.version,
        lastSeen: d.lastSeen,
        firmwareVersion: d.firmwareVersion,
        hasModem: d.hasModem,
        hasSolarPanel: d.hasSolarPanel,
        batteryCapacityAh: d.batteryCapacityAh,
        batterySoC: d.batterySoC,
        tankCapacity: d.tankCapacity,
        autoWatering: d.autoWatering,
        autoLighting: d.autoLighting,
        wateringThreshold: d.wateringThreshold,
        wateringDuration: d.wateringDuration,
        wateringCooldown: d.wateringCooldown,
        lightingThreshold: d.lightingThreshold,
        lightingHysteresis: d.lightingHysteresis,
      });

      const inserted = await ctx.runQuery(internal.seedInternal.lookupDeviceById, {
        deviceId: d.deviceId,
      });
      deviceIds.push(inserted!._id);

      console.log(`[seed] Device ${i} "${d.name}" seeded`);
    }

    return deviceIds;
  },
});

// ─── Claim Devices + Create Plants ────────────────────────

export const processClaims = internalAction({
  handler: async (ctx) => {
    const deviceDocs = await ctx.runQuery(internal.seedInternal.listAllDevices);
    const userIds: Id<"users">[] = [];

    // Collect all user IDs
    for (const u of usersData) {
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: u.email });
      if (user) userIds.push(user._id);
    }

    if (userIds.length < 20) {
      console.log(`[seed] Only ${userIds.length} users found, skipping claims`);
      return;
    }

    // Claim first 20 devices for the 20 users
    for (let i = 0; i < 20 && i < deviceDocs.length; i++) {
      const device = deviceDocs[i]!;

      if (device.userId) {
        console.log(`[seed] Device ${device.deviceId} already claimed, skipping`);
        continue;
      }

      await ctx.runMutation(internal.seedInternal.claimDeviceByUser, {
        deviceId: device._id,
        userId: userIds[i]!,
      });

      console.log(`[seed] Device ${device.deviceId} claimed by ${usersData[i]!.name}`);
    }

    // Refresh device docs after claiming
    const refreshedDevices = await ctx.runQuery(internal.seedInternal.listAllDevices);

    // Create plants on the claimed devices
    for (let i = 0; i < userPlantsData.length; i++) {
      const up = userPlantsData[i]!;
      const device = refreshedDevices[up.deviceIndex]!;

      if (!device || !device.userId) {
        console.log(`[seed] Device ${up.deviceIndex} not claimed, skipping plant`);
        continue;
      }

      // Look up plant catalog entry for sensor/lifecycle profile
      const catalogEntry = await ctx.runQuery(internal.seedInternal.lookupPlantByKey, {
        key: up.catalogKey,
      });

      if (!catalogEntry) {
        console.log(`[seed] Plant catalog "${up.catalogKey}" not found, skipping`);
        continue;
      }

      const plantId = await ctx.runMutation(internal.seedInternal.insertUserPlant, {
        deviceId: device._id,
        name: up.name,
        species: catalogEntry.species,
        growthStage: up.growthStage,
        wateringThreshold: catalogEntry.wateringThreshold,
        lightingThreshold: catalogEntry.lightingThreshold,
        sensorProfile: catalogEntry.sensorProfile,
        lifecycleProfile: catalogEntry.lifecycleProfile,
        location: catalogEntry.location,
        plantedAt: up.plantedAt,
      });

      // Create care schedule for plant
      await ctx.runMutation(internal.seedInternal.insertCareSchedule, {
        plantId,
        title: "Penyiraman Otomatis",
        cadenceUnit: "days",
        cadenceValue: 1,
        enabled: true,
        nextRunAt: up.plantedAt + day,
      });

      // Create grow event for planting
      await ctx.runMutation(internal.seedInternal.insertGrowEvent, {
        deviceId: device._id,
        plantId,
        userId: device.userId!,
        source: "user",
        entityType: "plant",
        eventType: "plant_added",
        title: "Tanaman baru ditambahkan",
        detail: `${up.name} (${catalogEntry.species}) ditanam di perangkat ${device.name}`,
        timestamp: up.plantedAt,
      });

      // Create user activity
      await ctx.runMutation(internal.seedInternal.insertUserActivity, {
        userId: device.userId!,
        activityType: "plant_added",
        points: 50,
        relatedId: plantId,
      });

      // Add some automation events for variety
      if (i % 3 === 0) {
        await ctx.runMutation(internal.seedInternal.insertGrowEvent, {
          deviceId: device._id,
          plantId,
          userId: device.userId!,
          source: "automation",
          entityType: "automation",
          eventType: "system_watering",
          title: "Penyiraman otomatis",
          detail: "Sistem menyiram tanaman secara otomatis berdasarkan sensor kelembaban",
          timestamp: up.plantedAt + 3 * day,
        });
      }

      console.log(`[seed] Plant "${up.name}" created on device ${device.deviceId}`);
    }
  },
});

// ─── Community Listings ───────────────────────────────────

export const community = internalAction({
  handler: async (ctx) => {
    const userIds: Id<"users">[] = [];
    for (const u of usersData) {
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: u.email });
      if (user) userIds.push(user._id);
    }

    if (userIds.length < 20) {
      console.log("[seed] Not enough users for community data");
      return;
    }

    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";
    await ensureBucket(bucket);

    for (let i = 0; i < communityListingsData.length; i++) {
      const listing = communityListingsData[i]!;
      const sellerId = userIds[listing.sellerIndex];

      if (!sellerId) {
        console.log(`[seed] Seller index ${listing.sellerIndex} not found`);
        continue;
      }

      const imageUrl = await uploadSeedImages(
        bucket,
        listing.image.hash,
        listing.image.sizes,
      );

      await ctx.runMutation(internal.seedInternal.insertCommunityListing, {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        quantityAvailable: listing.quantityAvailable,
        priceUnit: listing.priceUnit,
        sellerId,
        imageUrl,
        locationLabel: listing.locationLabel,
        contactPreference: listing.contactPreference,
      });

      console.log(`[seed] Community listing "${listing.title}" seeded`);
    }

    // Community posts + comments + likes
    for (let i = 0; i < communityPostsData.length; i++) {
      const post = communityPostsData[i]!;
      const authorId = userIds[post.userIndex];

      if (!authorId) {
        console.log(`[seed] Author index ${post.userIndex} not found`);
        continue;
      }

      const postImageUrl = post.image
        ? await uploadSeedImages(bucket, post.image.hash, post.image.sizes)
        : undefined;

      const postId = await ctx.runMutation(internal.seedInternal.insertCommunityPost, {
        userId: authorId,
        title: post.title,
        body: post.body,
        imageUrl: postImageUrl,
      });

      // Add a like from another random user
      const likerIdx = (post.userIndex + 3) % 20;
      const likerId = userIds[likerIdx];
      if (likerId) {
        await ctx.runMutation(internal.seedInternal.insertPostLike, {
          postId,
          userId: likerId,
        });
      }

      // Add a comment on ~30% of posts
      if (i % 3 === 0) {
        const commenterIdx = (post.userIndex + 5) % 20;
        const commenterId = userIds[commenterIdx];
        if (commenterId) {
          const comments = [
            "Wah, terima kasih infonya! Sangat membantu.",
            "Saya juga pernah mengalami hal serupa. Ternyata solusinya mudah ya.",
            "Mantap! Hasil panennya kelihatan segar sekali.",
            "Good info! Langsung saya coba tipsnya.",
            "Baru tahu kalau ada cara semudah ini. Makasih分享nya!",
            "Keren banget! Semoga saya bisa seperti ini suatu hari.",
            "Aku juga pakai GrowMate dan puas banget hasilnya.",
            "Wah saya baru mau coba, jadi tambah semangat!",
          ];
          const comment = comments[i % comments.length]!;

          await ctx.runMutation(internal.seedInternal.insertPostComment, {
            postId,
            userId: commenterId,
            body: comment,
          });
        }
      }

      if (i % 20 === 0) {
        console.log(`[seed] Post ${i + 1}/${communityPostsData.length} seeded`);
      }
    }

    console.log(`[seed] All ${communityPostsData.length} community posts seeded`);
  },
});

// ─── Comprehensive: Run Everything ────────────────────────

export const comprehensive = internalAction({
  handler: async (ctx): Promise<Record<string, unknown>> => {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║     GROWMATE COMPREHENSIVE SEED START    ║");
    console.log("╚══════════════════════════════════════════╝");

    // 1. Admin
    console.log("\n─── 1/8: Admin ───");
    const adminId = await ctx.runAction(internal.seed.admin);

    // 2. Plant Catalog
    console.log("\n─── 2/8: Plant Catalog ───");
    await ctx.runAction(internal.seed.plants);

    // 3. Users (20)
    console.log("\n─── 3/8: Users (20) ───");
    const userIds = await ctx.runAction(internal.seed.users);
    console.log(`  ${userIds.length} users created/found`);

    // 4. Devices (25)
    console.log("\n─── 4/8: Devices (25) ───");
    const deviceIds = await ctx.runAction(internal.seed.devices);
    console.log(`  ${deviceIds.length} devices created/found`);

    // 5. Claims + Plants (20 claims, 20 plants)
    console.log("\n─── 5/8: Claims + Plants ───");
    await ctx.runAction(internal.seed.processClaims);

    // 6. Official Products (2)
    console.log("\n─── 6/8: Official Products (2) ───");
    await ctx.runAction(internal.seed.products);

    // 7. Community (14 listings + 60 posts)
    console.log("\n─── 7/8: Community Listings + Posts ───");
    await ctx.runAction(internal.seed.community);

    // 8. Blog Articles (24)
    console.log("\n─── 8/8: Blog Articles (24) ───");
    await ctx.runAction(internal.seed.blog);

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║     GROWMATE COMPREHENSIVE SEED DONE     ║");
    console.log("╚══════════════════════════════════════════╝");

    return {
      adminId,
      userCount: userIds.length,
      deviceCount: deviceIds.length,
      plantCount: userPlantsData.length,
      listingCount: communityListingsData.length,
      postCount: communityPostsData.length,
      blogCount: blogData.length,
    };
  },
});
