 
import { describe, it, expect } from 'vitest'
import {
  sensorKinds,
  lifecycleStages,
  plantStagePoints,
  defaultLifecycleProfile,
  DEFAULT_WATERING_THRESHOLD,
  DEFAULT_LIGHTING_THRESHOLD,
  DEFAULT_WATERING_DURATION,
  DEFAULT_WATERING_COOLDOWN,
  DEFAULT_LIGHTING_HYSTERESIS,
  ADC_RAW_MIN,
  ADC_RAW_MAX,
} from '../../convex/types'
import { ACTIVITY_POINTS } from '../../convex/helpers'
import type { SensorKind, PlantStageValue } from '../../convex/types'

describe('constants', () => {
  it('DEFAULT_WATERING_THRESHOLD is a positive number', () => {
    expect(DEFAULT_WATERING_THRESHOLD).toBeGreaterThan(0)
  })

  it('DEFAULT_LIGHTING_THRESHOLD is a positive number', () => {
    expect(DEFAULT_LIGHTING_THRESHOLD).toBeGreaterThan(0)
  })

  it('DEFAULT_WATERING_DURATION is a positive number', () => {
    expect(DEFAULT_WATERING_DURATION).toBeGreaterThan(0)
  })

  it('DEFAULT_WATERING_COOLDOWN is a positive number', () => {
    expect(DEFAULT_WATERING_COOLDOWN).toBeGreaterThan(0)
  })

  it('DEFAULT_LIGHTING_HYSTERESIS is a positive number', () => {
    expect(DEFAULT_LIGHTING_HYSTERESIS).toBeGreaterThan(0)
  })

  it('ADC_RAW_MAX > ADC_RAW_MIN', () => {
    expect(ADC_RAW_MAX).toBeGreaterThan(ADC_RAW_MIN)
  })

  it('ADC_RAW_MIN is 0', () => {
    expect(ADC_RAW_MIN).toBe(0)
  })

  it('ADC_RAW_MAX is 65535', () => {
    expect(ADC_RAW_MAX).toBe(65535)
  })
})

describe('ACTIVITY_POINTS', () => {
  it('has expected keys', () => {
    expect(Object.keys(ACTIVITY_POINTS)).toEqual([
      'post_created',
      'comment_created',
      'post_liked',
      'plant_added',
      'watering_completed',
    ])
  })

  it('all point values are positive', () => {
    const values = Object.values(ACTIVITY_POINTS)
    expect(values.every(v => v > 0)).toBe(true)
  })

  it('post_created has highest points', () => {
    expect(ACTIVITY_POINTS.post_created).toBe(50)
  })

  it('comment_created has 10 points', () => {
    expect(ACTIVITY_POINTS.comment_created).toBe(10)
  })

  it('post_liked has 5 points', () => {
    expect(ACTIVITY_POINTS.post_liked).toBe(5)
  })

  it('plant_added has 25 points', () => {
    expect(ACTIVITY_POINTS.plant_added).toBe(25)
  })

  it('watering_completed has 5 points', () => {
    expect(ACTIVITY_POINTS.watering_completed).toBe(5)
  })
})

describe('lifecycleStages', () => {
  it('has 6 stages', () => {
    expect(lifecycleStages).toHaveLength(6)
  })

  it('contains seed_dormancy as first stage', () => {
    expect(lifecycleStages[0].key).toBe('seed_dormancy')
    expect(lifecycleStages[0].label).toBe('Dormansi benih')
    expect(lifecycleStages[0].durationKey).toBe('seedDormancyDays')
  })

  it('contains germination as second stage', () => {
    expect(lifecycleStages[1].key).toBe('germination')
    expect(lifecycleStages[1].label).toBe('Perkecambahan')
    expect(lifecycleStages[1].durationKey).toBe('germinationDays')
  })

  it('contains seedling_development as third stage', () => {
    expect(lifecycleStages[2].key).toBe('seedling_development')
    expect(lifecycleStages[2].label).toBe('Perkembangan bibit')
    expect(lifecycleStages[2].durationKey).toBe('seedlingDevelopmentDays')
  })

  it('contains vegetative_growth as fourth stage', () => {
    expect(lifecycleStages[3].key).toBe('vegetative_growth')
    expect(lifecycleStages[3].label).toBe('Pertumbuhan vegetatif')
    expect(lifecycleStages[3].durationKey).toBe('vegetativeGrowthDays')
  })

  it('contains flowering_reproduction as fifth stage', () => {
    expect(lifecycleStages[4].key).toBe('flowering_reproduction')
    expect(lifecycleStages[4].label).toBe('Pembungaan / reproduksi')
    expect(lifecycleStages[4].durationKey).toBe('floweringReproductionDays')
  })

  it('contains maturity_senescence as sixth stage', () => {
    expect(lifecycleStages[5].key).toBe('maturity_senescence')
    expect(lifecycleStages[5].label).toBe('Kematangan / senesens')
    expect(lifecycleStages[5].durationKey).toBe('maturitySenescenceDays')
  })
})

describe('sensorKinds', () => {
  it('contains all 5 sensor kinds', () => {
    expect(sensorKinds).toHaveLength(5)
  })

  it('includes all expected kinds', () => {
    const all: SensorKind[] = ['soil', 'light', 'temperature', 'air', 'water']
    expect(sensorKinds).toEqual(all)
  })
})

describe('plantStagePoints', () => {
  it('has correct point values for each stage', () => {
    const expected: Record<PlantStageValue, number> = {
      seed_dormancy: 5,
      germination: 10,
      seedling_development: 20,
      vegetative_growth: 35,
      flowering_reproduction: 50,
      maturity_senescence: 65,
    }
    expect(plantStagePoints).toEqual(expected)
  })

  it('points increase with each stage', () => {
    const keys = Object.keys(plantStagePoints) as PlantStageValue[]
    for (let i = 1; i < keys.length; i++) {
      expect(plantStagePoints[keys[i]]).toBeGreaterThan(plantStagePoints[keys[i - 1]!]!)
    }
  })

  it('all point values are positive', () => {
    const values = Object.values(plantStagePoints)
    expect(values.every(v => v > 0)).toBe(true)
  })
})

describe('defaultLifecycleProfile', () => {
  it('has 6 keys', () => {
    expect(Object.keys(defaultLifecycleProfile)).toHaveLength(6)
  })

  it('seedDormancyDays is 7', () => {
    expect(defaultLifecycleProfile.seedDormancyDays).toBe(7)
  })

  it('germinationDays is 10', () => {
    expect(defaultLifecycleProfile.germinationDays).toBe(10)
  })

  it('seedlingDevelopmentDays is 14', () => {
    expect(defaultLifecycleProfile.seedlingDevelopmentDays).toBe(14)
  })

  it('vegetativeGrowthDays is 30', () => {
    expect(defaultLifecycleProfile.vegetativeGrowthDays).toBe(30)
  })

  it('floweringReproductionDays is 24', () => {
    expect(defaultLifecycleProfile.floweringReproductionDays).toBe(24)
  })

  it('maturitySenescenceDays is 20', () => {
    expect(defaultLifecycleProfile.maturitySenescenceDays).toBe(20)
  })

  it('all values are positive', () => {
    const values = Object.values(defaultLifecycleProfile)
    expect(values.every(v => v > 0)).toBe(true)
  })
})
