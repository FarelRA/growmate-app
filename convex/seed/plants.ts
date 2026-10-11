"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import plantsData from "../seedData/plants";
import fieldCropsData from "../seedData/fieldCrops";
import { uploadSeedImageSet } from "./images";

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
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
    const bucket = env.RUSTFS_BUCKET_IMAGE ?? "growmate-images";

    let created = 0;
    let skipped = 0;
    // Original 10 pod favorites first, then the ~500 field/pods catalog.
    for (const plant of [...plantsData, ...fieldCropsData]) {
      const existing = await ctx.runQuery(internal.seedInternal.lookupPlantByKey, {
        key: plant.key,
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      // Image bytes are fetched from /seed-images (see convex/seed/images.ts);
      // missing keys are (re)uploaded even for pre-existing rows below.
      const imageUrl = await uploadSeedImageSet(bucket, plant.image.hash);

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
        fertilizingThreshold: plant.fertilizingThreshold,
        fertilizerCadenceDays: plant.fertilizerCadenceDays,
        pesticideCadenceDays: plant.pesticideCadenceDays,
        nutrientNotes: plant.nutrientNotes,
        suitableFor: plant.suitableFor,
        sensorProfile: getSensorProfile(plant.sensorProfile),
        lifecycleProfile: getLifecycleProfile(plant.lifecycleProfile),
        imageUrl,
      });
      created += 1;
    }
    console.log(`[seed] plants: ${created} created, ${skipped} already present`);
  },
});
