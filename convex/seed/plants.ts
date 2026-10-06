"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import plantsData from "../seedData/plants";
import { ensureBucket, uploadFile } from "../seedData/storage";

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

    }
  },
});
