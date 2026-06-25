import { describe, it, expect } from 'vitest'
import {
  evaluateFertilizingRule,
  evaluatePesticideRule,
  estimateBatterySoC,
} from '../../convex/helpers/v2sensors'
import {
  DEFAULT_FERTILIZING_THRESHOLD,
  DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_PESTICIDE_COOLDOWN,
  DEFAULT_TANK_MIN_LEVEL,
} from '../../convex/types'
import type { DeviceDoc, PlantDoc } from '../../convex/types'

const baseDevice = {
  autoFertilizing: true,
  autoPesticide: true,
  fertilizingThreshold: DEFAULT_FERTILIZING_THRESHOLD,
  fertilizingDuration: 10,
  fertilizingCooldown: DEFAULT_FERTILIZING_COOLDOWN,
  pesticideThreshold: 50,
  pesticideDuration: 10,
  pesticideCooldown: DEFAULT_PESTICIDE_COOLDOWN,
  tankMinLevel: DEFAULT_TANK_MIN_LEVEL,
  lastFertilized: undefined,
  lastPesticideApplied: undefined,
} as unknown as DeviceDoc

const sensorState = new Map([
  ['soil', { value: 25, unit: '%' }],
  ['water', { value: 80, unit: '%' }],
  ['air', { value: 65, unit: '%' }],
])

const now = Date.now()

describe('evaluateFertilizingRule', () => {
  it('returns shouldFertilize=false when autoFertilizing is disabled', () => {
    const result = evaluateFertilizingRule(
      { ...baseDevice, autoFertilizing: false } as DeviceDoc,
      null,
      sensorState,
      now,
    )
    expect(result.shouldFertilize).toBe(false)
  })

  it('returns shouldFertilize=false when soil is above threshold', () => {
    const highSoil = new Map([['soil', { value: 50, unit: '%' }]])
    const result = evaluateFertilizingRule(baseDevice, null, highSoil, now)
    expect(result.shouldFertilize).toBe(false)
  })

  it('returns shouldFertilize=false when soil is undefined', () => {
    const noSoil = new Map<string, { value: number; unit: string }>()
    const result = evaluateFertilizingRule(baseDevice, null, noSoil, now)
    expect(result.shouldFertilize).toBe(false)
  })

  it('returns shouldFertilize=false when tank level is too low', () => {
    const lowTank = new Map([
      ['soil', { value: 25, unit: '%' }],
      ['water', { value: 5, unit: '%' }],
    ])
    const result = evaluateFertilizingRule(baseDevice, null, lowTank, now)
    expect(result.shouldFertilize).toBe(false)
  })

  it('returns shouldFertilize=true when all conditions are met', () => {
    const result = evaluateFertilizingRule(baseDevice, null, sensorState, now)
    expect(result.shouldFertilize).toBe(true)
    expect(result.cooledDown).toBe(true)
    expect(result.soilValue).toBe(25)
    expect(result.tankLevel).toBe(80)
    expect(result.effectiveThreshold).toBe(DEFAULT_FERTILIZING_THRESHOLD)
  })

  it('respects cooldown period', () => {
    const recentFertilized = {
      ...baseDevice,
      lastFertilized: now - 1000,
    } as DeviceDoc
    const result = evaluateFertilizingRule(recentFertilized, null, sensorState, now)
    expect(result.shouldFertilize).toBe(true)
    expect(result.cooledDown).toBe(false)
  })

  it('uses plant fertilizingThreshold when available', () => {
    const plant = { fertilizingThreshold: 45 } as unknown as PlantDoc
    const result = evaluateFertilizingRule(baseDevice, plant, sensorState, now)
    expect(result.effectiveThreshold).toBe(45)
  })

  it('returns shouldFertilize=true when soil equals threshold (edge)', () => {
    const edgeSoil = new Map([['soil', { value: DEFAULT_FERTILIZING_THRESHOLD, unit: '%' }]])
    const result = evaluateFertilizingRule(baseDevice, null, edgeSoil, now)
    expect(result.shouldFertilize).toBe(false)
  })

  it('handles tank level at exactly min level', () => {
    const edgeTank = new Map([
      ['soil', { value: 25, unit: '%' }],
      ['water', { value: DEFAULT_TANK_MIN_LEVEL, unit: '%' }],
    ])
    const result = evaluateFertilizingRule(baseDevice, null, edgeTank, now)
    expect(result.shouldFertilize).toBe(false)
  })
})

