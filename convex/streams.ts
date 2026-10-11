import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser } from './helpers/auth'
import { getDeviceByExternalId } from './helpers/devices'

export const DEFAULT_RECORDINGS_CAP = 50
export const MAX_RECORDINGS_CAP = 100

export function clampRecordingsLimit(requested?: number): number {
  const fallback = Number.isFinite(requested as number)
    ? (requested as number)
    : DEFAULT_RECORDINGS_CAP
  return Math.min(Math.max(Math.floor(fallback), 0), MAX_RECORDINGS_CAP)
}

export const getOwnedDevice = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device || !device.userId || String(device.userId) !== String(user._id)) {
      return null
    }

    return {
      deviceId: device.deviceId,
      name: device.name,
    }
  },
})

function assertDeviceKey(deviceKey: string) {
  const expected = process.env.DEVICE_API_KEY
  if (!expected) {
    throw new ConvexError('server misconfigured')
  }
  if (deviceKey !== expected) {
    throw new ConvexError('Unauthorized')
  }
}

export const recordLiveSession = mutation({
  args: {
    deviceKey: v.string(),
    deviceId: v.string(),
    fileName: v.string(),
    path: v.string(),
    size: v.number(),
    durationMs: v.optional(v.number()),
    capturedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertDeviceKey(args.deviceKey)

    // The only caller builds these server-side (sanitized videoId, S3 key,
    // measured byte length), but fail closed on junk instead of storing it:
    // these rows drive S3 deletes and signed-URL issuance downstream.
    if (!args.fileName.trim() || !args.path.trim()) {
      throw new ConvexError('fileName + path required')
    }
    if (!Number.isFinite(args.size) || args.size < 0) {
      throw new ConvexError('size must be >= 0')
    }
    if (!Number.isFinite(args.capturedAt)) {
      throw new ConvexError('capturedAt harus berupa timestamp yang valid')
    }
    if (args.durationMs !== undefined && (!Number.isFinite(args.durationMs) || args.durationMs < 0)) {
      throw new ConvexError('durationMs must be >= 0')
    }

    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device) {
      throw new ConvexError('Perangkat tidak ditemukan')
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

export const listRecordings = query({
  args: { deviceId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // User-called with Bearer auth: enforce ownership like getOwnedDevice /
    // dashboard / deviceHistory so S3 paths never leak across accounts.
    const user = await getCurrentUser(ctx)
    if (!user) return []

    const device = await getDeviceByExternalId(ctx, args.deviceId)
    if (!device) return []
    if (!device.userId || String(device.userId) !== String(user._id)) {
      return []
    }

    const recordings = await ctx.db
      .query('videoRecordings')
      .withIndex('by_device', (q) => q.eq('deviceId', device._id))
      .order('desc')
      .take(clampRecordingsLimit(args.limit))

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
