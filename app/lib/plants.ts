export type PlantLifecycleStage =
  | 'seed_dormancy'
  | 'germination'
  | 'seedling_development'
  | 'vegetative_growth'
  | 'flowering_reproduction'
  | 'maturity_senescence'

export type LifecycleProfile = {
  seedDormancyDays: number
  germinationDays: number
  seedlingDevelopmentDays: number
  vegetativeGrowthDays: number
  floweringReproductionDays: number
  maturitySenescenceDays: number
}

export type PlantPreset = {
  key: string
  name: string
  species: string
  growthStage: PlantLifecycleStage
  image: string
  description: string
  location: string
  category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'
  difficulty: 'easy' | 'medium' | 'advanced'
  wateringThreshold: number
  lightingThreshold: number
  lifecycleProfile: LifecycleProfile
}

export const defaultLifecycleProfile: LifecycleProfile = {
  seedDormancyDays: 7,
  germinationDays: 10,
  seedlingDevelopmentDays: 14,
  vegetativeGrowthDays: 30,
  floweringReproductionDays: 24,
  maturitySenescenceDays: 20,
}

export const defaultCustomPlantPreset: Pick<PlantPreset, 'growthStage' | 'wateringThreshold' | 'lightingThreshold' | 'lifecycleProfile'> = {
  growthStage: 'seed_dormancy',
  wateringThreshold: 34,
  lightingThreshold: 30,
  lifecycleProfile: defaultLifecycleProfile,
}

export const lifecycleStageOptions: Array<{ value: PlantLifecycleStage; label: string }> = [
  { value: 'seed_dormancy', label: 'Seed dormancy' },
  { value: 'germination', label: 'Germination' },
  { value: 'seedling_development', label: 'Seedling development' },
  { value: 'vegetative_growth', label: 'Vegetative growth' },
  { value: 'flowering_reproduction', label: 'Flowering / reproduction' },
  { value: 'maturity_senescence', label: 'Maturity / senescence' },
]
