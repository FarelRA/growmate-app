export const DEFAULT_IMAGE_BASE_URL = 'https://storage.growmate.bond'
export const DEFAULT_IMAGE_BUCKET = 'images'

export function buildImageUrl(path: string, size: number, baseUrl: string, bucket: string): string {
  return `${baseUrl}/${bucket}/${path}/${size}w.webp`
}
