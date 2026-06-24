import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getDeviceByExternalId, recordGrowEvent } from './helpers'

export const registerStream = mutation({
  args: {
    deviceId: v.string(),
    streamUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const now = Date.now()

    await ctx.db.patch(device._id, {
      streamUrl: args.streamUrl,
      updatedAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      source: 'device',
      entityType: 'device',
      eventType: 'stream_registered',
      title: 'Stream terdaftar',
      detail: `${device.name} mendaftarkan stream video.`,
      data: { streamUrl: args.streamUrl },
      timestamp: now,
    })

    return { success: true }
  },
})

export const recordStreamSegment = mutation({
  args: {
    deviceId: v.string(),
    fileName: v.string(),
    path: v.string(),
    size: v.number(),
    durationMs: v.optional(v.number()),
    capturedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const recordingId = await ctx.db.insert('videoRecordings', {
      deviceId: device._id,
      fileName: args.fileName,
      path: args.path,
      size: args.size,
      durationMs: args.durationMs,
      capturedAt: args.capturedAt,
      uploadedAt: Date.now(),
    })

    return { success: true, recordingId }
  },
})

export const getStreamUrl = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device) return null
    return device.streamUrl ?? null
  },
})

export const listRecordings = query({
  args: { deviceId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device) return []

    const recordings = await ctx.db
      .query('videoRecordings')
      .withIndex('by_device', (q) => q.eq('deviceId', device._id))
      .order('desc')
      .take(args.limit ?? 20)

    return recordings.map((r) => ({
      _id: r._id,
      fileName: r.fileName,
      path: r.path,
      size: r.size,
      durationMs: r.durationMs,
      capturedAt: r.capturedAt,
      uploadedAt: r.uploadedAt,
    }))
  },
})
