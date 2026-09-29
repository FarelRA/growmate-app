import { tryUseNuxtApp, useRuntimeConfig } from '#app'
import { buildImageUrl, DEFAULT_IMAGE_BASE_URL, DEFAULT_IMAGE_BUCKET } from '~~/shared/utils/images'

export function getImageUrl(path?: string | null, size = 400) {
  if (!path) return null
  const nuxt = tryUseNuxtApp()
  const { imageBaseUrl, minioBucketImage } = nuxt
    ? useRuntimeConfig().public
    : {
        imageBaseUrl: process.env.NUXT_PUBLIC_MINIO_BASE_URL ?? DEFAULT_IMAGE_BASE_URL,
        minioBucketImage: process.env.NUXT_PUBLIC_MINIO_BUCKET_IMAGE ?? DEFAULT_IMAGE_BUCKET,
      }
  return buildImageUrl(path, size, imageBaseUrl, minioBucketImage)
}
