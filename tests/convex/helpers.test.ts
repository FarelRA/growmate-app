/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizePlantSensorProfile,
  defaultPlantSensorProfile,
  getSensorRange,
  getSensorStatus,
  getSensorTarget,
  getSensorLabel,
  getSensorAccent,
  getSensorSort,
  computePlantHealth,
  computePlantHealthScore,
  isDeviceOnline,
  computeWaterReservoirDays,
  formatTimestamp,
  getRelativeTime,
  generateAlerts,
  getActivityPoints,
  clampPercent,
  normalizeRawSensorValue,
  getDeviceWateringDuration,
  getDeviceWateringCooldown,
  getDeviceLightingHysteresis,
  formatEventValue,
  getAutomationModeLabel,
  normalizeLifecycleProfile,
  formatPlantStage,
  computePlantProgress,
  getHealthComputationGuide,
  getQueuedDeviceCommands,
  buildDeviceCommandList,
  buildQueuedPumpAction,
  buildQueuedLightAction,
  getDefaultDeviceName,
} from '../../convex/helpers'
import {
  ADC_RAW_MAX,
  defaultLifecycleProfile,
} from '../../convex/types'
import type { PlantStageValue } from '../../convex/types'

describe('normalizePlantSensorProfile', () => {
  it('returns default profile when no profile given', () => {
    const result = normalizePlantSensorProfile()
    expect(result).toEqual(defaultPlantSensorProfile)
  })

  it('returns default profile when null', () => {
    const result = normalizePlantSensorProfile(null)
    expect(result).toEqual(defaultPlantSensorProfile)
  })

  it('returns default profile when empty object', () => {
    const result = normalizePlantSensorProfile({})
    expect(result).toEqual(defaultPlantSensorProfile)
  })

  it('merges partial overrides correctly', () => {
    const result = normalizePlantSensorProfile({ soil: { min: 10 } })
    expect(result.soil.min).toBe(10)
    expect(result.soil.max).toBe(80)
    expect(result.light).toEqual(defaultPlantSensorProfile.light)
  })

  it('handles full custom profile', () => {
    const custom = {
      soil: { min: 0, max: 100 },
      light: { min: 0, max: 100 },
      temperature: { min: 0, max: 50 },
      air: { min: 0, max: 100 },
      water: { min: 0, max: 100 },
    }
    const result = normalizePlantSensorProfile(custom)
    expect(result).toEqual(custom)
  })

  it('swaps min/max when min > max', () => {
    const result = normalizePlantSensorProfile({ soil: { min: 90, max: 10 } })
    expect(result.soil.min).toBe(10)
    expect(result.soil.max).toBe(90)
  })

  it('uses default when only max provided', () => {
    const result = normalizePlantSensorProfile({ temperature: { max: 35 } })
    expect(result.temperature.min).toBe(18)
    expect(result.temperature.max).toBe(35)
  })
})

describe('getSensorRange', () => {
  it('returns default range for each kind', () => {
    expect(getSensorRange('soil')).toEqual({ min: 30, max: 80 })
    expect(getSensorRange('light')).toEqual({ min: 30, max: 80 })
    expect(getSensorRange('temperature')).toEqual({ min: 18, max: 28 })
    expect(getSensorRange('air')).toEqual({ min: 40, max: 70 })
    expect(getSensorRange('water')).toEqual({ min: 20, max: 90 })
  })

  it('respects custom profile', () => {
    const profile = { soil: { min: 10, max: 50 } }
    expect(getSensorRange('soil', profile)).toEqual({ min: 10, max: 50 })
  })
})

describe('getSensorStatus', () => {
  const profile = {
    soil: { min: 30, max: 80 },
  }

  it('returns "low" when value below min', () => {
    expect(getSensorStatus('soil', 29, profile)).toBe('low')
  })

  it('returns "optimal" when value at min', () => {
    expect(getSensorStatus('soil', 30, profile)).toBe('optimal')
  })

  it('returns "optimal" when value within range', () => {
    expect(getSensorStatus('soil', 55, profile)).toBe('optimal')
  })

  it('returns "optimal" when value at max', () => {
    expect(getSensorStatus('soil', 80, profile)).toBe('optimal')
  })

  it('returns "high" when value above max', () => {
    expect(getSensorStatus('soil', 81, profile)).toBe('high')
  })

  it('works for all sensor kinds', () => {
    const all = {
      soil: { min: 30, max: 80 },
      light: { min: 30, max: 80 },
      temperature: { min: 18, max: 28 },
      air: { min: 40, max: 70 },
      water: { min: 20, max: 90 },
    }
    expect(getSensorStatus('light', 10, all)).toBe('low')
    expect(getSensorStatus('temperature', 23, all)).toBe('optimal')
    expect(getSensorStatus('air', 90, all)).toBe('high')
    expect(getSensorStatus('water', 50, all)).toBe('optimal')
  })
})

