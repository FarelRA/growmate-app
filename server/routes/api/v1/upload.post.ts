import { api } from '~~/convex/_generated/api'
import { useConvexAuth } from '~~/server/utils/convex'
import { processImage, generateHash } from '~~/server/utils/images'
import { uploadFile } from '~~/server/utils/storage'

const IMAGE_BUCKET = process.env.MINIO_BUCKET_IMAGE ?? 'images'
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const token = authHeader.slice(7)

    const convex = useConvexAuth(token)
    let isAuthenticated = false
    try {
      isAuthenticated = await convex.query(api.auth.isAuthenticated, {})
    } catch {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    if (!isAuthenticated) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const parts = await readMultipartFormData(event)
    if (!parts || parts.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    }

    const file = parts.find((p) => p.name === 'file' && p.data && p.data.length > 0)
    if (!file) {
      throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    }

    if (!file.type?.startsWith('image/')) {
      throw createError({ statusCode: 400, statusMessage: 'File must be an image' })
    }

    if (file.data.length > MAX_IMAGE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Image too large (max 20MB)' })
    }

    const input = file.data
    const hash = generateHash(input)
    const pathPrefix = hash

    const sizes = [50, 200, 400, 800, 1200]
    const images = await processImage(input, sizes)

    for (const image of images) {
      await uploadFile(IMAGE_BUCKET, `${pathPrefix}/${image.size}w.webp`, image.buffer, 'image/webp')
    }

    return { path: pathPrefix }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Image upload failed:', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
