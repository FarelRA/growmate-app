import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import { checkCameraRateLimit } from '~~/server/utils/deviceProtocol'
import { runUploadPipeline, deleteUploadedKeys, IMAGE_BUCKET } from '~~/server/utils/uploadPipeline'

// Firmware frame cap (tech 06-api §POST camera + 08 §7: reject bodies over
// ~1MB with 400; pods frames are 20-100KB so the same cap serves both).
export const MAX_DEVICE_FRAME_BYTES = 1024 * 1024

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
    if (contentLength !== undefined) {
      const parsedLength = Number(contentLength)
      if (!Number.isFinite(parsedLength) || parsedLength < 0) {
        throw createError({ statusCode: 400, statusMessage: 'invalid content-length' })
      }
      if (parsedLength > MAX_DEVICE_FRAME_BYTES) {
        throw createError({
          statusCode: 400,
          statusMessage: 'frame over 1MB',
        })
      }
    }

    const rawBody = await readRawBody(event)
    if (!rawBody || rawBody.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Image body is required' })
    }

    const input = Buffer.from(rawBody)
    if (input.length > MAX_DEVICE_FRAME_BYTES) {
      throw createError({
        statusCode: 400,
        statusMessage: 'frame over 1MB',
      })
    }

    checkCameraRateLimit(event, deviceId)

    const { path: pathPrefix, keys } = await runUploadPipeline(input)

    const convex = useConvex()
    try {
      await convex.mutation(api.sensors.ingestCameraImage, {
        deviceId,
        imageUrl: pathPrefix,
        capturedAt: Date.now(),
        deviceKey,
      })
    } catch (error: unknown) {
      await deleteUploadedKeys(IMAGE_BUCKET, keys)
      throw error
    }

    return { success: true, path: pathPrefix }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Camera image ingestion failed:', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
