import { v } from 'convex/values'
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'
import { internalAction, internalMutation } from './_generated/server'

const crons = cronJobs()

crons.interval('cleanup-old-sensor-readings', { hours: 24 }, internal.crons.cleanupSensorReadings)
crons.interval('cleanup-old-grow-events', { hours: 24 }, internal.crons.cleanupGrowEvents)
crons.interval('cleanup-old-automation-logs', { hours: 24 }, internal.crons.cleanupAutomationLogs)
crons.interval('cleanup-old-video-recordings', { hours: 24 }, internal.crons.cleanupVideoRecordings)
crons.interval('cleanup-old-device-snapshots', { hours: 24 }, internal.crons.cleanupDeviceSnapshots)
crons.interval('cleanup-old-plant-images', { hours: 24 }, internal.crons.cleanupPlantImages)
crons.interval('cleanup-old-notifications', { hours: 24 }, internal.crons.cleanupNotifications)
crons.interval('cleanup-old-user-activities', { hours: 24 }, internal.crons.cleanupUserActivities)
crons.interval('cleanup-old-assistant-messages', { hours: 24 }, internal.crons.cleanupAssistantMessages)
crons.interval('execute-due-care-schedules', { minutes: 5 }, internal.care.executeDueSchedules, {})

export const PLANT_IMAGES_PER_PLANT_CAP = 50
export const NOTIFICATIONS_PER_USER_CAP = 50
export const NOTIFICATIONS_TTL_DAYS = 30
export const USER_ACTIVITIES_TTL_DAYS = 90
export const ASSISTANT_MESSAGES_PER_THREAD_CAP = 200
export const ASSISTANT_MESSAGES_TTL_DAYS = 90
export const SUPPORT_MESSAGES_PER_TICKET_CAP = 200
export const MARKETPLACE_MESSAGES_PER_THREAD_CAP = 200
export const LISTING_DRAFTS_PER_USER_CAP = 20
export const CARE_SCHEDULES_PER_PLANT_CAP = 20
export const RECORDINGS_BUCKET_NAME = 'recordings'

export function retentionCutoff(now: number, ttlDays: number): number {
  return now - ttlDays * 24 * 60 * 60 * 1000
}

export function overflowBeyondCap<T>(newestFirst: T[], cap: number): T[] {
  if (newestFirst.length <= cap) return []
  return newestFirst.slice(cap)
}

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

export const cleanupVideoRecordings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
    let batch
    do {
      batch = await ctx.db
        .query('videoRecordings')
        .withIndex('by_capturedAt', (q) => q.lte('capturedAt', cutoff))
        .take(500)
      for (const r of batch) {
        await ctx.scheduler.runAfter(0, internal.crons.deleteRecordingS3Object, { key: r.path })
        await ctx.db.delete(r._id)
      }
    } while (batch.length === 500)

    // Live sessions are tens of MB each: keep the newest 20 per device
    // even within the TTL window. Loop until the cap holds: a single pass
    // over take(500) cannot drain a device far past the cap.
    const devices = await ctx.db.query('devices').take(1000)
    for (const device of devices) {
      while (true) {
        const items = await ctx.db
          .query('videoRecordings')
          .withIndex('by_device', (q) => q.eq('deviceId', device._id))
          .order('desc')
          .take(500)
        if (items.length <= 20) break
        const overflow = overflowBeyondCap(items, 20)
        for (const r of overflow) {
          await ctx.scheduler.runAfter(0, internal.crons.deleteRecordingS3Object, { key: r.path })
          await ctx.db.delete(r._id)
        }
        if (items.length < 500) break
      }
    }
  },
})

export const DEVICE_SNAPSHOTS_TTL_DAYS = 30

export const cleanupDeviceSnapshots = internalMutation({
  args: {},
  handler: async (ctx) => {
    // SnapshotId dedup rows would otherwise grow forever (~6k/day/device
    // at pods cadence). 30d outlives any realistic queue-drain redelivery
    // (offline dwell is flash-bound to hours/days, ack-loss redelivery to
    // the next POST seconds later).
    const cutoff = retentionCutoff(Date.now(), DEVICE_SNAPSHOTS_TTL_DAYS)
    let batch
    do {
      batch = await ctx.db
        .query('deviceSnapshots')
        .withIndex('by_receivedAt', (q) => q.lte('receivedAt', cutoff))
        .take(500)
      for (const s of batch) {
        await ctx.db.delete(s._id)
      }
    } while (batch.length === 500)
  },
})

export const cleanupPlantImages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const plants = await ctx.db.query('plants').take(1000)
    for (const plant of plants) {
      let trimmed = 0
      do {
        const images = await ctx.db
          .query('plantImages')
          .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
          .order('desc')
          .take(500)
        const overflow = overflowBeyondCap(images, PLANT_IMAGES_PER_PLANT_CAP)
        for (const image of overflow) {
          await ctx.db.delete(image._id)
        }
        trimmed = overflow.length
      } while (trimmed === 450)
    }
  },
})

export const cleanupNotifications = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = retentionCutoff(Date.now(), NOTIFICATIONS_TTL_DAYS)
    let batch
    do {
      batch = await ctx.db
        .query('notifications')
        .withIndex('by_createdAt', (q) => q.lte('createdAt', cutoff))
        .take(500)
      for (const n of batch) {
        await ctx.db.delete(n._id)
      }
    } while (batch.length === 500)

    const users = await ctx.db.query('users').take(1000)
    for (const user of users) {
      let trimmed = 0
      do {
        const items = await ctx.db
          .query('notifications')
          .withIndex('by_user', (q) => q.eq('userId', user._id))
          .order('desc')
          .take(500)
        const overflow = overflowBeyondCap(items, NOTIFICATIONS_PER_USER_CAP)
        for (const item of overflow) {
          await ctx.db.delete(item._id)
        }
        trimmed = overflow.length
      } while (trimmed === 450)
    }
  },
})