describe('getSensorTarget', () => {
  const profile = {
    soil: { min: 30, max: 80 },
    light: { min: 30, max: 80 },
    temperature: { min: 18, max: 28 },
    air: { min: 40, max: 70 },
    water: { min: 20, max: 90 },
  }

  it('returns optimal message for soil', () => {
    expect(getSensorTarget('soil', 50, 'optimal', profile)).toBe('✓ Ideal 30-80%')
  })

  it('returns optimal message for light', () => {
    expect(getSensorTarget('light', 50, 'optimal', profile)).toBe('✓ Ideal 30-80%')
  })

  it('returns optimal message for temperature', () => {
    expect(getSensorTarget('temperature', 22, 'optimal', profile)).toBe('✓ Ideal 18-28C')
  })

  it('returns optimal message for air', () => {
    expect(getSensorTarget('air', 55, 'optimal', profile)).toBe('✓ Ideal 40-70%')
  })

  it('returns optimal message for water', () => {
    expect(getSensorTarget('water', 50, 'optimal', profile)).toBe('✓ Ideal 20-90%')
  })

  it('returns low target for soil', () => {
    expect(getSensorTarget('soil', 10, 'low', profile)).toBe('↑ Target min 30%')
  })

  it('returns low target for light', () => {
    expect(getSensorTarget('light', 10, 'low', profile)).toBe('↑ Target min 30%')
  })

  it('returns low target for temperature', () => {
    expect(getSensorTarget('temperature', 10, 'low', profile)).toBe('↑ Target min 18C')
  })

  it('returns low target for air', () => {
    expect(getSensorTarget('air', 10, 'low', profile)).toBe('↑ Target min 40%')
  })

  it('returns low target for water with Indonesian message', () => {
    expect(getSensorTarget('water', 10, 'low', profile)).toBe('↑ Isi ulang ke atas 20%')
  })

  it('returns high target for soil', () => {
    expect(getSensorTarget('soil', 90, 'high', profile)).toBe('↓ Target max 80%')
  })

  it('returns high target for light', () => {
    expect(getSensorTarget('light', 90, 'high', profile)).toBe('↓ Target max 80%')
  })

  it('returns high target for temperature', () => {
    expect(getSensorTarget('temperature', 30, 'high', profile)).toBe('↓ Target max 28C')
  })

  it('returns high target for air', () => {
    expect(getSensorTarget('air', 90, 'high', profile)).toBe('↓ Target max 70%')
  })

  it('returns high target for water', () => {
    expect(getSensorTarget('water', 95, 'high', profile)).toBe('↓ Target max 90%')
  })
})

describe('getSensorLabel', () => {
  it('returns correct Indonesian labels', () => {
    expect(getSensorLabel('soil')).toBe('Kelembapan Tanah')
    expect(getSensorLabel('light')).toBe('Intensitas Cahaya')
    expect(getSensorLabel('temperature')).toBe('Suhu')
    expect(getSensorLabel('air')).toBe('Kelembapan Udara')
    expect(getSensorLabel('water')).toBe('Level Air')
  })
})

describe('getSensorAccent', () => {
  it('returns correct accent for each kind', () => {
    expect(getSensorAccent('soil')).toBe('earth')
    expect(getSensorAccent('light')).toBe('sun')
    expect(getSensorAccent('temperature')).toBe('warm')
    expect(getSensorAccent('air')).toBe('air')
    expect(getSensorAccent('water')).toBe('water')
  })
})

describe('getSensorSort', () => {
  it('returns correct sort order', () => {
    expect(getSensorSort('soil')).toBe(1)
    expect(getSensorSort('light')).toBe(2)
    expect(getSensorSort('temperature')).toBe(3)
    expect(getSensorSort('air')).toBe(4)
    expect(getSensorSort('water')).toBe(5)
  })
})

