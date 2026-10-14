/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { estimateBatterySoC, evaluateFertilizingRule, evaluatePesticideRule } from '../../convex/helpers/v2sensors'
import {
  buildQueuedFertilizerAction,
  buildQueuedPesticideAction,
  getDeviceFertilizingDuration,
  getDevicePesticideDuration,
  getDeviceFertilizingCooldown,
  getDevicePesticideCooldown,
} from '../../convex/helpers/devices'
import {
  DEFAULT_FERTILIZING_DURATION,
  DEFAULT_PESTICIDE_DURATION,
  DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_PESTICIDE_COOLDOWN,
} from '../../convex/types'
import type { DeviceDoc } from '../../convex/types'

const baseDevice = {
  deviceId: 'test',
  autoFertilizing: true,
  autoPesticide: true,
  fertilizingThreshold: 35,
  fertilizingDuration: 10,
  fertilizingCooldown: DEFAULT_FERTILIZING_COOLDOWN,
  pesticideThreshold: 50,
  pesticideDuration: 10,
  pesticideCooldown: DEFAULT_PESTICIDE_COOLDOWN,
  tankMinLevel: 10,
  lastFertilized: undefined,
  lastPesticideApplied: undefined,
} as unknown as DeviceDoc

describe('getDeviceFertilizingDuration', () => {
  it('returns valid duration when set', () => {
    expect(getDeviceFertilizingDuration({ fertilizingDuration: 15 } as DeviceDoc)).toBe(15)
  })

  it('returns default when undefined', () => {
    expect(getDeviceFertilizingDuration({} as DeviceDoc)).toBe(DEFAULT_FERTILIZING_DURATION)
  })

  it('returns default when NaN', () => {
    expect(getDeviceFertilizingDuration({ fertilizingDuration: NaN } as DeviceDoc)).toBe(DEFAULT_FERTILIZING_DURATION)
  })
})

describe('getDevicePesticideDuration', () => {
  it('returns valid duration when set', () => {
    expect(getDevicePesticideDuration({ pesticideDuration: 20 } as DeviceDoc)).toBe(20)
  })

  it('returns default when undefined', () => {
    expect(getDevicePesticideDuration({} as DeviceDoc)).toBe(DEFAULT_PESTICIDE_DURATION)
  })
})

describe('getDeviceFertilizingCooldown', () => {
  it('returns valid cooldown when set', () => {
    expect(getDeviceFertilizingCooldown({ fertilizingCooldown: 86400 } as DeviceDoc)).toBe(86400)
  })

  it('returns default when undefined', () => {
    expect(getDeviceFertilizingCooldown({} as DeviceDoc)).toBe(DEFAULT_FERTILIZING_COOLDOWN)
  })
})

describe('getDevicePesticideCooldown', () => {
  it('returns valid cooldown when set', () => {
    expect(getDevicePesticideCooldown({ pesticideCooldown: 604800 } as DeviceDoc)).toBe(604800)
  })

  it('returns default when undefined', () => {
    expect(getDevicePesticideCooldown({} as DeviceDoc)).toBe(DEFAULT_PESTICIDE_COOLDOWN)
  })
})

describe('buildQueuedFertilizerAction', () => {
  it('builds fertilizer action with duration in ms', () => {
    const device = { queuedCommands: { pump: null, light: null, fertilizer: null, pesticide: null } } as unknown as DeviceDoc
    const result = buildQueuedFertilizerAction(device, 10)
    expect(result.queuedCommands.fertilizer).toEqual(
      expect.objectContaining({ kind: 'fertilizer', durationMs: 10000 }),
    )
    expect((result.queuedCommands.fertilizer as any).id).toEqual(expect.any(String))
  })

  it('preserves existing pump command', () => {
    const device = {
      queuedCommands: {
        pump: { kind: 'pump', durationMs: 5000 },
        light: null,
        fertilizer: null,
        pesticide: null,
      },
    } as unknown as DeviceDoc
    const result = buildQueuedFertilizerAction(device, 10)
    expect(result.queuedCommands.pump).toEqual({ kind: 'pump', durationMs: 5000 })
    expect(result.queuedCommands.fertilizer).toEqual(
      expect.objectContaining({ kind: 'fertilizer', durationMs: 10000 }),
    )
    expect((result.queuedCommands.fertilizer as any).id).toEqual(expect.any(String))
  })
})

describe('buildQueuedPesticideAction', () => {
  it('builds pesticide action with duration in ms', () => {
    const device = { queuedCommands: { pump: null, light: null, fertilizer: null, pesticide: null } } as unknown as DeviceDoc
    const result = buildQueuedPesticideAction(device, 10)
    expect(result.queuedCommands.pesticide).toEqual(
      expect.objectContaining({ kind: 'pesticide', durationMs: 10000 }),
    )
    expect((result.queuedCommands.pesticide as any).id).toEqual(expect.any(String))
  })
})

describe('evaluateFertilizingRule edge cases', () => {
  it('handles undefined fertilizingCooldown gracefully', () => {
    const noCooldown = { ...baseDevice, fertilizingCooldown: undefined } as unknown as DeviceDoc
    const result = evaluateFertilizingRule(noCooldown, null, new Map([
      ['soil', { value: 20, unit: '%' }],
      ['water', { value: 80, unit: '%' }],
    ]), Date.now())
    expect(result.shouldFertilize).toBe(true)
    expect(result.cooledDown).toBe(true)
  })

  it('handles missing tank level by not checking it', () => {
    const noTank = new Map([['soil', { value: 20, unit: '%' }]])
    const result = evaluateFertilizingRule(baseDevice, null, noTank, Date.now())
    expect(result.shouldFertilize).toBe(true)
  })
})

describe('evaluatePesticideRule edge cases', () => {
  it('handles undefined pesticideCooldown gracefully', () => {
    const noCooldown = { ...baseDevice, pesticideCooldown: undefined } as unknown as DeviceDoc
    const result = evaluatePesticideRule(noCooldown, null, new Map([
      ['air', { value: 90, unit: '%' }],
    ]), Date.now())
    expect(result.shouldApply).toBe(true)
    expect(result.cooledDown).toBe(true)
  })

  it('handles 0 pestRisk correctly with 0 threshold', () => {
    const zeroThreshold = { ...baseDevice, pesticideThreshold: 0 } as unknown as DeviceDoc
    const result = evaluatePesticideRule(zeroThreshold, null, new Map([
      ['air', { value: 60, unit: '%' }],
    ]), Date.now())
    expect(result.pestRisk).toBe(0)
    expect(result.shouldApply).toBe(true)
  })
})

describe('estimateBatterySoC edge cases', () => {
  it('clamps negative accumulated to minimum SoC', () => {
    const result = estimateBatterySoC(-10000, -50000, 5, 3600000)
    expect(result.soc).toBe(0)
  })

  it('clamps positive accumulated to maximum SoC', () => {
    const result = estimateBatterySoC(10000, 50000, 5, 3600000)
    expect(result.soc).toBe(100)
  })

  it('handles small negative current accurately', () => {
    const result = estimateBatterySoC(-1, 0, 3.5, 3600000)
    expect(result.accumulatedMah).toBeCloseTo(-1, 0)
    expect(result.soc).toBeLessThan(100)
  })

  it('handles large capacity batteries', () => {
    const result = estimateBatterySoC(1000, -1000, 200, 3600000)
    expect(result.soc).toBeCloseTo(100, 4)
  })

  it('handles very small capacity batteries', () => {
    const result = estimateBatterySoC(-10, 0, 0.5, 3600000)
    expect(result.soc).toBeCloseTo(98, 4)
  })
})
