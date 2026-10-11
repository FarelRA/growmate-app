/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockProcessImage,
  mockGenerateHash,
  mockUploadFile,
  mockS3Send,
  mockS3Client,
  MockDeleteObjectCommand,
} = vi.hoisted(() => ({
  mockProcessImage: vi.fn(),
  mockGenerateHash: vi.fn(),
  mockUploadFile: vi.fn(),
  mockS3Send: vi.fn(),
  mockS3Client: vi.fn(),
  MockDeleteObjectCommand: vi.fn(function (this: any, input: any) {
    ;(this as any).input = input
  }),
}))

vi.mock('~~/server/utils/images', () => ({
  processImage: mockProcessImage,
  generateHash: mockGenerateHash,
}))

vi.mock('~~/server/utils/storage', () => ({
  uploadFile: mockUploadFile,
  s3Client: mockS3Client,
}))

vi.mock('@aws-sdk/client-s3', () => ({
  DeleteObjectCommand: MockDeleteObjectCommand,
}))

import { runUploadPipeline, IMAGE_SIZES } from '../../../../server/utils/uploadPipeline'

beforeEach(() => {
  vi.clearAllMocks()
  ;(globalThis as any).createError = vi.fn((opts: any) => opts) as any
  ;(globalThis as any).getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  ;(globalThis as any).readBody = vi.fn() as any
  mockGenerateHash.mockReturnValue('orphan-hash')
  mockProcessImage.mockResolvedValue(
    IMAGE_SIZES.map((size) => ({ size, buffer: Buffer.from(`s${size}`) })),
  )
  mockUploadFile.mockResolvedValue(undefined)
  mockS3Send.mockResolvedValue(undefined)
  mockS3Client.mockReturnValue({ send: mockS3Send })
})

describe('runUploadPipeline orphan rollback', () => {
  it('mid-loop failure deletes prior keys then rethrows', async () => {
    const boom = new Error('mid-pipeline boom')
    mockUploadFile
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(boom)

    await expect(runUploadPipeline(Buffer.from('img'))).rejects.toBe(boom)

    expect(mockUploadFile).toHaveBeenCalledTimes(3)
    // Two prior PUTs must be rolled back best-effort.
    expect(mockS3Client).toHaveBeenCalled()
    expect(mockS3Send).toHaveBeenCalledTimes(2)
    expect(MockDeleteObjectCommand).toHaveBeenCalledTimes(2)
    expect(MockDeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'images',
      Key: 'orphan-hash/50w.webp',
    })
    expect(MockDeleteObjectCommand).toHaveBeenCalledWith({
      Bucket: 'images',
      Key: 'orphan-hash/200w.webp',
    })
  })

  it('first-PUT failure deletes nothing then rethrows', async () => {
    const boom = new Error('first PUT failed')
    mockUploadFile.mockRejectedValueOnce(boom)

    await expect(runUploadPipeline(Buffer.from('img'))).rejects.toBe(boom)

    expect(mockUploadFile).toHaveBeenCalledTimes(1)
    expect(mockS3Send).not.toHaveBeenCalled()
  })

  it('cleanup is best-effort: delete failures do not mask the original error', async () => {
    const boom = new Error('upload failed')
    mockUploadFile.mockResolvedValueOnce(undefined).mockRejectedValueOnce(boom)
    mockS3Send.mockRejectedValueOnce(new Error('delete failed'))

    await expect(runUploadPipeline(Buffer.from('img'))).rejects.toBe(boom)
    expect(mockS3Send).toHaveBeenCalledTimes(1)
  })

  it('success path uploads all variants and never deletes', async () => {
    const result = await runUploadPipeline(Buffer.from('img'))

    expect(mockUploadFile).toHaveBeenCalledTimes(5)
    expect(mockS3Send).not.toHaveBeenCalled()
    expect(result.keys).toHaveLength(5)
  })
})