describe('computePlantHealth', () => {
  it('returns "excellent" when score >= 80', () => {
    const sensors = [
      { kind: 'soil' as const, value: 50 },
      { kind: 'light' as const, value: 55 },
      { kind: 'temperature' as const, value: 23 },
    ]
    expect(computePlantHealth(sensors)).toBe('excellent')
  })

  it('returns "good" when 60 <= score < 80', () => {
    const sensors = [
      { kind: 'soil' as const, value: 50 },
      { kind: 'light' as const, value: 10 },
    ]
    expect(computePlantHealth(sensors)).toBe('good')
  })

  it('returns "fair" when 40 <= score < 60 (all non-optimal)', () => {
    const sensors = [
      { kind: 'soil' as const, value: 10 },
      { kind: 'light' as const, value: 10 },
      { kind: 'temperature' as const, value: 10 },
    ]
    expect(computePlantHealth(sensors)).toBe('fair')
  })

  it('returns "poor" when score < 40 (empty sensors)', () => {
    expect(computePlantHealth([])).toBe('poor')
  })

})

describe('computePlantHealthScore', () => {
  it('returns 100 when all sensors optimal', () => {
    const sensors = [
      { kind: 'soil' as const, value: 50 },
      { kind: 'light' as const, value: 55 },
      { kind: 'temperature' as const, value: 22 },
    ]
    expect(computePlantHealthScore(sensors)).toBe(100)
  })

  it('returns 50 when all sensors non-optimal', () => {
    const sensors = [
      { kind: 'soil' as const, value: 10 },
      { kind: 'light' as const, value: 10 },
    ]
    expect(computePlantHealthScore(sensors)).toBe(50)
  })

  it('computes average for mixed values', () => {
    const sensors = [
      { kind: 'soil' as const, value: 50 },
      { kind: 'light' as const, value: 10 },
    ]
    expect(computePlantHealthScore(sensors)).toBe(75)
  })

  it('returns 0 for empty sensors', () => {
    expect(computePlantHealthScore([])).toBe(0)
  })

  it('rounds the average', () => {
    const sensors = [
      { kind: 'soil' as const, value: 50 },
      { kind: 'light' as const, value: 50 },
      { kind: 'temperature' as const, value: 10 },
    ]
    expect(computePlantHealthScore(sensors)).toBe(83)
  })
})

describe('isDeviceOnline', () => {
  const fiveMinutes = 5 * 60 * 1000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1000000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns true when device seen within 5 minutes', () => {
    expect(isDeviceOnline(1000000 - 4 * 60 * 1000)).toBe(true)
  })

  it('returns false when exactly 5 minutes ago', () => {
    expect(isDeviceOnline(1000000 - fiveMinutes)).toBe(false)
  })

  it('returns false when device seen more than 5 minutes ago', () => {
    expect(isDeviceOnline(1000000 - 6 * 60 * 1000)).toBe(false)
  })

  it('returns true for device seen 1ms within threshold', () => {
    expect(isDeviceOnline(1000000 - fiveMinutes + 1)).toBe(true)
  })
})

describe('computeWaterReservoirDays', () => {
  it('returns 12 days for full reservoir at 5L/day usage', () => {
    expect(computeWaterReservoirDays(100)).toBe(12)
  })

  it('returns 6 days for half reservoir', () => {
    expect(computeWaterReservoirDays(50)).toBe(6)
  })

  it('returns 0 days for empty reservoir', () => {
    expect(computeWaterReservoirDays(0)).toBe(0)
  })

  it('returns 0 for very low water level', () => {
    expect(computeWaterReservoirDays(1)).toBe(0)
  })

  it('works with custom daily usage', () => {
    expect(computeWaterReservoirDays(100, 10)).toBe(6)
  })
})

