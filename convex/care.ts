import { v, ConvexError } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, UserDoc, CareScheduleDoc, ScheduleCadence, ScheduleCadenceUnit } from './types'
import { requireUser } from './helpers/auth'
import { recordGrowEvent } from './helpers/events'
import { CARE_SCHEDULES_PER_PLANT_CAP } from './crons'
import {
  getSelectedDevice,
  executeManualWatering, executeManualLighting,
  executeManualFertilizing, executeManualPesticide,
} from './helpers/devices'

function clampScheduleTimeOfDayMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 8 * 60
  return Math.max(0, Math.min(23 * 60 + 59, Math.round(value)))
}

export function normalizeScheduleCadence(input: {
  cadenceUnit?: CareScheduleDoc['cadenceUnit']
  cadenceValue?: CareScheduleDoc['cadenceValue']
  timeOfDayMinutes?: CareScheduleDoc['timeOfDayMinutes']
  timezoneOffsetMinutes?: CareScheduleDoc['timezoneOffsetMinutes']
}): ScheduleCadence {
  const unit: ScheduleCadenceUnit = input.cadenceUnit === 'hours' ? 'hours' : 'days'
  return {
    unit,
    value: Math.max(1, Math.round(input.cadenceValue ?? 1)),
    timeOfDayMinutes: unit === 'days' ? clampScheduleTimeOfDayMinutes(input.timeOfDayMinutes) : null,
    timezoneOffsetMinutes: unit === 'days' ? Math.round(input.timezoneOffsetMinutes ?? 0) : 0,
  }
}

function formatScheduleTime(minutes: number | null) {
  if (minutes === null) return null
  const normalized = clampScheduleTimeOfDayMinutes(minutes)
  const hours24 = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours24).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

export function formatScheduleCadence(cadence: ScheduleCadence) {
  if (cadence.unit === 'hours') {
    return cadence.value === 1 ? 'Setiap jam' : `Setiap ${cadence.value} jam`
  }
  const dayLabel = cadence.value === 1 ? 'Setiap hari' : `Setiap ${cadence.value} hari`
  const timeLabel = formatScheduleTime(cadence.timeOfDayMinutes)
  return timeLabel ? `${dayLabel} pukul ${timeLabel}` : dayLabel
}

export function computeNextRunAtFromCadence(cadence: ScheduleCadence, fromTime: number) {
  if (cadence.unit === 'hours') {
    return fromTime + cadence.value * 60 * 60 * 1000
  }
  const timeOfDayMinutes = clampScheduleTimeOfDayMinutes(cadence.timeOfDayMinutes)
  const localReference = new Date(fromTime + cadence.timezoneOffsetMinutes * 60 * 1000)
  const localYear = localReference.getUTCFullYear()
  const localMonth = localReference.getUTCMonth()
  const localDate = localReference.getUTCDate()
  const localHours = Math.floor(timeOfDayMinutes / 60)
  const localMinutes = timeOfDayMinutes % 60

  let candidate =
    Date.UTC(localYear, localMonth, localDate, localHours, localMinutes) -
    cadence.timezoneOffsetMinutes * 60 * 1000
  if (candidate <= fromTime) {
    candidate =
      Date.UTC(localYear, localMonth, localDate + cadence.value, localHours, localMinutes) -
      cadence.timezoneOffsetMinutes * 60 * 1000
  }
  return candidate
}

export function formatScheduleSummary(input: {
  cadenceUnit?: CareScheduleDoc['cadenceUnit']
  cadenceValue?: CareScheduleDoc['cadenceValue']
  timeOfDayMinutes?: CareScheduleDoc['timeOfDayMinutes']
  timezoneOffsetMinutes?: CareScheduleDoc['timezoneOffsetMinutes']
}) {
  const cadence = normalizeScheduleCadence(input)
  return {
    cadence,
    cadenceLabel: formatScheduleCadence(cadence),
    timeLabel: formatScheduleTime(cadence.timeOfDayMinutes),
  }
}

// ============================================
// Single validation source for schedules + triggers.
// Both user mutations (below) and AI internalMutations
// (assistant.ts) delegate to these cores.
// ============================================

type CoreUser = Pick<UserDoc, '_id'>

// Single source for the schedule preamble: fetch the plant's device and
// reject foreign devices with the same "not found" error (no existence
// oracle). toggle/delete cores fetch schedule → plant, then delegate here.
export async function requirePlantDevice(
  ctx: MutationCtx,
  user: CoreUser,
  deviceId: Id<'devices'>,
) {
  const device = await ctx.db.get(deviceId)
  if (!device || device.userId !== user._id) throw new ConvexError('Jadwal tidak ditemukan')
  return device
}

