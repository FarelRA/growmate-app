import { v, ConvexError } from 'convex/values'
import { mutation } from './_generated/server'
import type { CareScheduleDoc, ScheduleCadence, ScheduleCadenceUnit } from './types'
import {
  requireUser, recordGrowEvent,
  getSelectedDevice,
  executeManualWatering, executeManualLighting,
  executeManualFertilizing, executeManualPesticide,
} from './helpers'

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

export const toggleCareSchedule = mutation({
  args: { scheduleId: v.id('careSchedules'), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) throw new ConvexError('Jadwal tidak ditemukan')

    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) throw new ConvexError('Tanaman tidak ditemukan')

    const device = await ctx.db.get(plant.deviceId)
    if (!device || device.userId !== user._id) throw new ConvexError('Jadwal tidak ditemukan')

    await ctx.db.patch(args.scheduleId, { enabled: args.enabled })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_toggled',
      title: args.enabled ? 'Jadwal diaktifkan' : 'Jadwal dijeda',
      detail: `${schedule.title} ${args.enabled ? 'kembali dijalankan' : 'sementara dijeda'}.`,
      data: { enabled: args.enabled },
      timestamp: Date.now(),
    })

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

    return { success: true, scheduleId }
  },
})

export const deleteCareSchedule = mutation({
  args: { scheduleId: v.id('careSchedules') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) throw new ConvexError('Jadwal tidak ditemukan')

    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) throw new ConvexError('Tanaman tidak ditemukan')

    const device = await ctx.db.get(plant.deviceId)
    if (!device || device.userId !== user._id) throw new ConvexError('Jadwal tidak ditemukan')

    await ctx.db.delete(args.scheduleId)

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

    return { success: true }
  },
})

export const triggerWatering = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) throw new ConvexError('Perangkat tidak ditemukan')

    await executeManualWatering(ctx, user, device)
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
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) throw new ConvexError('Perangkat tidak ditemukan')

    await executeManualLighting(ctx, user, device, args.enabled)
    return { success: true, enabled: args.enabled }
  },
})

export const triggerFertilizing = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) throw new ConvexError('Perangkat tidak ditemukan')

    await executeManualFertilizing(ctx, user, device)
    return { success: true }
  },
})

export const triggerPesticide = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) throw new ConvexError('Perangkat tidak ditemukan')

    await executeManualPesticide(ctx, user, device)
    return { success: true }
  },
})
