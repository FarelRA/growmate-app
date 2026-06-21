export type SeedImageSize = '50w' | '200w' | '400w' | '800w' | '1200w'

export interface SeedImage {
  hash: string
  sizes: Record<SeedImageSize, string>
}

export interface SeedSensorRange {
  min: number
  max: number
}

export interface SeedSensorProfile {
  soil: SeedSensorRange
  light: SeedSensorRange
  temperature: SeedSensorRange
  air: SeedSensorRange
  water: SeedSensorRange
}

export interface SeedLifecycleProfile {
  seedDormancyDays: number
  germinationDays: number
  seedlingDevelopmentDays: number
  vegetativeGrowthDays: number
  floweringReproductionDays: number
  maturitySenescenceDays: number
}

export interface PlantSeedData {
  key: string
  name: string
  species: string
  description: string
  location: string
  category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'
  difficulty: 'easy' | 'medium' | 'advanced'
  wateringThreshold: number
  lightingThreshold: number
  sensorProfile: SeedSensorProfile
  lifecycleProfile: SeedLifecycleProfile
  image: SeedImage
}

export interface ProductSeedData {
  title: string
  description: string
  price: number
  category: string
  quantityAvailable: number
  priceUnit: string
  featured: boolean
  shopeeUrl?: string
  image: SeedImage
}

export interface BlogSeedData {
  title: string
  excerpt: string
  body: string
  published: boolean
  featured: boolean
  image: SeedImage
}
