import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import { ingestVideoBytes, VIDEO_MAX_SESSION_SEC } from '~~/server/utils/videoLive'

/**
 * POST /api/v1/video/live — tech MJPEG chunked ingest.
 * Headers: Authorization (Bearer) + X-Device-Id + X-Video-Id,
 * Content-Type: multipart/x-mixed-replace; boundary=frame.
 * Answers 200 {frames} when the stream closes (device rule).
 */
export default defineEventHandler(async (event) => {
  requireDeviceKey(event)

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

  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (!settled) {
        settled = true
        resolve()
      }
    }
    nodeReq.on('data', (chunk: Buffer) => {
      bytes += chunk.length
      if (Date.now() - startedAt > VIDEO_MAX_SESSION_SEC * 1000) return
      const res = ingestVideoBytes(deviceId, videoId, Buffer.from(chunk), seq)
      seq = res.nextSeq
      frames += res.frames
    })
    nodeReq.on('end', done)
    nodeReq.on('close', done)
    nodeReq.on('error', done)
  })

  return { ok: true, frames, bytes }
})
