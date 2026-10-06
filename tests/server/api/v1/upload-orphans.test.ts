/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  mockProcessImage,
  mockGenerateHash,
  mockUploadFile,
  mockS3Send,
  mockS3Client,
  mockMutation,
  MockDeleteObjectCommand,
} = vi.hoisted(() => ({
  mockProcessImage: vi.fn(),
  mockGenerateHash: vi.fn(),
  mockUploadFile: vi.fn(),
  mockS3Send: vi.fn(),
  mockS3Client: vi.fn(),
  mockMutation: vi.fn(),
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

vi.mock('~~/convex/_generated/api', () => ({
  api: { streams: { recordStreamSegment: 'recordStreamSegment' } },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({ mutation: mockMutation }),
}))

import { runUploadPipeline, IMAGE_SIZES } from '../../../../server/utils/uploadPipeline'

const RECORDING_SRC = '../../../../server/api/v2/stream/recording.post'

function recordingEvent(apiKey?: string) {
  const event: any = { headers: new Headers() }
  if (apiKey !== undefined) event.headers.set('x-api-key', apiKey)
  return event
}

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
  mockMutation.mockResolvedValue({ success: true })
})

afterEach(() => {
  delete process.env.DEVICE_API_KEY
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

describe('POST /api/v2/stream/recording.post capturedAt', () => {
  async function loadHandler() {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    return (await import(RECORDING_SRC)).default
  }

  const baseBody = {
    deviceId: 'dev-1',
    fileName: 'a.h264',
    path: 'dev-1/stream/a.h264',
    size: 10,
  }

  it('defaults capturedAt to Date.now() when omitted', async () => {
    const handler = await loadHandler()
    const before = Date.now()
    ;(globalThis as any).readBody = vi.fn().mockResolvedValue({ ...baseBody })

    const result = await handler(recordingEvent('test-key'))

    expect(result).toEqual({ success: true })
    expect(mockMutation).toHaveBeenCalledTimes(1)
    const args = mockMutation.mock.calls[0][1]
    expect(typeof args.capturedAt).toBe('number')
    expect(args.capturedAt).toBeGreaterThanOrEqual(before)
    expect(args.capturedAt).toBeLessThanOrEqual(Date.now())
  })

  it('passes through an explicit finite capturedAt', async () => {
    const handler = await loadHandler()
    ;(globalThis as any).readBody = vi
      .fn()
      .mockResolvedValue({ ...baseBody, capturedAt: 1700000000000 })

    await handler(recordingEvent('test-key'))

    expect(mockMutation).toHaveBeenCalledWith(
      'recordStreamSegment',
      expect.objectContaining({ capturedAt: 1700000000000 }),
    )
  })

  it.each([NaN, Infinity, -Infinity, '123', true, {}])(
    'rejects non-finite/non-number capturedAt %p with 400',
    async (capturedAt) => {
      const handler = await loadHandler()
      ;(globalThis as any).readBody = vi
        .fn()
        .mockResolvedValue({ ...baseBody, capturedAt })

      await expect(handler(recordingEvent('test-key'))).rejects.toMatchObject({
        statusCode: 400,
      })
      expect(mockMutation).not.toHaveBeenCalled()
    },
  )
})
