import {
  defaultLifecycleProfile,
  defaultPlantSensorProfile,
  DEFAULT_WATERING_THRESHOLD,
} from '../../convex/types'
import type {
  LifecycleProfile,
  PlantSensorProfile,
  PlantStageValue,
} from '../../convex/types'

export type PlantPreset = {
  key: string
  name: string
  species: string
  growthStage: PlantStageValue
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
  sensorProfile?: PlantSensorProfile
  lifecycleProfile: LifecycleProfile
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
