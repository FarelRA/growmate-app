import { createHash } from 'node:crypto'
import sharp from 'sharp'

export interface ProcessedImage {
  size: number
  buffer: Buffer
}

export async function processImage(
  input: Buffer,
  sizes: number[],
): Promise<ProcessedImage[]> {
  const metadata = await sharp(input).metadata()
  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image data: unable to read dimensions')
  }

  const results: ProcessedImage[] = []

  for (const size of sizes) {
    const buffer = await sharp(input)
      .clone()
      .resize(size, undefined, {
        withoutEnlargement: true,
        fit: 'cover',
      })
      .webp({ quality: 80 })
      .toBuffer()
    results.push({ size, buffer })
  }

  return results
}

export function generateHash(input: Buffer): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}
