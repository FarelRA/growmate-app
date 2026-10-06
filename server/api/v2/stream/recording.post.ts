import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'

export default defineEventHandler(async (event) => {
  const deviceKey = requireDeviceKey(event)

  const body = await readBody(event)

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
    deviceKey,
  })

  return { success: true }
})