describe('formatTimestamp', () => {
  it('returns a non-empty string', () => {
    const result = formatTimestamp(1700000000000)
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('formats known timestamp correctly', () => {
    const ts = new Date(2024, 0, 15, 10, 24).getTime()
    const result = formatTimestamp(ts)
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('getRelativeTime', () => {
  const now = 1000000000000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Baru saja" for timestamps less than 60s ago', () => {
    expect(getRelativeTime(now - 30000)).toBe('Baru saja')
  })

  it('returns minutes format for 1-59 minutes ago', () => {
    expect(getRelativeTime(now - 5 * 60 * 1000)).toBe('5 menit yang lalu')
  })

  it('returns minutes format for 1 minute ago', () => {
    expect(getRelativeTime(now - 60 * 1000)).toBe('1 menit yang lalu')
  })

  it('returns hours format for 1-23 hours ago', () => {
    expect(getRelativeTime(now - 3 * 60 * 60 * 1000)).toBe('3 jam yang lalu')
  })

  it('returns "Kemarin" for exactly 1 day ago', () => {
    expect(getRelativeTime(now - 24 * 60 * 60 * 1000)).toBe('Kemarin')
  })

  it('returns days format for 2-6 days ago', () => {
    expect(getRelativeTime(now - 5 * 24 * 60 * 60 * 1000)).toBe('5 hari yang lalu')
  })

  it('returns date format for 7+ days ago', () => {
    const result = getRelativeTime(now - 10 * 24 * 60 * 60 * 1000)
    expect(result).toBeTypeOf('string')
    expect(result).not.toBe('Baru saja')
    expect(result).not.toContain('menit')
    expect(result).not.toContain('jam')
  })
})

describe('generateAlerts', () => {
  const baseProfile = {
    soil: { min: 30, max: 80 },
    light: { min: 30, max: 80 },
    temperature: { min: 18, max: 28 },
    air: { min: 40, max: 70 },
    water: { min: 20, max: 90 },
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(1000000)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty alerts when no issues', () => {
    const sensors = [
      { kind: 'soil' as const, value: 50 },
      { kind: 'temperature' as const, value: 22 },
      { kind: 'water' as const, value: 50 },
    ]
    const device = { lastSeen: 1000000 - 60000, autoWatering: true }
    expect(generateAlerts(sensors, device, baseProfile)).toEqual([])
  })

  it('returns critical alert when device is offline', () => {
    const sensors = [{ kind: 'soil' as const, value: 50 }]
    const device = { lastSeen: 1000000 - 10 * 60 * 1000, autoWatering: true }
    const alerts = generateAlerts(sensors, device, baseProfile)
    expect(alerts).toContainEqual({
      type: 'critical',
      message: 'Perangkat offline - periksa koneksi',
    })
  })

  it('returns critical alert when water reservoir is low', () => {
    const sensors = [{ kind: 'water' as const, value: 10 }]
    const device = { lastSeen: 1000000 - 60000, autoWatering: true }
    const alerts = generateAlerts(sensors, device, baseProfile)
    expect(alerts).toContainEqual({
      type: 'critical',
      message: 'Reservoir air rendah - segera isi ulang',
      sensorKind: 'water',
    })
  })

  it('returns warning alert when soil is dry', () => {
    const sensors = [{ kind: 'soil' as const, value: 10 }]
    const device = { lastSeen: 1000000 - 60000, autoWatering: true }
    const alerts = generateAlerts(sensors, device, baseProfile)
    expect(alerts).toContainEqual({
      type: 'warning',
      message: 'Kelembapan tanah rendah - perlu penyiraman',
      sensorKind: 'soil',
    })
  })

  it('returns warning alert when temperature is high', () => {
    const sensors = [{ kind: 'temperature' as const, value: 35 }]
    const device = { lastSeen: 1000000 - 60000, autoWatering: true }
    const alerts = generateAlerts(sensors, device, baseProfile)
    expect(alerts).toContainEqual({
      type: 'warning',
      message: 'Suhu tinggi - tingkatkan ventilasi',
      sensorKind: 'temperature',
    })
  })

  it('returns warning alert when temperature is low', () => {
    const sensors = [{ kind: 'temperature' as const, value: 10 }]
    const device = { lastSeen: 1000000 - 60000, autoWatering: true }
    const alerts = generateAlerts(sensors, device, baseProfile)
    expect(alerts).toContainEqual({
      type: 'warning',
      message: 'Suhu rendah - tambahkan pemanas',
      sensorKind: 'temperature',
    })
  })

  it('does not alert for high soil sensors', () => {
    const sensors = [
      { kind: 'soil' as const, value: 95 },
    ]
    const device = { lastSeen: 1000000 - 60000, autoWatering: true }
    const alerts = generateAlerts(sensors, device, baseProfile)
    expect(alerts.length).toBe(0)
  })

  it('returns no alerts when device is null', () => {
    const sensors = [{ kind: 'soil' as const, value: 50 }]
    const alerts = generateAlerts(sensors, null, baseProfile)
    expect(alerts).toEqual([])
  })

  it('returns multiple alerts for multiple issues', () => {
    const sensors = [
      { kind: 'soil' as const, value: 10 },
      { kind: 'water' as const, value: 5 },
    ]
    const device = { lastSeen: 1000000 - 10 * 60 * 1000, autoWatering: true }
    const alerts = generateAlerts(sensors, device, baseProfile)
    expect(alerts.length).toBe(3)
    expect(alerts.map(a => a.type)).toContain('critical')
    expect(alerts.map(a => a.type)).toContain('warning')
  })
})

describe('getActivityPoints', () => {
  it('returns correct points for each activity type', () => {
    expect(getActivityPoints('post_created')).toBe(50)
    expect(getActivityPoints('comment_created')).toBe(10)
    expect(getActivityPoints('post_liked')).toBe(5)
    expect(getActivityPoints('plant_added')).toBe(25)
    expect(getActivityPoints('watering_completed')).toBe(5)
  })
})

describe('clampPercent', () => {
  it('returns value as-is when between 0 and 100', () => {
    expect(clampPercent(50)).toBe(50)
  })

  it('returns 0 for negative values', () => {
    expect(clampPercent(-1)).toBe(0)
    expect(clampPercent(-100)).toBe(0)
  })

  it('returns 100 for values above 100', () => {
    expect(clampPercent(101)).toBe(100)
    expect(clampPercent(200)).toBe(100)
  })

  it('handles boundary values', () => {
    expect(clampPercent(0)).toBe(0)
    expect(clampPercent(100)).toBe(100)
  })
})

describe('normalizeRawSensorValue', () => {
  it('converts soil sensor (inverted)', () => {
    expect(normalizeRawSensorValue('soil', 0)).toBe(100)
    expect(normalizeRawSensorValue('soil', ADC_RAW_MAX)).toBe(0)
    expect(normalizeRawSensorValue('soil', Math.round(ADC_RAW_MAX / 2))).toBe(50)
  })

  it('converts light sensor (inverted)', () => {
    expect(normalizeRawSensorValue('light', 0)).toBe(100)
    expect(normalizeRawSensorValue('light', ADC_RAW_MAX)).toBe(0)
  })

  it('converts water sensor (direct)', () => {
    expect(normalizeRawSensorValue('water', 0)).toBe(0)
    expect(normalizeRawSensorValue('water', ADC_RAW_MAX)).toBe(100)
    expect(normalizeRawSensorValue('water', Math.round(ADC_RAW_MAX / 2))).toBe(50)
  })

  it('returns raw value for temperature and air', () => {
    expect(normalizeRawSensorValue('temperature', 2500)).toBe(2500)
    expect(normalizeRawSensorValue('air', 1800)).toBe(1800)
  })

  it('clamps raw value to ADC range', () => {
    expect(normalizeRawSensorValue('soil', -100)).toBe(100)
    expect(normalizeRawSensorValue('soil', 5000)).toBe(92)
  })
})

describe('getDeviceWateringDuration', () => {
  it('returns custom duration when set', () => {
    expect(getDeviceWateringDuration({ wateringDuration: 15 })).toBe(15)
  })

  it('returns default when wateringDuration is not finite', () => {
    expect(getDeviceWateringDuration({ wateringDuration: null as any })).toBe(8)
    expect(getDeviceWateringDuration({ wateringDuration: undefined as any })).toBe(8)
    expect(getDeviceWateringDuration({ wateringDuration: NaN as any })).toBe(8)
  })

  it('returns 0 when explicitly set to 0', () => {
    expect(getDeviceWateringDuration({ wateringDuration: 0 })).toBe(0)
  })
})

describe('getDeviceWateringCooldown', () => {
  it('returns custom cooldown when set', () => {
    expect(getDeviceWateringCooldown({ wateringCooldown: 7200 })).toBe(7200)
  })

  it('returns default when not finite', () => {
    expect(getDeviceWateringCooldown({ wateringCooldown: null as any })).toBe(21600)
    expect(getDeviceWateringCooldown({ wateringCooldown: undefined as any })).toBe(21600)
  })
})

describe('getDeviceLightingHysteresis', () => {
  it('returns custom hysteresis when set', () => {
    expect(getDeviceLightingHysteresis({ lightingHysteresis: 5 })).toBe(5)
  })

  it('returns default when not finite', () => {
    expect(getDeviceLightingHysteresis({ lightingHysteresis: null as any })).toBe(8)
    expect(getDeviceLightingHysteresis({ lightingHysteresis: undefined as any })).toBe(8)
  })
})

describe('formatEventValue', () => {
  it('returns the string itself for string values', () => {
    expect(formatEventValue('hello')).toBe('hello')
  })

  it('converts numbers to string', () => {
    expect(formatEventValue(42)).toBe('42')
    expect(formatEventValue(0)).toBe('0')
  })

  it('converts true to "on"', () => {
    expect(formatEventValue(true)).toBe('on')
  })

  it('converts false to "off"', () => {
    expect(formatEventValue(false)).toBe('off')
  })

  it('returns "unset" for null', () => {
    expect(formatEventValue(null)).toBe('unset')
  })

  it('returns "unset" for undefined', () => {
    expect(formatEventValue(undefined)).toBe('unset')
  })
})

describe('getAutomationModeLabel', () => {
  it('returns "Otomasi penuh" when both are true', () => {
    expect(getAutomationModeLabel({ autoWatering: true, autoLighting: true })).toBe('Otomasi penuh')
  })

  it('returns "Otomasi sebagian" when only autoWatering', () => {
    expect(getAutomationModeLabel({ autoWatering: true, autoLighting: false })).toBe('Otomasi sebagian')
  })

  it('returns "Otomasi sebagian" when only autoLighting', () => {
    expect(getAutomationModeLabel({ autoWatering: false, autoLighting: true })).toBe('Otomasi sebagian')
  })

  it('returns "Kontrol manual" when both are false', () => {
    expect(getAutomationModeLabel({ autoWatering: false, autoLighting: false })).toBe('Kontrol manual')
  })
})

describe('normalizeLifecycleProfile', () => {
  it('returns default lifecycle profile when no profile given', () => {
    expect(normalizeLifecycleProfile()).toEqual(defaultLifecycleProfile)
  })

  it('returns defaults when given null', () => {
    expect(normalizeLifecycleProfile(null)).toEqual(defaultLifecycleProfile)
  })

  it('returns defaults when given undefined', () => {
    expect(normalizeLifecycleProfile(undefined)).toEqual(defaultLifecycleProfile)
  })

  it('merges partial overrides', () => {
    const result = normalizeLifecycleProfile({ seedDormancyDays: 14 })
    expect(result.seedDormancyDays).toBe(14)
    expect(result.germinationDays).toBe(10)
    expect(result.vegetativeGrowthDays).toBe(30)
  })

  it('handles full custom profile', () => {
    const custom = {
      seedDormancyDays: 5,
      germinationDays: 7,
      seedlingDevelopmentDays: 10,
      vegetativeGrowthDays: 20,
      floweringReproductionDays: 15,
      maturitySenescenceDays: 10,
    }
    expect(normalizeLifecycleProfile(custom)).toEqual(custom)
  })
})

describe('formatPlantStage', () => {
  it('returns label for seed_dormancy', () => {
    expect(formatPlantStage('seed_dormancy')).toBe('Dormansi benih')
  })

  it('returns label for germination', () => {
    expect(formatPlantStage('germination')).toBe('Perkecambahan')
  })

  it('returns label for seedling_development', () => {
    expect(formatPlantStage('seedling_development')).toBe('Perkembangan bibit')
  })

  it('returns label for vegetative_growth', () => {
    expect(formatPlantStage('vegetative_growth')).toBe('Pertumbuhan vegetatif')
  })

  it('returns label for flowering_reproduction', () => {
    expect(formatPlantStage('flowering_reproduction')).toBe('Pembungaan / reproduksi')
  })

  it('returns label for maturity_senescence', () => {
    expect(formatPlantStage('maturity_senescence')).toBe('Kematangan / senesens')
  })

  it('returns the raw value for unknown stage', () => {
    expect(formatPlantStage('unknown' as PlantStageValue)).toBe('unknown')
  })
})

describe('computePlantProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-01T00:00:00Z').getTime())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const plantedAt = new Date('2025-05-01T00:00:00Z').getTime()

  const defaultProfile = {
    seedDormancyDays: 7,
    germinationDays: 10,
    seedlingDevelopmentDays: 14,
    vegetativeGrowthDays: 30,
    floweringReproductionDays: 24,
    maturitySenescenceDays: 20,
  }

  it('uses offsetDays from growthStage: offsetDays = sum of durations before current stage', () => {
    // Plant is in vegetative_growth, so offset = 7 + 10 + 14 = 31
    // Planted 31 days ago, so elapsed = 31
    // progressDays = 31 + 31 = 62 → past vegetative (31-61), into flowering (61-85)
    const result = computePlantProgress({
      growthStage: 'vegetative_growth' as PlantStageValue,
      plantedAt,
      lifecycleProfile: defaultProfile,
    })
    expect(result.currentStage).toBe('flowering_reproduction')
    expect(result.elapsedDays).toBe(31)
    expect(result.totalDays).toBe(105)
    expect(result.progressDays).toBe(62)
    expect(result.percent).toBe(59)
  })

  it('returns seed_dormancy for brand new plant (growthStage = seed_dormancy)', () => {
    // offsetDays = 0 (no stages before seed_dormancy)
    // elapsed = 0 (planted now)
    const result = computePlantProgress({
      growthStage: 'seed_dormancy' as PlantStageValue,
      plantedAt: new Date('2025-06-01T00:00:00Z').getTime(),
      lifecycleProfile: defaultProfile,
    })
    expect(result.currentStage).toBe('seed_dormancy')
    expect(result.progressDays).toBe(0)
    expect(result.percent).toBe(0)
  })

  it('advances stages as elapsed days increase', () => {
    // growthStage = seed_dormancy → offsetDays = 0
    // Planted 5 days ago → elapsedDays = 5
    // progressDays = 0 + 5 = 5 → still in seed_dormancy (0-7)
    const result = computePlantProgress({
      growthStage: 'seed_dormancy' as PlantStageValue,
      plantedAt: new Date('2025-05-27T00:00:00Z').getTime(),
      lifecycleProfile: defaultProfile,
    })
    expect(result.currentStage).toBe('seed_dormancy')
    expect(result.elapsedDays).toBe(5)
    expect(result.progressDays).toBe(5)
  })

  it('clamps progressDays to totalDays and returns final stage', () => {
    const result = computePlantProgress({
      growthStage: 'seed_dormancy' as PlantStageValue,
      plantedAt: new Date('2024-01-01T00:00:00Z').getTime(),
      lifecycleProfile: defaultProfile,
    })
    expect(result.progressDays).toBe(result.totalDays)
    expect(result.percent).toBe(100)
    expect(result.currentStage).toBe('maturity_senescence')
  })

  it('handles negative elapsed (future plantedAt) by returning 0 elapsed', () => {
    // growthStage = seed_dormancy → offsetDays = 0
    // future plantedAt → elapsedDays = 0 (clamped)
    // progressDays = 0
    const result = computePlantProgress({
      growthStage: 'seed_dormancy' as PlantStageValue,
      plantedAt: new Date('2025-12-01T00:00:00Z').getTime(),
      lifecycleProfile: defaultProfile,
    })
    expect(result.elapsedDays).toBe(0)
    expect(result.progressDays).toBe(0)
    expect(result.currentStage).toBe('seed_dormancy')
    expect(result.percent).toBe(0)
  })

  it('computes correct stage flags for a plant mid-way through a stage', () => {
    // growthStage = seed_dormancy → offsetDays = 0
    // Planted 12 days ago → elapsedDays = 12
    // progressDays = 12 → past seed (0-7), into germination (7-17)
    const result = computePlantProgress({
      growthStage: 'seed_dormancy' as PlantStageValue,
      plantedAt: new Date('2025-05-20T00:00:00Z').getTime(),
      lifecycleProfile: defaultProfile,
    })
    const stages = result.stages

    expect(stages[0]).toMatchObject({ key: 'seed_dormancy', complete: true, active: false })
    expect(stages[1]).toMatchObject({ key: 'germination', complete: false, active: true })
    expect(stages[2]).toMatchObject({ key: 'seedling_development', complete: false, active: false })
    expect(stages[5]).toMatchObject({ key: 'maturity_senescence', complete: false, active: false })
  })
})