export const cleanupUserActivities = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = retentionCutoff(Date.now(), USER_ACTIVITIES_TTL_DAYS)
    let batch
    do {
      batch = await ctx.db
        .query('userActivities')
        .withIndex('by_createdAt', (q) => q.lte('createdAt', cutoff))
        .take(500)
      for (const a of batch) {
        await ctx.db.delete(a._id)
      }
    } while (batch.length === 500)
  },
})

export const cleanupAssistantMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = retentionCutoff(Date.now(), ASSISTANT_MESSAGES_TTL_DAYS)
    const threads = await ctx.db.query('assistantThreads').take(1000)
    for (const thread of threads) {
      // 90-day TTL per thread (no plain by_createdAt index — scope by thread).
      let batch
      do {
        batch = await ctx.db
          .query('assistantMessages')
          .withIndex('by_createdAt', (q) =>
            q.eq('threadId', thread._id).lte('createdAt', cutoff),
          )
          .take(500)
        for (const m of batch) {
          await ctx.db.delete(m._id)
        }
      } while (batch.length === 500)

      // 200/thread hard cap, trim oldest.
      let trimmed = 0
      do {
        const items = await ctx.db
          .query('assistantMessages')
          .withIndex('by_createdAt', (q) => q.eq('threadId', thread._id))
          .order('desc')
          .take(500)
        const overflow = overflowBeyondCap(items, ASSISTANT_MESSAGES_PER_THREAD_CAP)
        for (const item of overflow) {
          await ctx.db.delete(item._id)
        }
        trimmed = overflow.length
      } while (trimmed === 500 - ASSISTANT_MESSAGES_PER_THREAD_CAP)
    }
  },
})

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hmacBytes(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(key as ArrayBuffer)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data))
}

export function encodeS3Key(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

export const S3_SKIP_WARNING_TITLE =
  'system-warning: kredensial S3 tidak dikonfigurasi, penghapusan objek rekaman dilewati'

export function s3SkipWarningDayStart(now: number): number {
  const day = new Date(now)
  day.setUTCHours(0, 0, 0, 0)
  return day.getTime()
}

export const recordS3SkipWarning = internalMutation({
  args: { key: v.string(), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now()
    const dayStart = s3SkipWarningDayStart(now)
    // Existence check only: bounded take, not a full-day collect.
    const candidates = await ctx.db
      .query('growEvents')
      .withIndex('by_eventType_and_timestamp', (q) =>
        q.eq('eventType', 'automation_action_executed').gte('timestamp', dayStart),
      )
      .take(500)
    const alreadyWarned = candidates.some(
      (event) => event.title === S3_SKIP_WARNING_TITLE && event.timestamp >= dayStart,
    )
    if (alreadyWarned) return { recorded: false, deduped: true }
    await ctx.db.insert('growEvents', {
      source: 'system',
      entityType: 'automation',
      eventType: 'automation_action_executed',
      title: S3_SKIP_WARNING_TITLE,
      detail: `Melewatkan penghapusan objek S3 untuk rekaman "${args.key}". Baris DB dihapus tetapi objek dapat tersisa di bucket "${RECORDINGS_BUCKET_NAME}". Atur MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY.`,
      data: { key: args.key },
      timestamp: now,
    })
    return { recorded: true, deduped: false }
  },
})

export const deleteRecordingS3Object = internalAction({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const endpoint = process.env.MINIO_ENDPOINT
    const accessKeyId = process.env.MINIO_ACCESS_KEY
    const secretAccessKey = process.env.MINIO_SECRET_KEY
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      console.warn('[crons] S3 credentials not configured; skipping object delete for', args.key)
      try {
        await ctx.runMutation(internal.crons.recordS3SkipWarning, { key: args.key })
      } catch (error) {
        console.error('[crons] Failed to record S3 skip warning:', error)
      }
      return { success: false, skipped: true }
    }

    const region = process.env.S3_REGION ?? 'us-east-1'
    const base = endpoint.replace(/\/$/, '')
    const url = new URL(`${base}/${RECORDINGS_BUCKET_NAME}/${encodeS3Key(args.key)}`)
    const now = new Date()
    const pad = (n: number, len = 2) => String(n).padStart(len, '0')
    const dateStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}`
    const amzDate = `${dateStamp}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
    const payloadHash = await sha256Hex('')
    const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
    const canonicalRequest = [
      'DELETE',
      url.pathname,
      url.searchParams.toString(),
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n')
    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join('\n')

    const kDate = await hmacBytes(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp)
    const kRegion = await hmacBytes(kDate, region)
    const kService = await hmacBytes(kRegion, 's3')
    const kSigning = await hmacBytes(kService, 'aws4_request')
    const signatureBuffer = await hmacBytes(kSigning, stringToSign)
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    const response = await fetch(url.toString(), {
      method: 'DELETE',
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-date': amzDate,
        'x-amz-content-sha256': payloadHash,
      },
    })

    if (response.status === 200 || response.status === 204 || response.status === 404) {
      return { success: true, skipped: false }
    }

    const body = await response.text().catch(() => '')
    console.error(
      `[crons] Failed to delete S3 object ${args.key}: ${response.status} ${body.slice(0, 200)}`,
    )
    return { success: false, skipped: false }
  },
})

export default crons
