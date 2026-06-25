import type { DeviceDoc, PlantDoc } from '../types'
import { DEFAULT_TANK_MIN_LEVEL, DEFAULT_FERTILIZING_COOLDOWN, DEFAULT_PESTICIDE_COOLDOWN } from '../types'

export interface V2FertilizingDecision {
  shouldFertilize: boolean
  cooledDown: boolean
  effectiveThreshold: number
  soilValue: number | undefined
  tankLevel: number | undefined
}

export function evaluateFertilizingRule(
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: Map<string, { value: number; unit: string }>,
  now: number,
): V2FertilizingDecision {
  if (!device.autoFertilizing) {
    return {
      shouldFertilize: false, cooledDown: false,
      effectiveThreshold: 0, soilValue: undefined, tankLevel: undefined,
    }
  }

  const soilValue = sensorState.get('soil')?.value
  const tankLevel = sensorState.get('water')?.value
  const effectiveThreshold = activePlant?.fertilizingThreshold ?? device.fertilizingThreshold

  if (soilValue === undefined || soilValue >= effectiveThreshold) {
    return { shouldFertilize: false, cooledDown: false, effectiveThreshold, soilValue, tankLevel }
  }

  if (tankLevel !== undefined && tankLevel <= (device.tankMinLevel ?? DEFAULT_TANK_MIN_LEVEL)) {
    return { shouldFertilize: false, cooledDown: false, effectiveThreshold, soilValue, tankLevel }
  }

  const cooldownSec = device.fertilizingCooldown ?? DEFAULT_FERTILIZING_COOLDOWN
  const cooldownMs = cooldownSec * 1000
  const cooledDown = !device.lastFertilized || now - device.lastFertilized >= cooldownMs

  return { shouldFertilize: true, cooledDown, effectiveThreshold, soilValue, tankLevel }
}

export interface V2PesticideDecision {
  shouldApply: boolean
  cooledDown: boolean
  pestRisk: number
}

export function evaluatePesticideRule(
  device: DeviceDoc,
  activePlant: PlantDoc | null,
  sensorState: Map<string, { value: number; unit: string }>,
  now: number,
): V2PesticideDecision {
  if (!device.autoPesticide) {
    return { shouldApply: false, cooledDown: false, pestRisk: 0 }
  }

  const humidity = sensorState.get('air')?.value
  const pestRisk = humidity !== undefined && humidity > 80 ? 70 : 0

  const cooldownSec = device.pesticideCooldown ?? DEFAULT_PESTICIDE_COOLDOWN
  const cooldownMs = cooldownSec * 1000
  const cooledDown = !device.lastPesticideApplied || now - device.lastPesticideApplied >= cooldownMs

  const threshold = device.pesticideThreshold != null ? device.pesticideThreshold : 50
  const shouldApply = pestRisk >= threshold && cooledDown
  return { shouldApply, cooledDown, pestRisk }
}

export function estimateBatterySoC(
  batteryCurrent: number,
  accumulatedMah: number,
  capacityAh: number,
  timeDeltaMs: number,
): { accumulatedMah: number; soc: number } {
  const deltaMah = (batteryCurrent * timeDeltaMs) / (3600 * 1000)
  const newAccumulated = accumulatedMah + deltaMah
  const capacityMah = (capacityAh || 5) * 1000
  const rawSoC = 50 + (newAccumulated / capacityMah) * 50
  return {
    accumulatedMah: newAccumulated,
    soc: Math.max(0, Math.min(100, rawSoC)),
  }
}