describe('getHealthComputationGuide', () => {
  it('returns default ranges with default profile', () => {
    const guide = getHealthComputationGuide()
    expect(guide.sensorOptimalRanges).toEqual({
      soil: '30 to 80',
      light: '30 to 80',
      temperature: '18 to 28',
      air: '40 to 70',
      water: '20 to 90',
    })
  })

  it('respects custom profile', () => {
    const profile = { soil: { min: 10, max: 50 } }
    const guide = getHealthComputationGuide(profile)
    expect(guide.sensorOptimalRanges.soil).toBe('10 to 50')
    expect(guide.sensorOptimalRanges.temperature).toBe('18 to 28')
  })

  it('includes scoring labels', () => {
    const guide = getHealthComputationGuide()
    expect(guide.scoring.perSensor).toContain('100')
    expect(guide.scoring.finalScore).toContain('rata-rata')
    expect(guide.labels.excellent).toBe('80 sampai 100')
    expect(guide.labels.poor).toBe('0 sampai 39')
  })
})

describe('getQueuedDeviceCommands', () => {
  it('returns default null commands when queuedCommands is undefined', () => {
    const device = {} as any
    const result = getQueuedDeviceCommands(device)
    expect(result).toEqual({ pump: null, light: null, fertilizer: null, pesticide: null })
  })

  it('returns existing queued commands', () => {
    const device = {
      queuedCommands: {
        pump: { kind: 'pump', durationMs: 5000 },
        light: null,
        fertilizer: null,
        pesticide: null,
      },
    } as any
    const result = getQueuedDeviceCommands(device)
    expect(result.pump).toEqual({ kind: 'pump', durationMs: 5000 })
    expect(result.light).toBeNull()
    expect(result.fertilizer).toBeNull()
    expect(result.pesticide).toBeNull()
  })
})