export async function toggleScheduleCore(
  ctx: MutationCtx,
  user: CoreUser,
  scheduleId: Id<'careSchedules'>,
  enabled: boolean,
) {
  const schedule = await ctx.db.get(scheduleId)
  if (!schedule) throw new ConvexError('Jadwal tidak ditemukan')

  const plant = await ctx.db.get(schedule.plantId)
  if (!plant) throw new ConvexError('Tanaman tidak ditemukan')

  const device = await requirePlantDevice(ctx, user, plant.deviceId)

  await ctx.db.patch(scheduleId, { enabled })

  await recordGrowEvent(ctx, {
    deviceId: device._id,
    plantId: plant._id,
    userId: user._id,
    source: 'user',
    entityType: 'schedule',
    eventType: 'care_schedule_toggled',
    title: enabled ? 'Jadwal diaktifkan' : 'Jadwal dijeda',
    detail: `${schedule.title} ${enabled ? 'kembali dijalankan' : 'sementara dijeda'}.`,
    data: { enabled },
    timestamp: Date.now(),
  })

  return { title: schedule.title, enabled }
}

export async function deleteScheduleCore(
  ctx: MutationCtx,
  user: CoreUser,
  scheduleId: Id<'careSchedules'>,
) {
  const schedule = await ctx.db.get(scheduleId)
  if (!schedule) throw new ConvexError('Jadwal tidak ditemukan')

  const plant = await ctx.db.get(schedule.plantId)
  if (!plant) throw new ConvexError('Tanaman tidak ditemukan')

  const device = await requirePlantDevice(ctx, user, plant.deviceId)

  await ctx.db.delete(scheduleId)

  await recordGrowEvent(ctx, {
    deviceId: device._id,
    plantId: plant._id,
    userId: user._id,
    source: 'user',
    entityType: 'schedule',
    eventType: 'care_schedule_deleted',
    title: 'Jadwal dihapus',
    detail: `${schedule.title} telah dihapus dari daftar perawatan berulang.`,
    timestamp: Date.now(),
  })

  return { title: schedule.title }
}

export async function saveScheduleCore(
  ctx: MutationCtx,
  user: CoreUser,
  args: {
    scheduleId?: Id<'careSchedules'>
    deviceId?: string
    title: string
    cadenceUnit: 'hours' | 'days'
    cadenceValue: number
    timeOfDayMinutes?: number
    timezoneOffsetMinutes?: number
  },
) {
  const device = await getSelectedDevice(ctx, user._id, args.deviceId)
  if (!device || !device.plantId) {
    throw new ConvexError('Perangkat dengan tanaman aktif tidak ditemukan')
  }

  const plant = await ctx.db.get(device.plantId)
  if (!plant || plant.archived) throw new ConvexError('Tanaman tidak ditemukan')

  const now = Date.now()
  const title = args.title.trim()
  if (!title) throw new ConvexError('Judul jadwal wajib diisi')

  const cadence = normalizeScheduleCadence({
    cadenceUnit: args.cadenceUnit,
    cadenceValue: args.cadenceValue,
    timeOfDayMinutes: args.timeOfDayMinutes,
    timezoneOffsetMinutes: args.timezoneOffsetMinutes,
  })
  const nextRunAt = computeNextRunAtFromCadence(cadence, now)
  let scheduleId = args.scheduleId

  if (scheduleId) {
    const existing = await ctx.db.get(scheduleId)
    if (!existing || String(existing.plantId) !== String(plant._id)) {
      throw new ConvexError('Jadwal tidak ditemukan')
    }

    await ctx.db.patch(scheduleId, {
      title,
      cadenceUnit: cadence.unit,
      cadenceValue: cadence.value,
      timeOfDayMinutes: cadence.timeOfDayMinutes ?? undefined,
      timezoneOffsetMinutes: cadence.timezoneOffsetMinutes,
      nextRunAt,
    })
  } else {
    const existing = await ctx.db
      .query('careSchedules')
      .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
      .take(CARE_SCHEDULES_PER_PLANT_CAP + 1)
    if (existing.length >= CARE_SCHEDULES_PER_PLANT_CAP) {
      throw new ConvexError(
        'Batas jadwal perawatan tercapai (maksimal 20 per tanaman). Hapus jadwal yang tidak dipakai sebelum menambah.',
      )
    }
    scheduleId = await ctx.db.insert('careSchedules', {
      plantId: plant._id,
      title,
      cadenceUnit: cadence.unit,
      cadenceValue: cadence.value,
      timeOfDayMinutes: cadence.timeOfDayMinutes ?? undefined,
      timezoneOffsetMinutes: cadence.timezoneOffsetMinutes,
      nextRunAt,
      enabled: true,
      createdAt: now,
    })
  }

  await recordGrowEvent(ctx, {
    deviceId: device._id,
    plantId: plant._id,
    userId: user._id,
    source: 'user',
    entityType: 'schedule',
    eventType: 'care_schedule_saved',
    title: args.scheduleId ? 'Jadwal diperbarui' : 'Jadwal dibuat',
    detail: `${title} akan berjalan ${formatScheduleCadence(cadence).toLowerCase()}.`,
    data: {
      cadenceValue: cadence.value,
      cadenceHours: cadence.unit === 'hours' ? cadence.value : cadence.value * 24,
      cadenceUnit: cadence.unit,
    },
    timestamp: now,
  })

  return { scheduleId, title, cadence }
}

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

