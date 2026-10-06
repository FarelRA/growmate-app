import type { DeviceDoc, DeviceQueuedCommands, QueuedDeviceAction } from '../../types'

export function getQueuedDeviceCommands(device: DeviceDoc): DeviceQueuedCommands {
  return (
    device.queuedCommands ?? {
      pump: null,
      light: null,
      fertilizer: null,
      pesticide: null,
    }
  )
}

export function buildDeviceCommandList(device: DeviceDoc) {
  return Object.values(getQueuedDeviceCommands(device)).filter(
    (command): command is QueuedDeviceAction => command !== null,
  )
}

export function buildQueuedPumpAction(
  device: DeviceDoc,
  durationSeconds: number,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
) {
  return {
    queuedCommands: {
      ...base,
      pump: { kind: 'pump' as const, durationMs: durationSeconds * 1000 },
    },
  }
}

export function buildQueuedLightAction(
  device: DeviceDoc,
  enabled: boolean,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
) {
  return {
    queuedCommands: {
      ...base,
      light: { kind: 'light' as const, enabled },
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
) {
  return {
    queuedCommands: {
      ...base,
      fertilizer: { kind: 'fertilizer' as const, durationMs: durationSeconds * 1000 },
    },
  }
}

export function buildQueuedPesticideAction(
  device: DeviceDoc,
  durationSeconds: number,
  base: DeviceQueuedCommands = getQueuedDeviceCommands(device),
) {
  return {
    queuedCommands: {
      ...base,
      pesticide: { kind: 'pesticide' as const, durationMs: durationSeconds * 1000 },
    },
  }
}