describe('buildDeviceCommandList', () => {
  it('returns empty array when no commands queued', () => {
    const device = {} as any
    expect(buildDeviceCommandList(device)).toEqual([])
  })

  it('returns only non-null commands', () => {
    const device = {
      queuedCommands: {
        pump: { kind: 'pump', durationMs: 5000 },
        light: null,
      },
    } as any
    const result = buildDeviceCommandList(device)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ kind: 'pump', durationMs: 5000 })
  })

  it('returns both commands when both queued', () => {
    const device = {
      queuedCommands: {
        pump: { kind: 'pump', durationMs: 3000 },
        light: { kind: 'light', enabled: true },
      },
    } as any
    const result = buildDeviceCommandList(device)
    expect(result).toHaveLength(2)
  })
})

describe('buildQueuedPumpAction', () => {
  it('builds pump action on device with no existing commands', () => {
    const device = {} as any
    const result = buildQueuedPumpAction(device, 10)
    expect(result.queuedCommands.pump).toEqual({ kind: 'pump', durationMs: 10000 })
    expect(result.queuedCommands.light).toBeNull()
  })

  it('preserves existing light command', () => {
    const device = {
      queuedCommands: {
        pump: null,
        light: { kind: 'light', enabled: true },
      },
    } as any
    const result = buildQueuedPumpAction(device, 5)
    expect(result.queuedCommands.pump).toEqual({ kind: 'pump', durationMs: 5000 })
    expect(result.queuedCommands.light).toEqual({ kind: 'light', enabled: true })
  })

  it('replaces existing pump command', () => {
    const device = {
      queuedCommands: {
        pump: { kind: 'pump', durationMs: 999 },
        light: null,
      },
    } as any
    const result = buildQueuedPumpAction(device, 30)
    expect(result.queuedCommands.pump).toEqual({ kind: 'pump', durationMs: 30000 })
  })
})

