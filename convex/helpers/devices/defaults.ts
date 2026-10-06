import type { DeviceDoc } from '../../types'
import {
  DEFAULT_WATERING_DURATION, DEFAULT_WATERING_COOLDOWN, DEFAULT_LIGHTING_HYSTERESIS,
  DEFAULT_FERTILIZING_DURATION, DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_PESTICIDE_DURATION, DEFAULT_PESTICIDE_COOLDOWN,
} from '../../types'

// convex/types.ts has no reservoir constants (read-only check); the missing
// literals live next to their usage.
const DEFAULT_RESERVOIR_CAPACITY_L = 60
const DEFAULT_RESERVOIR_DAILY_USAGE_L = 5

export function computeWaterReservoirDays(
  waterLevel: number,
  dailyUsage: number = DEFAULT_RESERVOIR_DAILY_USAGE_L,
): number {
  const reservoirCapacity = DEFAULT_RESERVOIR_CAPACITY_L
  const currentLiters = (waterLevel / 100) * reservoirCapacity
  return Math.floor(currentLiters / dailyUsage)
}

export function getDeviceWateringDuration(device: Pick<DeviceDoc, 'wateringDuration'>) {
  return Number.isFinite(device.wateringDuration)
    ? device.wateringDuration
    : DEFAULT_WATERING_DURATION
}

export function getDeviceWateringCooldown(device: Pick<DeviceDoc, 'wateringCooldown'>) {
  return Number.isFinite(device.wateringCooldown)
    ? device.wateringCooldown
    : DEFAULT_WATERING_COOLDOWN
}

export function getDeviceLightingHysteresis(device: Pick<DeviceDoc, 'lightingHysteresis'>) {
  return Number.isFinite(device.lightingHysteresis)
    ? device.lightingHysteresis
    : DEFAULT_LIGHTING_HYSTERESIS
}

export function getDeviceFertilizingDuration(device: Pick<DeviceDoc, 'fertilizingDuration'>) {
  return Number.isFinite(device.fertilizingDuration)
    ? device.fertilizingDuration
    : DEFAULT_FERTILIZING_DURATION
}

export function getDevicePesticideDuration(device: Pick<DeviceDoc, 'pesticideDuration'>) {
  return Number.isFinite(device.pesticideDuration)
    ? device.pesticideDuration
    : DEFAULT_PESTICIDE_DURATION
}

export function getDeviceFertilizingCooldown(device: Pick<DeviceDoc, 'fertilizingCooldown'>) {
  return Number.isFinite(device.fertilizingCooldown)
    ? device.fertilizingCooldown
    : DEFAULT_FERTILIZING_COOLDOWN
}

export function getDevicePesticideCooldown(device: Pick<DeviceDoc, 'pesticideCooldown'>) {
  return Number.isFinite(device.pesticideCooldown)
    ? device.pesticideCooldown
    : DEFAULT_PESTICIDE_COOLDOWN
}
