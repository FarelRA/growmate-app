import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockChain = vi.hoisted(() => ({
  metadata: vi.fn().mockResolvedValue({ width: 100, height: 200 }),
  clone: vi.fn().mockReturnThis(),
  resize: vi.fn().mockReturnThis(),
  webp: vi.fn().mockReturnThis(),
  toBuffer: vi.fn().mockResolvedValue(Buffer.from('webp-data')),
}))

vi.mock('sharp', () => ({
  default: vi.fn(() => mockChain),
}))

import { processImage, generateHash } from '../../../../server/utils/images'

describe('processImage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resizes images to all given sizes', async () => {
    const input = Buffer.from('fake-image-data')
    const sizes = [50, 200]

    const results = await processImage(input, sizes)

    expect(results).toHaveLength(2)
    expect(results[0].size).toBe(50)
    expect(results[1].size).toBe(200)
    expect(mockChain.resize).toHaveBeenCalledTimes(2)
    expect(mockChain.webp).toHaveBeenCalledTimes(2)
    expect(mockChain.toBuffer).toHaveBeenCalledTimes(2)
  })

  it('uses withoutEnlargement and cover fit for resize', async () => {
    const input = Buffer.from('fake-image-data')

    await processImage(input, [100])

    expect(mockChain.resize).toHaveBeenCalledWith(100, undefined, {
      withoutEnlargement: true,
      fit: 'cover',
    })
  })

  it('sets webp quality 80 for resized variants', async () => {
    const input = Buffer.from('fake-image-data')

    await processImage(input, [50])

    expect(mockChain.webp).toHaveBeenCalledWith({ quality: 80 })
  })

  it('reads metadata from input', async () => {
    const input = Buffer.from('fake-image-data')

    await processImage(input, [50])

    expect(mockChain.metadata).toHaveBeenCalledTimes(1)
  })

  it('throws when metadata has no width or height', async () => {
    mockChain.metadata.mockResolvedValueOnce({})

    await expect(processImage(Buffer.from('bad'), [50])).rejects.toThrow(
      'Invalid image data',
    )
  })

  it('throws when metadata has width but no height', async () => {
    mockChain.metadata.mockResolvedValueOnce({ width: 100 })

    await expect(processImage(Buffer.from('bad'), [50])).rejects.toThrow(
      'Invalid image data',
    )
  })

  it('handles single size array', async () => {
    const results = await processImage(Buffer.from('img'), [400])

    expect(results).toHaveLength(1)
    expect(results[0].size).toBe(400)
  })

  it('handles empty sizes array', async () => {
    const results = await processImage(Buffer.from('img'), [])

    expect(results).toHaveLength(0)
  })
})

describe('generateHash', () => {
  it('returns first 16 chars of sha256 hex digest', () => {
    const hash = generateHash(Buffer.from('hello'))
    expect(hash).toBe('2cf24dba5fb0a30e')
    expect(hash).toHaveLength(16)
  })

  it('returns consistent hash for same input', () => {
    const a = generateHash(Buffer.from('test'))
    const b = generateHash(Buffer.from('test'))
    expect(a).toBe(b)
  })

  it('returns different hash for different inputs', () => {
    const a = generateHash(Buffer.from('foo'))
    const b = generateHash(Buffer.from('bar'))
    expect(a).not.toBe(b)
  })

  it('handles empty buffer', () => {
    const hash = generateHash(Buffer.alloc(0))
    expect(hash).toHaveLength(16)
    expect(typeof hash).toBe('string')
  })
})