describe('buildQueuedLightAction', () => {
  it('builds light enabled action', () => {
    const device = {} as any
    const result = buildQueuedLightAction(device, true)
    expect(result.queuedCommands.light).toEqual({ kind: 'light', enabled: true })
    expect(result.queuedCommands.pump).toBeNull()
  })

  it('builds light disabled action', () => {
    const device = {} as any
    const result = buildQueuedLightAction(device, false)
    expect(result.queuedCommands.light).toEqual({ kind: 'light', enabled: false })
  })

  it('preserves existing pump command', () => {
    const device = {
      queuedCommands: {
        pump: { kind: 'pump', durationMs: 5000 },
        light: null,
      },
    } as any
    const result = buildQueuedLightAction(device, true)
    expect(result.queuedCommands.pump).toEqual({ kind: 'pump', durationMs: 5000 })
    expect(result.queuedCommands.light).toEqual({ kind: 'light', enabled: true })
  })
})

describe('getDefaultDeviceName', () => {
  it('returns name with last 6 chars of device ID', () => {
    expect(getDefaultDeviceName('abc123def456')).toBe('GrowMate DEF456')
  })

  it('handles short device IDs', () => {
    expect(getDefaultDeviceName('AB12')).toBe('GrowMate AB12')
  })

  it('trims whitespace', () => {
    expect(getDefaultDeviceName('  device-01  ')).toBe('GrowMate ICE-01')
  })

  it('uppercases the suffix', () => {
    expect(getDefaultDeviceName('test-x1y2z3')).toBe('GrowMate X1Y2Z3')
  })
})
