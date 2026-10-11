import { api } from '~~/convex/_generated/api'
import { useConvexAuth } from '~~/server/utils/convex'
import { getLatestFrame } from '~~/server/utils/videoLive'

/**
 * GET /api/v1/video/latest/:deviceId(.jpg) — latest live frame for dashboards.
 * Same ownership check as the live fan-out.
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

  const latest = getLatestFrame(deviceId)
  if (!latest) {
    throw createError({ statusCode: 404, statusMessage: 'no live frame yet' })
  }

  const res = (event.node as unknown as { res: import('node:http').ServerResponse }).res
  res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-cache' })
  res.end(latest.jpg)
  return null
})
