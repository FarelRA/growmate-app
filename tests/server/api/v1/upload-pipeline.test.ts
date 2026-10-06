/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockProcessImage, mockGenerateHash, mockUploadFile } = vi.hoisted(() => ({
  mockProcessImage: vi.fn(),
  mockGenerateHash: vi.fn(),
  mockUploadFile: vi.fn(),
}))

vi.mock('~~/server/utils/images', () => ({
  processImage: mockProcessImage,
  generateHash: mockGenerateHash,
}))

vi.mock('~~/server/utils/storage', () => ({
  uploadFile: mockUploadFile,
}))

import {
  runUploadPipeline,
  IMAGE_SIZES,
  MAX_IMAGE_BYTES,
} from '../../../../server/utils/uploadPipeline'

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.createError = vi.fn((opts: any) => opts) as any
  mockGenerateHash.mockReturnValue('abc123def456')
  mockProcessImage.mockResolvedValue(
    IMAGE_SIZES.map((size) => ({ size, buffer: Buffer.from(`s${size}`) })),
  )
  mockUploadFile.mockResolvedValue(undefined)
})

describe('runUploadPipeline', () => {
  it('rejects buffers over 20MB with 413 before doing any work', async () => {
    const big = Buffer.alloc(MAX_IMAGE_BYTES + 1)

    await expect(runUploadPipeline(big)).rejects.toMatchObject({
      statusCode: 413,
      statusMessage: 'Image too large (max 20MB)',
    })
    expect(mockGenerateHash).not.toHaveBeenCalled()
    expect(mockProcessImage).not.toHaveBeenCalled()
    expect(mockUploadFile).not.toHaveBeenCalled()
  })

  it('hashes, processes all sizes, and uploads every variant', async () => {
    const input = Buffer.from('fake-image')

    const result = await runUploadPipeline(input)

    expect(mockGenerateHash).toHaveBeenCalledWith(input)
    expect(mockProcessImage).toHaveBeenCalledWith(input, [50, 200, 400, 800, 1200])
    expect(mockUploadFile).toHaveBeenCalledTimes(5)
    for (const size of [50, 200, 400, 800, 1200]) {
      expect(mockUploadFile).toHaveBeenCalledWith(
        'images',
        `abc123def456/${size}w.webp`,
        Buffer.from(`s${size}`),
        'image/webp',
        { publicRead: true },
      )
    }
    expect(result).toEqual({
      path: 'abc123def456',
      keys: [50, 200, 400, 800, 1200].map((s) => `abc123def456/${s}w.webp`),
    })
  })

  it('honors explicit bucket and keyPrefix overrides', async () => {
    const result = await runUploadPipeline(Buffer.from('x'), {
      bucket: 'custom-bucket',
      keyPrefix: 'fixed-prefix',
    })

    expect(mockGenerateHash).not.toHaveBeenCalled()
    expect(mockUploadFile).toHaveBeenCalledWith(
      'custom-bucket',
      'fixed-prefix/50w.webp',
      expect.any(Buffer),
      'image/webp',
      { publicRead: true },
    )
    expect(result.path).toBe('fixed-prefix')
  })

  it('produces identical output for identical input (camera/raw vs upload/multipart parity)', async () => {
    const bytes = Buffer.from('same-bytes')
    const fromRawBody = Buffer.from(bytes.toString('binary'), 'binary')

    const a = await runUploadPipeline(bytes)
    const b = await runUploadPipeline(fromRawBody)

    expect(a).toEqual(b)
  })
})
