import type { Ctx, LifecycleProfile, PlantStageValue, PlantDoc } from '../types'
import { lifecycleStages, defaultLifecycleProfile } from '../types'
import { resolveStoredImageUrl } from './generic'
import { defaultPlantSensorProfile, normalizePlantSensorProfile } from './sensors'

export function normalizeLifecycleProfile(profile?: Partial<LifecycleProfile> | null): LifecycleProfile {
  return {
    seedDormancyDays: profile?.seedDormancyDays ?? defaultLifecycleProfile.seedDormancyDays,
    germinationDays: profile?.germinationDays ?? defaultLifecycleProfile.germinationDays,
    seedlingDevelopmentDays:
      profile?.seedlingDevelopmentDays ?? defaultLifecycleProfile.seedlingDevelopmentDays,
    vegetativeGrowthDays:
      profile?.vegetativeGrowthDays ?? defaultLifecycleProfile.vegetativeGrowthDays,
    floweringReproductionDays:
      profile?.floweringReproductionDays ?? defaultLifecycleProfile.floweringReproductionDays,
    maturitySenescenceDays:
      profile?.maturitySenescenceDays ?? defaultLifecycleProfile.maturitySenescenceDays,
  }
}

export function formatPlantStage(stage: PlantStageValue) {
  return lifecycleStages.find((item) => item.key === stage)?.label ?? stage
}

export function computePlantProgress(
  plant: Pick<PlantDoc, 'growthStage' | 'plantedAt' | 'lifecycleProfile'>,
) {
  const lifecycleProfile = normalizeLifecycleProfile(plant.lifecycleProfile)
  const normalizedStage = plant.growthStage as PlantStageValue
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - plant.plantedAt) / (24 * 60 * 60 * 1000)),
  )

  let offsetDays = 0
  for (const stage of lifecycleStages) {
    if (stage.key === normalizedStage) break
    offsetDays += lifecycleProfile[stage.durationKey as keyof LifecycleProfile]
  }

  const totalDays = (Object.keys(lifecycleProfile) as (keyof LifecycleProfile)[]).reduce(
    (total, key) => total + lifecycleProfile[key],
    0,
  )
  const progressDays = Math.min(offsetDays + elapsedDays, totalDays)

  let cursor = 0
  let activeStage = lifecycleStages[lifecycleStages.length - 1]!

  const stages = lifecycleStages.map((stage) => {
    const duration = lifecycleProfile[stage.durationKey as keyof LifecycleProfile]
    const startDay = cursor
    const endDay = cursor + duration
    const complete = progressDays >= endDay
    const active = !complete && progressDays >= startDay && progressDays < endDay
    if (active) activeStage = stage
    cursor = endDay
    return {
      key: stage.key,
      label: stage.label,
      duration,
      startDay,
      endDay,
      complete,
      active,
    }
  })

  return {
    currentStage: activeStage.key,
    currentStageLabel: activeStage.label,
    elapsedDays,
    progressDays,
    totalDays,
    percent: Math.max(0, Math.min(100, Math.round((progressDays / Math.max(totalDays, 1)) * 100))),
    stages,
  }
}

export async function buildPlantView(ctx: Ctx, plant: PlantDoc) {
  return {
    ...plant,
    sensorProfile: normalizePlantSensorProfile(plant.sensorProfile),
    image: await resolveStoredImageUrl(ctx, plant.imageStorageId, plant.image),
  }
}

export function getHealthComputationGuide(profile = defaultPlantSensorProfile) {
  const normalized = normalizePlantSensorProfile(profile)
  return {
    sensorOptimalRanges: {
      soil: `${normalized.soil.min} to ${normalized.soil.max}`,
      light: `${normalized.light.min} to ${normalized.light.max}`,
      temperature: `${normalized.temperature.min} to ${normalized.temperature.max}`,
      air: `${normalized.air.min} to ${normalized.air.max}`,
      water: `${normalized.water.min} to ${normalized.water.max}`,
    },
    scoring: {
      perSensor: '100 jika optimal, 50 jika terlalu rendah atau terlalu tinggi',
      noSensorData: 'skor 0 dan kondisi tanaman dianggap kurang stabil',
      finalScore: 'rata-rata semua skor sensor yang dibulatkan ke bilangan bulat terdekat',
    },
    labels: {
      excellent: '80 sampai 100',
      good: '60 sampai 79',
      fair: '40 sampai 59',
      poor: '0 sampai 39',
    },
  }
}
