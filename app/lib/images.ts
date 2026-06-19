export function getImageUrl(path?: string | null, size = 400) {
  if (!path) return null
  const baseUrl = useRuntimeConfig().public.imageBaseUrl
  const label = size === 0 ? 'original' : `${size}w`
  return `${baseUrl}/${path}/${label}.webp`
}