export const toggleCareSchedule = mutation({
  args: { scheduleId: v.id('careSchedules'), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await toggleScheduleCore(ctx, user, args.scheduleId, args.enabled)
    return { success: true }
  },
})

export const saveCareSchedule = mutation({
  args: {
    scheduleId: v.optional(v.id('careSchedules')),
    deviceId: v.optional(v.string()),
    title: v.string(),
    cadenceUnit: v.union(v.literal('hours'), v.literal('days')),
    cadenceValue: v.number(),
    timeOfDayMinutes: v.optional(v.number()),
    timezoneOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const { scheduleId } = await saveScheduleCore(ctx, user, args)
    return { success: true, scheduleId }
  },
})

export const deleteCareSchedule = mutation({
  args: { scheduleId: v.id('careSchedules') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await deleteScheduleCore(ctx, user, args.scheduleId)
    return { success: true }
  },
})

export const triggerWatering = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await triggerWateringCore(ctx, user, args.deviceId)
    return { success: true }
  },
})

export const triggerLighting = mutation({
  args: {
    deviceId: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await triggerLightingCore(ctx, user, args.deviceId, args.enabled)
    return { success: true, enabled: args.enabled }
  },
})

export const triggerFertilizing = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await triggerFertilizingCore(ctx, user, args.deviceId)
    return { success: true }
  },
})

export const triggerPesticide = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await triggerPesticideCore(ctx, user, args.deviceId)
    return { success: true }
  },
})

// ============================================
// Schedule executor (cron-driven).
// careSchedules rows carry no action discriminator (free-text title only),
// so the action is inferred from title keywords with a watering default
// (matches the "Penyiraman Otomatis" seed schedule). Lighting titles fire
// the light queue; everything else fires the pump queue via the shared
// trigger *Core functions above — no rule logic is duplicated here.
// ============================================

export const SCHEDULE_EXECUTOR_BATCH_CAP = 100

const LIGHTING_TITLE_KEYWORDS = ['cahaya', 'lampu', 'light', 'pencahayaan'] as const
const LIGHT_OFF_KEYWORDS = ['mati', 'padam', 'off'] as const

export function inferScheduleAction(title: string): { kind: 'lighting'; enabled: boolean } | { kind: 'watering' } {
  const normalized = title.toLowerCase()
  if (LIGHTING_TITLE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return { kind: 'lighting', enabled: !LIGHT_OFF_KEYWORDS.some((keyword) => normalized.includes(keyword)) }
  }
  return { kind: 'watering' }
}

export const executeDueSchedules = internalMutation({
  args: { now: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const runStart = args.now ?? Date.now()
    const cap = Math.max(
      1,
      Math.min(SCHEDULE_EXECUTOR_BATCH_CAP, Math.round(args.limit ?? SCHEDULE_EXECUTOR_BATCH_CAP)),
    )
    const due = await ctx.db
      .query('careSchedules')
      .withIndex('by_nextRunAt', (q) => q.lte('nextRunAt', runStart))
      .take(cap)

    let fired = 0
    let skipped = 0
    const errors: Array<{ scheduleId: string; error: string }> = []

    for (const schedule of due) {
      // Re-read inside the loop: a schedule deleted/disabled mid-batch is
      // skipped, and lastRunAt >= runStart guards double-fire if two cron
      // runs overlap (nextRunAt advancement below is the primary guard —
      // this whole mutation commits atomically, so a concurrent overlapping
      // run conflicts and retries against the already-advanced row).
      const current = await ctx.db.get(schedule._id)
      if (!current || !current.enabled) {
        skipped += 1
        continue
      }
      if (current.nextRunAt > runStart) {
        skipped += 1
        continue
      }
      if (current.lastRunAt != null && current.lastRunAt >= runStart) {
        skipped += 1
        continue
      }

      const cadence = normalizeScheduleCadence(current)
      const nextRunAt = computeNextRunAtFromCadence(cadence, runStart)
      const plant = await ctx.db.get(current.plantId)
      const device = plant ? await ctx.db.get(plant.deviceId) : null
      const ownerId = device?.userId
      if (!plant || plant.archived || !device || !ownerId) {
        // Skip without firing, but still advance nextRunAt so one orphaned
        // schedule can't permanently wedge the per-run cap. lastRunAt is
        // left untouched as evidence nothing fired.
        await ctx.db.patch(current._id, { nextRunAt })
        skipped += 1
        continue
      }

      try {
        const action = inferScheduleAction(current.title)
        if (action.kind === 'lighting') {
          await triggerLightingCore(ctx, { _id: ownerId }, device.deviceId, action.enabled)
        } else {
          await triggerWateringCore(ctx, { _id: ownerId }, device.deviceId)
        }
        await ctx.db.patch(current._id, { nextRunAt, lastRunAt: runStart })
        fired += 1
      } catch (error) {
        errors.push({
          scheduleId: String(current._id),
          error: error instanceof Error ? error.message : String(error),
        })
        skipped += 1
      }
    }

    return { checked: due.length, fired, skipped, errors }
  },
})
