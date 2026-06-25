import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'

const DEVICE_API_KEY = process.env.DEVICE_API_KEY

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const apiKey = getHeader(event, 'x-api-key')
  if (DEVICE_API_KEY && apiKey !== DEVICE_API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!body.deviceId || !body.fileName || !body.path || !body.size) {
    throw createError({ statusCode: 400, statusMessage: 'deviceId, fileName, path, and size are required' })
  }

  const convex = useConvex()
  await convex.mutation(api.streams.recordStreamSegment, {
    deviceId: body.deviceId,
    fileName: body.fileName,
    path: body.path,
    size: body.size,
    durationMs: body.durationMs,
    capturedAt: body.capturedAt,
  })

  return { success: true }
})
