export function toOptimizedImageUrl(
  src?: string | null,
  options?: { width?: number; height?: number; quality?: number },
) {
  if (!src) return null

  const params = new URLSearchParams({ src })
  if (options?.width) params.set('w', String(options.width))
  if (options?.height) params.set('h', String(options.height))
  if (options?.quality) params.set('q', String(options.quality))

  return `/img?${params.toString()}`
}
