// Single source of truth lives in convex/types.ts.
// This module re-exports shared plant types/defaults and keeps only UI-only
// labels and the custom-preset default here.
export type {
  LifecycleProfile,
  PlantSensorProfile,
  PlantStageValue as PlantLifecycleStage,
  SensorRange,
} from '../../convex/types'
export {
  defaultLifecycleProfile,
  defaultPlantSensorProfile,
  DEFAULT_WATERING_THRESHOLD,
} from '../../convex/types'
import {
  defaultLifecycleProfile,
  defaultPlantSensorProfile,
  DEFAULT_WATERING_THRESHOLD,
} from '../../convex/types'

export type PlantPreset = {
  key: string
  name: string
  species: string
  growthStage: import('../../convex/types').PlantStageValue
  imageUrl: string | null
  description: string
  location: string
  category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'
  difficulty: 'easy' | 'medium' | 'advanced'
  wateringThreshold: number
  lightingThreshold: number
  fertilizingThreshold?: number
  fertilizerCadenceDays?: number
  pesticideCadenceDays?: number
  nutrientNotes?: string
  sensorProfile?: import('../../convex/types').PlantSensorProfile
  lifecycleProfile: import('../../convex/types').LifecycleProfile
}

export const defaultCustomPlantPreset: Pick<
  PlantPreset,
  'growthStage' | 'wateringThreshold' | 'lightingThreshold' | 'fertilizingThreshold' | 'fertilizerCadenceDays' | 'pesticideCadenceDays' | 'nutrientNotes' | 'sensorProfile' | 'lifecycleProfile'
> = {
  growthStage: 'seed_dormancy',
  wateringThreshold: DEFAULT_WATERING_THRESHOLD,
  lightingThreshold: 30,
  fertilizingThreshold: 35,
  fertilizerCadenceDays: 14,
  pesticideCadenceDays: 30,
  nutrientNotes: '',
  sensorProfile: defaultPlantSensorProfile,
  lifecycleProfile: defaultLifecycleProfile,
}

export const lifecycleStageOptions: Array<{ value: PlantPreset['growthStage']; label: string }> = [
  { value: 'seed_dormancy', label: 'Dormansi benih' },
  { value: 'germination', label: 'Perkecambahan' },
  { value: 'seedling_development', label: 'Perkembangan bibit' },
  { value: 'vegetative_growth', label: 'Pertumbuhan vegetatif' },
  { value: 'flowering_reproduction', label: 'Pembungaan / reproduksi' },
  { value: 'maturity_senescence', label: 'Kematangan / senesens' },
]
