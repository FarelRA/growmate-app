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
  let capturedAt: number
  if (body.capturedAt === undefined || body.capturedAt === null) {
    capturedAt = Date.now()
  } else if (typeof body.capturedAt !== 'number' || !Number.isFinite(body.capturedAt)) {
    throw createError({ statusCode: 400, statusMessage: 'capturedAt must be a finite number' })
  } else {
    capturedAt = body.capturedAt
  }
  await convex.mutation(api.streams.recordStreamSegment, {
    deviceId: body.deviceId,
    fileName: body.fileName,
    path: body.path,
    size: body.size,
    durationMs: body.durationMs,
    capturedAt,
    deviceKey,
  })

  return { success: true }
})
