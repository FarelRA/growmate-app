import { tryUseNuxtApp, useRuntimeConfig } from '#app'

export function getImageUrl(path?: string | null, size = 400) {
  if (!path) return null
  const nuxt = tryUseNuxtApp()
  const { imageBaseUrl, minioBucketImage } = nuxt
    ? useRuntimeConfig().public
    : {
        imageBaseUrl: process.env.NUXT_PUBLIC_MINIO_BASE_URL ?? 'https://storage.growmate.bond',
        minioBucketImage: process.env.NUXT_PUBLIC_MINIO_BUCKET_IMAGE ?? 'images',
      }
  return `${imageBaseUrl}/${minioBucketImage}/${path}/${size}w.webp`
}
