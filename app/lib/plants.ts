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

export type SensorRange = {
  min: number
  max: number
}

export type PlantSensorProfile = {
  soil: SensorRange
  light: SensorRange
  temperature: SensorRange
  air: SensorRange
  water: SensorRange
}

export type PlantPreset = {
  key: string
  name: string
  species: string
  growthStage: PlantLifecycleStage
  imageUrl: string | null
  description: string
  location: string
  category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'
  difficulty: 'easy' | 'medium' | 'advanced'
  wateringThreshold: number
  lightingThreshold: number
  sensorProfile: PlantSensorProfile
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

export const defaultPlantSensorProfile: PlantSensorProfile = {
  soil: { min: 30, max: 80 },
  light: { min: 30, max: 80 },
  temperature: { min: 18, max: 28 },
  air: { min: 40, max: 70 },
  water: { min: 20, max: 90 },
}

export const defaultCustomPlantPreset: Pick<
  PlantPreset,
  'growthStage' | 'wateringThreshold' | 'lightingThreshold' | 'sensorProfile' | 'lifecycleProfile'
> = {
  growthStage: 'seed_dormancy',
  wateringThreshold: 34,
  lightingThreshold: 30,
  sensorProfile: defaultPlantSensorProfile,
  lifecycleProfile: defaultLifecycleProfile,
}

export const lifecycleStageOptions: Array<{ value: PlantLifecycleStage; label: string }> = [
  { value: 'seed_dormancy', label: 'Dormansi benih' },
  { value: 'germination', label: 'Perkecambahan' },
  { value: 'seedling_development', label: 'Perkembangan bibit' },
  { value: 'vegetative_growth', label: 'Pertumbuhan vegetatif' },
  { value: 'flowering_reproduction', label: 'Pembungaan / reproduksi' },
  { value: 'maturity_senescence', label: 'Kematangan / senesens' },
]
