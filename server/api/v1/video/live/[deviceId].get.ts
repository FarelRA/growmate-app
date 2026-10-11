import { api } from '~~/convex/_generated/api'
import { useConvexAuth } from '~~/server/utils/convex'
import { getLatestFrame, subscribeFrames, VIDEO_BOUNDARY } from '~~/server/utils/videoLive'

/**
 * GET /api/v1/video/live/:deviceId — multipart fan-out for live viewers.
 * Auth mirrors the v2 live relay: ?token=<Convex JWT> + ownership check.
 * Plain <img> renders it, no player code (device docs 06-api).
 */
export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, 'deviceId') ?? ''
  const deviceId = rawId.replace(/\.jpg$/i, '')
  if (!deviceId) {
    throw createError({ statusCode: 400, statusMessage: 'deviceId is required' })
  }

  const token = getQuery(event).token
  if (typeof token !== 'string' || token.length === 0) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const convex = useConvexAuth(token)
  const owned = await convex.query(api.streams.getOwnedDevice, { deviceId }).catch(() => null)
  if (!owned) {
    throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  }

  const res = (event.node as unknown as { res: import('node:http').ServerResponse }).res
  res.writeHead(200, {
    'Content-Type': `multipart/x-mixed-replace; boundary=${VIDEO_BOUNDARY}`,
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const latest = getLatestFrame(deviceId)
  if (latest) {
    res.write(`--${VIDEO_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${latest.jpg.length}\r\n\r\n`)
    res.write(latest.jpg)
    res.write('\r\n')
  }

  await new Promise<void>((resolve) => {
    const req = (event.node as unknown as { req: import('node:http').IncomingMessage }).req
    const push = (frame: { jpg: Buffer }) => {
      try {
        res.write(`--${VIDEO_BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.jpg.length}\r\n\r\n`)
        res.write(frame.jpg)
        res.write('\r\n')
      } catch {
        cleanup()
      }
    }
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\r\n\r\n')
      } catch {
        cleanup()
      }
    }, 25_000)
    const cleanup = () => {
      clearInterval(heartbeat)
      unsubscribe()
      resolve()
    }
    const unsubscribe = subscribeFrames(deviceId, push)
    req.on('close', cleanup)
  })

  return null
})
