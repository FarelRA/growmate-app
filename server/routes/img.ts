import sharp from 'sharp'

const MAX_WIDTH = 2200
const MAX_HEIGHT = 2200
const DEFAULT_QUALITY = 72

function parseDimension(value: string | undefined, max: number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined
  return Math.min(Math.round(parsed), max)
}

function parseQuality(value: string | undefined) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_QUALITY
  return Math.min(Math.max(Math.round(parsed), 40), 85)
}

function isAllowedImageUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && (
      parsed.hostname.endsWith('.convex.cloud') || parsed.hostname === 'growmate.bond'
    )
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const src = typeof query.src === 'string' ? query.src : ''

  if (!src || !isAllowedImageUrl(src)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image source' })
  }

  const width = parseDimension(typeof query.w === 'string' ? query.w : undefined, MAX_WIDTH)
  const height = parseDimension(typeof query.h === 'string' ? query.h : undefined, MAX_HEIGHT)
  const quality = parseQuality(typeof query.q === 'string' ? query.q : undefined)

  const response = await fetch(src)
  if (!response.ok) {
    throw createError({ statusCode: response.status, statusMessage: 'Image fetch failed' })
  }

  const input = Buffer.from(await response.arrayBuffer())
  const output = await sharp(input)
    .rotate()
    .resize({
      width,
      height,
      fit: 'cover',
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer()

  setHeader(event, 'content-type', 'image/webp')
  setHeader(event, 'cache-control', 'public, max-age=31536000, s-maxage=31536000, immutable')
  return output
})