describe('evaluatePesticideRule', () => {
  it('returns shouldApply=false when autoPesticide is disabled', () => {
    const result = evaluatePesticideRule(
      { ...baseDevice, autoPesticide: false } as DeviceDoc,
      null,
      sensorState,
      now,
    )
    expect(result.shouldApply).toBe(false)
  })

  it('returns shouldApply=false when humidity is low', () => {
    const lowHumidity = new Map([['air', { value: 50, unit: '%' }]])
    const result = evaluatePesticideRule(baseDevice, null, lowHumidity, now)
    expect(result.shouldApply).toBe(false)
  })

  it('returns shouldApply=false when pest risk is below threshold', () => {
    const midHumidity = new Map([['air', { value: 85, unit: '%' }]])
    const highThreshold = { ...baseDevice, pesticideThreshold: 80 } as DeviceDoc
    const result = evaluatePesticideRule(highThreshold, null, midHumidity, now)
    expect(result.shouldApply).toBe(false)
  })

  it('returns shouldApply=true when humidity is high and cooled down', () => {
    const highHumidity = new Map([['air', { value: 90, unit: '%' }]])
    const result = evaluatePesticideRule(baseDevice, null, highHumidity, now)
    expect(result.shouldApply).toBe(true)
    expect(result.cooledDown).toBe(true)
    expect(result.pestRisk).toBe(70)
  })

  it('respects cooldown period', () => {
    const recentPesticide = {
      ...baseDevice,
      lastPesticideApplied: now - 1000,
    } as DeviceDoc
    const highHumidity = new Map([['air', { value: 90, unit: '%' }]])
    const result = evaluatePesticideRule(recentPesticide, null, highHumidity, now)
    expect(result.shouldApply).toBe(false)
    expect(result.cooledDown).toBe(false)
  })

  it('uses 50 as default threshold when pesticideThreshold is null/undefined', () => {
    const noThreshold = { ...baseDevice, pesticideThreshold: undefined } as unknown as DeviceDoc
    const highHumidity = new Map([['air', { value: 85, unit: '%' }]])
    const result = evaluatePesticideRule(noThreshold, null, highHumidity, now)
    expect(result.pestRisk).toBe(70)
    expect(result.shouldApply).toBe(true)
  })

  it('allows zero threshold to trigger at any risk level', () => {
    const zeroThreshold = { ...baseDevice, pesticideThreshold: 0 } as DeviceDoc
    const moderateHumidity = new Map([['air', { value: 60, unit: '%' }]])
    const result = evaluatePesticideRule(zeroThreshold, null, moderateHumidity, now)
    expect(result.pestRisk).toBe(0)
    expect(result.shouldApply).toBe(true)
  })

  it('returns shouldApply=false when no humidity data', () => {
    const noHumidity = new Map<string, { value: number; unit: string }>()
    const result = evaluatePesticideRule(baseDevice, null, noHumidity, now)
    expect(result.shouldApply).toBe(false)
    expect(result.pestRisk).toBe(0)
  })

  it('boundary: humidity at exactly 80 triggers no pest risk', () => {
    const boundary = new Map([['air', { value: 80, unit: '%' }]])
    const result = evaluatePesticideRule(baseDevice, null, boundary, now)
    expect(result.pestRisk).toBe(0)
    expect(result.shouldApply).toBe(false)
  })

  it('boundary: humidity at 81 triggers pest risk 70', () => {
    const boundary = new Map([['air', { value: 81, unit: '%' }]])
    const result = evaluatePesticideRule(baseDevice, null, boundary, now)
    expect(result.pestRisk).toBe(70)
  })
})

describe('estimateBatterySoC', () => {
  it('returns 50% SoC with zero current and no accumulation', () => {
    const result = estimateBatterySoC(0, 0, 5, 60000)
    expect(result.soc).toBe(50)
    expect(result.accumulatedMah).toBe(0)
  })

  it('charges battery (positive current increases SoC)', () => {
    const result = estimateBatterySoC(500, 0, 5, 3600000)
    expect(result.accumulatedMah).toBe(500)
    expect(result.soc).toBeGreaterThan(50)
  })

  it('discharges battery (negative current decreases SoC)', () => {
    const result = estimateBatterySoC(-500, 0, 5, 3600000)
    expect(result.accumulatedMah).toBe(-500)
    expect(result.soc).toBeLessThan(50)
  })

  it('clamps SoC to 0% minimum', () => {
    const result = estimateBatterySoC(-5000, 0, 5, 36000000)
    expect(result.soc).toBe(0)
  })

  it('clamps SoC to 100% maximum', () => {
    const result = estimateBatterySoC(5000, 0, 5, 36000000)
    expect(result.soc).toBe(100)
  })

  it('accumulates mAh correctly over multiple calls', () => {
    const r1 = estimateBatterySoC(1000, 0, 5, 3600000)
    expect(r1.accumulatedMah).toBe(1000)
    const r2 = estimateBatterySoC(500, r1.accumulatedMah, 5, 3600000)
    expect(r2.accumulatedMah).toBe(1500)
  })

  it('handles zero capacity gracefully (defaults to 5Ah)', () => {
    const result = estimateBatterySoC(1000, 0, 0, 3600000)
    expect(result.soc).toBe(50 + (1000 / 5000) * 50)
  })

  it('handles very small time delta', () => {
    const result = estimateBatterySoC(1000, 0, 5, 1)
    expect(result.accumulatedMah).toBeCloseTo(0.000278, 4)
    expect(result.soc).toBeCloseTo(50, 4)
  })

  it('handles large time delta', () => {
    const result = estimateBatterySoC(100, 0, 5, 86400000)
    expect(result.accumulatedMah).toBe(2400)
    expect(result.soc).toBe(50 + (2400 / 5000) * 50)
  })
})
