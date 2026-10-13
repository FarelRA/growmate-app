import type { DeviceDoc, DeviceQueuedCommands, QueuedDeviceAction } from '../../types'
import { newCommandId } from '../../types'

/**
 * Firmware dose ceiling, seconds: pods api_client rejects durationMs above
 * APP_MAX_PUMP_DURATION_MS and tech api_client caps at bp.MAX_DOSE_MS, both
 * 30000ms. Every dose builder clamps here so no row — however it was
 * staged — can hold a dose the device would refuse (or run past safe).
 */
export const MAX_DOSE_SECONDS = 30

export function clampDoseSeconds(durationSeconds: number): number {
  // Ceiling only: admin-write validation owns the floor. Impossible states
  // (NaN/negative) pass through untouched rather than degrading silently.
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) return durationSeconds
  return Math.min(durationSeconds, MAX_DOSE_SECONDS)
}

export function getQueuedDeviceCommands(device: DeviceDoc): DeviceQueuedCommands {
  return {
    ...(device.queuedCommands ?? {
      pump: null,
      light: null,
      fertilizer: null,
      pesticide: null,
    }),
    videoStart: (device.queuedCommands as DeviceQueuedCommands | undefined)?.videoStart ?? null,
    videoStop: (device.queuedCommands as DeviceQueuedCommands | undefined)?.videoStop ?? null,
  }
}

export function buildDeviceCommandList(device: DeviceDoc) {
  return Object.values(getQueuedDeviceCommands(device)).filter(
    (command): command is QueuedDeviceAction => command !== null,
  )
}

/** Remove every queued command whose id the device already acked. */
export function ackQueuedCommands(
  base: DeviceQueuedCommands,
  acceptedIds: string[],
): { queued: DeviceQueuedCommands; acked: number } {
  if (acceptedIds.length === 0) return { queued: base, acked: 0 }
  const ackedSet = new Set(acceptedIds)
  let acked = 0
  const queued: DeviceQueuedCommands = { ...base }
  for (const key of Object.keys(queued) as (keyof DeviceQueuedCommands)[]) {
    const slot = queued[key]
    if (slot && typeof slot === 'object' && 'id' in slot && typeof slot.id === 'string' && ackedSet.has(slot.id)) {
      queued[key] = null
      acked += 1
    }
  }
  return { queued, acked }
}

export function buildQueuedPumpAction(
  device: DeviceDoc,
  durationSeconds: number,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
  id: string = newCommandId(),
) {
  return {
    queuedCommands: {
      ...base,
      pump: { kind: 'pump' as const, durationMs: clampDoseSeconds(durationSeconds) * 1000, id },
    },
  }
}

export function buildQueuedLightAction(
  device: DeviceDoc,
  enabled: boolean,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
  id: string = newCommandId(),
) {
  return {
    queuedCommands: {
      ...base,
      light: { kind: 'light' as const, enabled, id },
    },
  }
}

// Staged accumulator for multi-action sites: each buildQueued*Action spreads
// its base, so building two actions from the same stale device snapshot and
// Object.assign-ing both wipes the first. Thread this as the base instead.
export function stagedQueuedCommands(
  updates: Record<string, unknown>,
  device: DeviceDoc,
): DeviceQueuedCommands {
  return (updates.queuedCommands as DeviceQueuedCommands | undefined)
    ?? getQueuedDeviceCommands(device)
}

export function buildQueuedFertilizerAction(
  device: DeviceDoc,
  durationSeconds: number,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
  id: string = newCommandId(),
) {
  return {
    queuedCommands: {
      ...base,
      fertilizer: { kind: 'fertilizer' as const, durationMs: clampDoseSeconds(durationSeconds) * 1000, id },
    },
  }
}

export function buildQueuedPesticideAction(
  device: DeviceDoc,
  durationSeconds: number,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
  id: string = newCommandId(),
) {
  return {
    queuedCommands: {
      ...base,
      pesticide: { kind: 'pesticide' as const, durationMs: clampDoseSeconds(durationSeconds) * 1000, id },
    },
  }
}

export interface VideoStartParams {
  width: number
  height: number
  fps: number
  quality: number
  maxSec: number
}

export function buildQueuedVideoStartAction(
  device: DeviceDoc,
  params: VideoStartParams,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
  id: string = newCommandId(),
) {
  // Same-actuator supersede (not a bug): a pending stop is meaningless
  // once a fresh start is staged, and vice versa below.
  return {
    queuedCommands: {
      ...base,
      videoStart: { kind: 'video_start' as const, ...params, id },
      videoStop: null,
    },
  }
}

export function buildQueuedVideoStopAction(
  device: DeviceDoc,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
  id: string = newCommandId(),
) {
  return {
    queuedCommands: {
      ...base,
      videoStart: null,
      videoStop: { kind: 'video_stop' as const, id },
    },
  }
}
