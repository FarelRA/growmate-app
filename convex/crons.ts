import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'
import { internalMutation } from './_generated/server'

const crons = cronJobs()

crons.interval('cleanup-old-sensor-readings', { hours: 24 }, internal.crons.cleanupSensorReadings)
crons.interval('cleanup-old-grow-events', { hours: 24 }, internal.crons.cleanupGrowEvents)
crons.interval('cleanup-old-automation-logs', { hours: 24 }, internal.crons.cleanupAutomationLogs)

export const cleanupSensorReadings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    let batch
    do {
      batch = await ctx.db
        .query('sensorReadings')
        .withIndex('by_measuredAt', (q) => q.lte('measuredAt', cutoff))
        .take(500)
      for (const r of batch) {
        await ctx.db.delete(r._id)
      }
    } while (batch.length === 500)
  },
})

export const cleanupGrowEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    let batch
    do {
      batch = await ctx.db
        .query('growEvents')
        .withIndex('by_timestamp', (q) => q.lte('timestamp', cutoff))
        .take(500)
      for (const e of batch) {
        await ctx.db.delete(e._id)
      }
    } while (batch.length === 500)
  },
})

export const cleanupAutomationLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
    let batch
    do {
      batch = await ctx.db
        .query('automationLogs')
        .withIndex('by_timestamp', (q) => q.lte('timestamp', cutoff))
        .take(500)
      for (const l of batch) {
        await ctx.db.delete(l._id)
      }
    } while (batch.length === 500)
  },
})

export default crons
