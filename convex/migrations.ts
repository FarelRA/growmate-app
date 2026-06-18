import { internalMutation } from './_generated/server'

export const migrateDeviceIdsToFk = internalMutation({
  handler: async (ctx) => {
    // Migrate sensors
    const sensors = await ctx.db.query('sensors').collect()
    for (const sensor of sensors) {
      const device = await ctx.db
        .query('devices')
        .withIndex('by_deviceId', (q) => q.eq('deviceId', sensor.deviceId))
        .first()
      if (device) {
        await ctx.db.patch(sensor._id, { deviceId: device._id })
      } else {
        await ctx.db.delete(sensor._id)
      }
    }

    // Migrate sensorReadings
    const readings = await ctx.db.query('sensorReadings').collect()
    for (const reading of readings) {
      const device = await ctx.db
        .query('devices')
        .withIndex('by_deviceId', (q) => q.eq('deviceId', reading.deviceId))
        .first()
      if (device) {
        await ctx.db.patch(reading._id, { deviceId: device._id })
      } else {
        await ctx.db.delete(reading._id)
      }
    }

    // Migrate automationLogs
    const logs = await ctx.db.query('automationLogs').collect()
    for (const log of logs) {
      const device = await ctx.db
        .query('devices')
        .withIndex('by_deviceId', (q) => q.eq('deviceId', log.deviceId))
        .first()
      if (device) {
        await ctx.db.patch(log._id, { deviceId: device._id })
      } else {
        await ctx.db.delete(log._id)
      }
    }
  },
})
