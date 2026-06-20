import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { processImage, generateHash } from '~~/server/utils/images'
import { uploadFile } from '~~/server/utils/storage'

const DEVICE_API_KEY = process.env.DEVICE_API_KEY
const IMAGE_BUCKET = process.env.MINIO_BUCKET_IMAGE ?? 'images'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  try {
    const apiKey = getHeader(event, 'x-api-key')
    if (DEVICE_API_KEY && apiKey !== DEVICE_API_KEY) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

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

    if (rawBody.length > MAX_IMAGE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Image too large (max 20MB)' })
    }

    const input = Buffer.from(rawBody)
    const hash = generateHash(input)
    const pathPrefix = hash

    const sizes = [50, 200, 400, 800, 1200]
    const images = await processImage(input, sizes)

    for (const image of images) {
      const key =
        image.size === 'original'
          ? `${pathPrefix}/original.webp`
          : `${pathPrefix}/${image.size}w.webp`
      await uploadFile(IMAGE_BUCKET, key, image.buffer, 'image/webp')
    }

    const convex = useConvex()
    await convex.mutation(api.sensors.ingestCameraImage, {
      deviceId,
      imageUrl: pathPrefix,
      capturedAt: Date.now(),
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
