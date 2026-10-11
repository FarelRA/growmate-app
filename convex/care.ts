import { v } from 'convex/values'
import { internalMutation, mutation } from './_generated/server'
import { requireUser } from './helpers/auth'
import {
  toggleScheduleCore,
  deleteScheduleCore,
  saveScheduleCore,
  executeDueSchedulesCore,
} from './care/schedules'
import {
  triggerWateringCore,
  triggerLightingCore,
  triggerFertilizingCore,
  triggerPesticideCore,
  triggerVideoStartCore,
  triggerVideoStopCore,
} from './care/triggers'

// Re-exports: single import path for cores + schedule helpers.
// assistant.ts and tests/convex/* import these from './care' (or
// '../../convex/care'); the implementations live in ./care/*.
export {
  normalizeScheduleCadence,
  formatScheduleCadence,
  computeNextRunAtFromCadence,
  formatScheduleSummary,
  requirePlantDevice,
  toggleScheduleCore,
  deleteScheduleCore,
  saveScheduleCore,
  inferScheduleAction,
  SCHEDULE_EXECUTOR_BATCH_CAP,
} from './care/schedules'
export {
  triggerWateringCore,
  triggerLightingCore,
  triggerFertilizingCore,
  triggerPesticideCore,
  triggerVideoStartCore,
  triggerVideoStopCore,
} from './care/triggers'

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

export const triggerVideoStart = mutation({
  args: {
    deviceId: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    fps: v.optional(v.number()),
    quality: v.optional(v.number()),
    maxSec: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await triggerVideoStartCore(ctx, user, args.deviceId, {
      width: args.width,
      height: args.height,
      fps: args.fps,
      quality: args.quality,
      maxSec: args.maxSec,
    })
    return { success: true }
  },
})

export const triggerVideoStop = mutation({
  args: { deviceId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    await triggerVideoStopCore(ctx, user, args.deviceId)
    return { success: true }
  },
})

// Schedule executor (cron-driven, see internal.care.executeDueSchedules in
// convex/crons.ts). The per-schedule loop lives in
// ./care/schedules:executeDueSchedulesCore; this internalMutation is a thin
// delegate so the api.care.executeDueSchedules path is unchanged.
export const executeDueSchedules = internalMutation({
  args: { now: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await executeDueSchedulesCore(ctx, args)
  },
})
