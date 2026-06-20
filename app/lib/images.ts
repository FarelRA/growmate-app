export function getImageUrl(path?: string | null, size = 400) {
  if (!path) return null
  const { imageBaseUrl, minioBucketImage } = useRuntimeConfig().public
  const label = size === 0 ? 'original' : `${size}w`
  return `${imageBaseUrl}/${minioBucketImage}/${path}/${label}.webp`
}
