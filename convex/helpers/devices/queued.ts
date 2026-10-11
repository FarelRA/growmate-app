import type { DeviceDoc, DeviceQueuedCommands, QueuedDeviceAction } from '../../types'
import { newCommandId } from '../../types'

export function emptyQueuedCommands(): DeviceQueuedCommands {
  return {
    pump: null,
    light: null,
    fertilizer: null,
    pesticide: null,
    videoStart: null,
    videoStop: null,
  }
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
      pump: { kind: 'pump' as const, durationMs: durationSeconds * 1000, id },
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
      fertilizer: { kind: 'fertilizer' as const, durationMs: durationSeconds * 1000, id },
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
      pesticide: { kind: 'pesticide' as const, durationMs: durationSeconds * 1000, id },
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
