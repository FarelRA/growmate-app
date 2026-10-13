import { promises as fs } from 'node:fs'
import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import { uploadFile } from '~~/server/utils/storage'
import { RECORDINGS_BUCKET } from '~~/server/utils/storage'
import {
  ingestVideoBytes,
  startLiveSession,
  appendLiveBytes,
  endLiveSession,
  discardLiveSpool,
  VIDEO_CONTENT_TYPE,
  VIDEO_MAX_SESSION_SEC,
} from '~~/server/utils/videoLive'

import { defineFirmwareHandler } from '~~/server/utils/firmwareRoute'

/**
 * POST /v1/video/live — tech MJPEG chunked ingest.
 * Headers: Authorization (Bearer) + X-Device-Id + X-Video-Id,
 * Content-Type: multipart/x-mixed-replace; boundary=frame.
 * Answers 200 {frames} when the stream closes (device rule). The completed
 * session is also stored as one multipart `.mjpeg` recording (private
 * `recordings` bucket + videoRecordings row) so users can replay history;
 * a failed recording never fails the ingest itself.
 * This is the only implementation; the old /api/v1/* route is deleted.
 */
export default defineFirmwareHandler(async (event) => {
  try {
    const deviceKey = requireDeviceKey(event)

    const deviceId = getHeader(event, 'x-device-id')?.trim()
    const videoId = getHeader(event, 'x-video-id')?.trim()
    if (!deviceId) {
      throw createError({ statusCode: 400, statusMessage: 'X-Device-Id is required' })
    }
    if (!videoId) {
      throw createError({ statusCode: 400, statusMessage: 'X-Video-Id is required' })
    }
    const contentType = getHeader(event, 'content-type') ?? ''
    if (!contentType.includes('multipart') || !contentType.includes('mixed-replace')) {
      throw createError({ statusCode: 400, statusMessage: 'want multipart/x-mixed-replace' })
    }

    const nodeReq = (event.node as unknown as { req: import('node:http').IncomingMessage }).req
    const startedAt = Date.now()
    let seq = 0
    let frames = 0
    let bytes = 0

    await startLiveSession(deviceId, videoId)
    await new Promise<void>((resolve) => {
      let settled = false
      const done = () => {
        if (!settled) {
          settled = true
          resolve()
        }
      }
      nodeReq.on('data', (chunk: Buffer) => {
        const buf = Buffer.from(chunk)
        bytes += buf.length
        if (Date.now() - startedAt > VIDEO_MAX_SESSION_SEC * 1000) return
        const res = ingestVideoBytes(deviceId, videoId, buf, seq)
        seq = res.nextSeq
        frames += res.frames
        appendLiveBytes(deviceId, buf)
      })
      nodeReq.on('end', done)
      nodeReq.on('close', done)
      nodeReq.on('error', done)
    })

    const session = await endLiveSession(deviceId)
    let recording: string | null = null
    if (session && frames > 0 && session.bytes > 0) {
      const safeVideoId = videoId.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 48)
      const fileName = `${safeVideoId}.mjpeg`
      const key = `${deviceId}/live/${fileName}`
      try {
        const body = await fs.readFile(session.path)
        await uploadFile(RECORDINGS_BUCKET, key, body, VIDEO_CONTENT_TYPE, { publicRead: false })
        const convex = useConvex()
        await convex.mutation(api.streams.recordLiveSession, {
          deviceKey,
          deviceId,
          fileName,
          path: key,
          size: body.length,
          durationMs: session.durationMs,
          capturedAt: session.startedAt,
        })
        recording = key
      } catch (error) {
        console.error(`Live session recording failed for ${deviceId}:`, error)
      } finally {
        await discardLiveSpool(session.path)
      }
    } else if (session) {
      await discardLiveSpool(session.path)
    }

    return { ok: true, frames, bytes, recording }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    // The firmware boundary logs with the request id and serializes JSON.
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
