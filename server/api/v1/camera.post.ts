import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import { runUploadPipeline, MAX_IMAGE_BYTES } from '~~/server/utils/uploadPipeline'

export default defineEventHandler(async (event) => {
  try {
    const deviceKey = requireDeviceKey(event)

    const deviceId = getHeader(event, 'x-device-id')?.trim()
    if (!deviceId) {
      throw createError({ statusCode: 400, statusMessage: 'deviceId is required' })
    }

    const contentType = getHeader(event, 'content-type')?.trim() || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'content-type must be an image type',
      })
    }

    const contentLength = getHeader(event, 'content-length')
    if (contentLength && Number(contentLength) > MAX_IMAGE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: 'Image too large (max 20MB)',
      })
    }

    const rawBody = await readRawBody(event)
    if (!rawBody || rawBody.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Image body is required' })
    }

    const input = Buffer.from(rawBody)
    const { path: pathPrefix } = await runUploadPipeline(input)

    const convex = useConvex()
    await convex.mutation(api.sensors.ingestCameraImage, {
      deviceId,
      imageUrl: pathPrefix,
      capturedAt: Date.now(),
      deviceKey,
    })

    return { success: true, path: pathPrefix }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Camera image ingestion failed:', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
