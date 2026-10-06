import { ConvexError } from 'convex/values'
import type { MutationCtx, UserDoc } from '../types'
import {
  getSelectedDevice,
  executeManualWatering, executeManualLighting,
  executeManualFertilizing, executeManualPesticide,
} from '../helpers/devices'

// Single validation source for manual triggers. Both user mutations
// (care.ts) and AI internalMutations (assistant.ts) delegate to these cores.
type CoreUser = Pick<UserDoc, '_id'>

export async function triggerWateringCore(
  ctx: MutationCtx,
  user: CoreUser,
  deviceId?: string,
) {
  const device = await getSelectedDevice(ctx, user._id, deviceId)
  if (!device) throw new ConvexError('Perangkat tidak ditemukan')

  await executeManualWatering(ctx, user as UserDoc, device)
  return { device }
}

export async function triggerLightingCore(
  ctx: MutationCtx,
  user: CoreUser,
  deviceId: string | undefined,
  enabled: boolean,
) {
  const device = await getSelectedDevice(ctx, user._id, deviceId)
  if (!device) throw new ConvexError('Perangkat tidak ditemukan')

  await executeManualLighting(ctx, user as UserDoc, device, enabled)
  return { device, enabled }
}

export async function triggerFertilizingCore(
  ctx: MutationCtx,
  user: CoreUser,
  deviceId?: string,
) {
  const device = await getSelectedDevice(ctx, user._id, deviceId)
  if (!device) throw new ConvexError('Perangkat tidak ditemukan')
  if (device.version !== 'v2') throw new ConvexError('Aksi ini hanya tersedia untuk perangkat V2')

  await executeManualFertilizing(ctx, user as UserDoc, device)
  return { device }
}

export async function triggerPesticideCore(
  ctx: MutationCtx,
  user: CoreUser,
  deviceId?: string,
) {
  const device = await getSelectedDevice(ctx, user._id, deviceId)
  if (!device) throw new ConvexError('Perangkat tidak ditemukan')
  if (device.version !== 'v2') throw new ConvexError('Aksi ini hanya tersedia untuk perangkat V2')

  await executeManualPesticide(ctx, user as UserDoc, device)
  return { device }
}
