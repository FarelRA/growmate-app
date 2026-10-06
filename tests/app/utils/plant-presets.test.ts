import { describe, it, expect } from 'vitest'
import {
  ADC_RAW_MAX,
  ADC_RAW_MIN,
  DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_FERTILIZING_DURATION,
  DEFAULT_FERTILIZING_THRESHOLD,
  DEFAULT_LIGHTING_HYSTERESIS,
  DEFAULT_LIGHTING_THRESHOLD,
  DEFAULT_PESTICIDE_COOLDOWN,
  DEFAULT_PESTICIDE_DURATION,
  DEFAULT_PESTICIDE_THRESHOLD,
  DEFAULT_TANK_CAPACITY,
  DEFAULT_TANK_MIN_LEVEL,
  DEFAULT_WATERING_COOLDOWN,
  DEFAULT_WATERING_DURATION,
  DEFAULT_WATERING_THRESHOLD,
  defaultLifecycleProfile,
  defaultPlantSensorProfile,
} from '../../../convex/types'
import {
  defaultCustomPlantPreset,
  lifecycleStageOptions,
} from '../../../app/utils/plant-presets'

describe('defaultCustomPlantPreset', () => {
  it('uses the seed_dormancy growth stage', () => {
    expect(defaultCustomPlantPreset.growthStage).toBe('seed_dormancy')
  })

  it('matches the backend watering threshold source value', () => {
    expect(defaultCustomPlantPreset.wateringThreshold).toBe(DEFAULT_WATERING_THRESHOLD)
    expect(defaultCustomPlantPreset.wateringThreshold).toBe(35)
  })

  it('matches the remaining threshold / cadence source values', () => {
    expect(defaultCustomPlantPreset.lightingThreshold).toBe(30)
    expect(defaultCustomPlantPreset.fertilizingThreshold).toBe(35)
    expect(defaultCustomPlantPreset.fertilizerCadenceDays).toBe(14)
    expect(defaultCustomPlantPreset.pesticideCadenceDays).toBe(30)
    expect(defaultCustomPlantPreset.nutrientNotes).toBe('')
  })

  it('reuses the backend default sensor profile', () => {
    expect(defaultCustomPlantPreset.sensorProfile).toEqual(defaultPlantSensorProfile)
  })

  it('reuses the backend default lifecycle profile', () => {
    expect(defaultCustomPlantPreset.lifecycleProfile).toEqual(defaultLifecycleProfile)
  })
})

describe('backend threshold constants', () => {
  it('exposes the expected watering / lighting defaults', () => {
    expect(DEFAULT_WATERING_THRESHOLD).toBe(35)
    expect(DEFAULT_WATERING_DURATION).toBe(8)
    expect(DEFAULT_WATERING_COOLDOWN).toBe(6 * 60 * 60)
    expect(DEFAULT_LIGHTING_THRESHOLD).toBe(30)
    expect(DEFAULT_LIGHTING_HYSTERESIS).toBe(8)
  })

  it('exposes the expected fertilizing / pesticide defaults', () => {
    expect(DEFAULT_FERTILIZING_THRESHOLD).toBe(35)
    expect(DEFAULT_FERTILIZING_DURATION).toBe(10)
    expect(DEFAULT_FERTILIZING_COOLDOWN).toBe(432000)
    expect(DEFAULT_PESTICIDE_THRESHOLD).toBe(0)
    expect(DEFAULT_PESTICIDE_DURATION).toBe(10)
    expect(DEFAULT_PESTICIDE_COOLDOWN).toBe(604800)
  })

  it('exposes tank and ADC bounds', () => {
    expect(DEFAULT_TANK_CAPACITY).toBe(10)
    expect(DEFAULT_TANK_MIN_LEVEL).toBe(10)
    expect(ADC_RAW_MIN).toBe(0)
    expect(ADC_RAW_MAX).toBe(65535)
  })
})

describe('backend default profiles', () => {
  it('has the expected lifecycle durations', () => {
    expect(defaultLifecycleProfile).toEqual({
      seedDormancyDays: 7,
      germinationDays: 10,
      seedlingDevelopmentDays: 14,
      vegetativeGrowthDays: 30,
      floweringReproductionDays: 24,
      maturitySenescenceDays: 20,
    })
  })

  it('has the expected sensor ranges', () => {
    expect(defaultPlantSensorProfile).toEqual({
      soil: { min: 30, max: 80 },
      light: { min: 30, max: 80 },
      temperature: { min: 18, max: 28 },
      air: { min: 40, max: 70 },
      water: { min: 20, max: 90 },
    })
  })
})

describe('lifecycleStageOptions', () => {
  it('covers all six plant stages with unique values and labels', () => {
    expect(lifecycleStageOptions).toHaveLength(6)
    const values = lifecycleStageOptions.map((o) => o.value)
    expect(values).toEqual([
      'seed_dormancy',
      'germination',
      'seedling_development',
      'vegetative_growth',
      'flowering_reproduction',
      'maturity_senescence',
    ])
    expect(new Set(values).size).toBe(6)
    for (const option of lifecycleStageOptions) {
      expect(option.label.length).toBeGreaterThan(0)
    }
  })
})
