import { tryUseNuxtApp, useRuntimeConfig } from '#app'
import { buildImageUrl, DEFAULT_IMAGE_BASE_URL, DEFAULT_IMAGE_BUCKET } from '~~/shared/utils/images'

export function getImageUrl(path?: string | null, size = 400) {
  if (!path) return null
  const nuxt = tryUseNuxtApp()
  const { imageBaseUrl, rustfsBucketImage } = nuxt
    ? useRuntimeConfig().public
    : {
        imageBaseUrl: process.env.NUXT_PUBLIC_RUSTFS_BASE_URL ?? DEFAULT_IMAGE_BASE_URL,
        rustfsBucketImage: process.env.NUXT_PUBLIC_RUSTFS_BUCKET_IMAGE ?? DEFAULT_IMAGE_BUCKET,
      }
  return buildImageUrl(path, size, imageBaseUrl, rustfsBucketImage)
}
