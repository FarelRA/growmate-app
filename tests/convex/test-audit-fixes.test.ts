import { describe, it, expect } from 'vitest'
import {
  defaultPlantSensorProfile as typesDefaultProfile,
  defaultLifecycleProfile,
  DEFAULT_WATERING_THRESHOLD,
} from '../../convex/types'
import { defaultPlantSensorProfile as helperDefaultProfile } from '../../convex/helpers/sensors'
import {
  defaultCustomPlantPreset,
} from '../../app/utils/plant-presets'
import { formatDeviceDetail } from '../../convex/helpers/devices'
import {
  toggleScheduleCore,
  deleteScheduleCore,
  saveScheduleCore,
  triggerWateringCore,
  triggerLightingCore,
  triggerFertilizingCore,
  triggerPesticideCore,
} from '../../convex/care'
import { MAX_AI_RESPONSE_CHARS } from '../../convex/assistant'
import { enrichMarketplaceProducts } from '../../convex/helpers/marketplace'

describe('audit fixes: single sources and shared helpers', () => {
  it('types.ts is the single source for the default sensor profile', () => {
    expect(typesDefaultProfile).toEqual({
      soil: { min: 30, max: 80 },
      light: { min: 30, max: 80 },
      temperature: { min: 18, max: 28 },
      air: { min: 40, max: 70 },
      water: { min: 20, max: 90 },
    })
    expect(helperDefaultProfile).toEqual(typesDefaultProfile)
    expect(defaultCustomPlantPreset.sensorProfile).toEqual(typesDefaultProfile)
  })

  it('app/utils/plant-presets.ts uses lifecycle defaults from types.ts', () => {
    expect(defaultCustomPlantPreset.lifecycleProfile).toEqual(defaultLifecycleProfile)
  })

  it('wateringThreshold drift fixed: custom preset uses 35', () => {
    expect(DEFAULT_WATERING_THRESHOLD).toBe(35)
    expect(defaultCustomPlantPreset.wateringThreshold).toBe(35)
  })

  it('formatDeviceDetail helper exists and care cores are exported', () => {
    expect(typeof formatDeviceDetail).toBe('function')
    for (const fn of [
      toggleScheduleCore,
      deleteScheduleCore,
      saveScheduleCore,
      triggerWateringCore,
      triggerLightingCore,
      triggerFertilizingCore,
      triggerPesticideCore,
    ]) {
      expect(typeof fn).toBe('function')
    }
  })

  it('AI response cap is defined', () => {
    expect(MAX_AI_RESPONSE_CHARS).toBe(4000)
  })

  it('batched marketplace enrichment is exported', () => {
    expect(typeof enrichMarketplaceProducts).toBe('function')
  })
})
