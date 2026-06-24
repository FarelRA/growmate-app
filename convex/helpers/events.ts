import type { Ctx, MutationCtx, GrowEventSource, GrowEventEntity, GrowEventType } from '../types'
import type { Id } from '../_generated/dataModel'
import { formatTimestamp, getRelativeTime } from './generic'

export async function recordGrowEvent(
  ctx: MutationCtx,
  args: {
    deviceId?: Id<'devices'>
    plantId?: Id<'plants'>
    userId?: Id<'users'>
    source: GrowEventSource
    entityType: GrowEventEntity
    eventType: GrowEventType
    title: string
    detail?: string
    data?: Record<string, string | number | boolean>
    timestamp: number
  },
) {
  await ctx.db.insert('growEvents', args)
}

export async function recordPlantImage(
  ctx: MutationCtx,
  args: {
    plantId?: Id<'plants'>
    deviceId: Id<'devices'>
    imageUrl: string
    source: 'camera' | 'manual'
    capturedAt: number
  },
) {
  await ctx.db.insert('plantImages', args)
}

export async function recordAutomationEvent(
  ctx: MutationCtx,
  args: {
    deviceId: Id<'devices'>
    plantId?: Id<'plants'>
    action:
      | 'pump_enabled'
      | 'pump_disabled'
      | 'light_on'
      | 'light_off'
      | 'manual_pump'
      | 'manual_light'
      | 'schedule_completed'
      | 'fertilizer_opened'
      | 'fertilizer_closed'
      | 'pesticide_opened'
      | 'pesticide_closed'
      | 'manual_fertilizer'
      | 'manual_pesticide'
    soilValue?: number
    lightValue?: number
    threshold?: number
    duration?: number
    timestamp: number
  },
) {
  if (!args.plantId) return
  await ctx.db.insert('automationLogs', {
    deviceId: args.deviceId,
    plantId: args.plantId,
    timestamp: args.timestamp,
    action: args.action,
    soilValue: args.soilValue,
    lightValue: args.lightValue,
    threshold: args.threshold,
    duration: args.duration,
  })
}

export async function getRecentGrowEvents(ctx: Ctx, deviceDocId: Id<'devices'>, limit = 10) {
  const events = await ctx.db
    .query('growEvents')
    .withIndex('by_device_and_timestamp', (q) => q.eq('deviceId', deviceDocId))
    .order('desc')
    .take(limit)

  return events.map((event) => ({
    ...event,
    timestampLabel: formatTimestamp(event.timestamp),
    relativeTime: getRelativeTime(event.timestamp),
  }))
}

export async function getRecentAutomationLogs(ctx: Ctx, plantId: Id<'plants'>, limit = 8) {
  const logs = await ctx.db
    .query('automationLogs')
    .withIndex('by_plant', (q) => q.eq('plantId', plantId))
    .order('desc')
    .take(limit)

  return logs.map((log) => ({
    ...log,
    timestampLabel: formatTimestamp(log.timestamp),
    relativeTime: getRelativeTime(log.timestamp),
  }))
}

export async function getSupportMessages(ctx: Ctx, requestId: Id<'supportRequests'>, limit = 24) {
  const messages = await ctx.db
    .query('supportMessages')
    .withIndex('by_request_and_createdAt', (q) => q.eq('requestId', requestId))
    .order('desc')
    .take(limit)

  return messages.reverse()
}
