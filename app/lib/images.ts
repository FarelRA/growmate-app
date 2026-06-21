export function getImageUrl(path?: string | null, size = 400) {
  if (!path) return null
  const { imageBaseUrl, minioBucketImage } = useRuntimeConfig().public
  return `${imageBaseUrl}/${minioBucketImage}/${path}/${size}w.webp`
}
