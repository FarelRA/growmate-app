import type { MutationCtx, DeviceDoc } from '../../types'
import type { Id } from '../../_generated/dataModel'
import {
  getDeviceWateringDuration,
  getDeviceFertilizingDuration,
  getDevicePesticideDuration,
} from './defaults'
import {
  buildQueuedPumpAction,
  buildQueuedLightAction,
  buildQueuedFertilizerAction,
  buildQueuedPesticideAction,
  stagedQueuedCommands,
} from './queued'
import { recordGrowEvent, recordAutomationEvent } from '../events'

export async function executeManualWatering(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  now = Date.now(),
) {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null
  const durationSeconds = getDeviceWateringDuration(device)

  const updates: Record<string, unknown> = {
    ...buildQueuedPumpAction(device, durationSeconds),
    updatedAt: now,
  }

  // Manual watering queues the pump only. Fertilizer/pesticide have their
  // own explicit actions (executeManualFertilizing/executeManualPesticide);
  // bundling them here would dose undisclosed chemicals on every watering.
  await ctx.db.patch(device._id, updates)

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_pump',
      duration: durationSeconds,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_watering_triggered',
      title: 'Penyiraman manual dipicu',
      detail: `${device.name} memulai siklus penyiraman manual.`,
      data: { duration: durationSeconds },
      timestamp: now,
    })
  }

  await ctx.db.insert('notifications', {
    userId: user._id,
    title: 'Penyiraman manual dipicu',
    detail: `${device.name} berhasil menjalankan siklus penyiraman manual.`,
    kind: 'system',
    read: false,
    createdAt: now,
  })
}

export type ManualDoseKind = 'fertilizer' | 'pesticide'

const MANUAL_DOSE_META = {
  fertilizer: {
    automationAction: 'manual_fertilizer',
    eventType: 'manual_fertilizing_triggered',
    title: 'Pemupukan manual dipicu',
    detail: (deviceName: string) => `${deviceName} memulai siklus pemupukan manual.`,
  },
  pesticide: {
    automationAction: 'manual_pesticide',
    eventType: 'manual_pesticide_triggered',
    title: 'Pestisida manual dipicu',
    detail: (deviceName: string) => `${deviceName} memulai siklus pestisida manual.`,
  },
} as const

export async function executeManualDose(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  opts: { kind: ManualDoseKind; now?: number },
): Promise<void> {
  const now = opts.now ?? Date.now()
  const meta = MANUAL_DOSE_META[opts.kind]
  const durationSeconds =
    opts.kind === 'fertilizer'
      ? getDeviceFertilizingDuration(device)
      : getDevicePesticideDuration(device)

  const doseUpdates: Record<string, unknown> = {
    ...(opts.kind === 'fertilizer'
      ? buildQueuedFertilizerAction(device, durationSeconds)
      : buildQueuedPesticideAction(device, durationSeconds)),
  }
  Object.assign(
    doseUpdates,
    buildQueuedPumpAction(device, durationSeconds, stagedQueuedCommands(doseUpdates, device)),
  )

  await ctx.db.patch(device._id, {
    ...doseUpdates,
    updatedAt: now,
  })

  const plant = device.plantId ? await ctx.db.get(device.plantId) : null
  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: meta.automationAction,
      duration: durationSeconds,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: meta.eventType,
      title: meta.title,
      detail: meta.detail(device.name),
      data: { duration: durationSeconds },
      timestamp: now,
    })
  }
}

export async function executeManualFertilizing(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  now = Date.now(),
): Promise<void> {
  await executeManualDose(ctx, user, device, { kind: 'fertilizer', now })
}

export async function executeManualPesticide(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  now = Date.now(),
): Promise<void> {
  await executeManualDose(ctx, user, device, { kind: 'pesticide', now })
}

export async function executeManualLighting(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  enabled: boolean,
  now = Date.now(),
) {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null

  await ctx.db.patch(device._id, {
    ...buildQueuedLightAction(device, enabled),
    lightEnabled: enabled,
    updatedAt: now,
  })

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_light',
      lightValue: undefined,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_lighting_triggered',
      title: enabled ? 'Pencahayaan manual dinyalakan' : 'Pencahayaan manual dimatikan',
      detail: `${device.name} lampu tumbuh ${enabled ? 'dinyalakan' : 'dimatikan'} secara manual.`,
      data: { enabled },
      timestamp: now,
    })
  }
}
