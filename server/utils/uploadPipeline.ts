import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { processImage, generateHash } from '~~/server/utils/images'
import { uploadFile, s3Client } from '~~/server/utils/storage'

export const IMAGE_SIZES = [50, 200, 400, 800, 1200]
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024
export const IMAGE_BUCKET = process.env.MINIO_BUCKET_IMAGE ?? 'images'

export interface UploadPipelineOptions {
  bucket?: string
  keyPrefix?: string
}

export interface UploadPipelineResult {
  path: string
  keys: string[]
}

/**
 * Single shared image-upload pipeline: size-check → hash → process
 * variants → upload. Used by both the raw-body device route
 * (camera.post.ts) and the multipart user route (upload.post.ts).
 * Entry-specific concerns (auth, body parsing, content-type error
 * messages) stay in the routes; everything from the validated
 * Buffer onward lives here exactly once.
 */
export async function runUploadPipeline(
  buffer: Buffer,
  opts: UploadPipelineOptions = {},
): Promise<UploadPipelineResult> {
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Image too large (max 20MB)' })
  }

  const bucket = opts.bucket ?? IMAGE_BUCKET
  const path = opts.keyPrefix ?? generateHash(buffer)
  const images = await processImage(buffer, IMAGE_SIZES)

  const uploadedKeys: string[] = []
  try {
    for (const image of images) {
      const key = `${path}/${image.size}w.webp`
      await uploadFile(bucket, key, image.buffer, 'image/webp', {
        publicRead: true,
      })
      uploadedKeys.push(key)
    }
  } catch (error) {
    // Best-effort rollback: a mid-pipeline throw would otherwise leave
    // orphan images/*w.webp variants with no DB row pointing at them.
    // No background GC exists (out of scope) — this inline cleanup is the
    // only orphan protection.
    if (uploadedKeys.length > 0) {
      await Promise.allSettled(
        uploadedKeys.map((Key) =>
          s3Client().send(new DeleteObjectCommand({ Bucket: bucket, Key })),
        ),
      )
    }
    throw error
  }

  return { path, keys: images.map((image) => `${path}/${image.size}w.webp`) }
}
