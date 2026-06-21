/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockMutation, mockProcessImage, mockGenerateHash, mockUploadFile } =
  vi.hoisted(() => ({
    mockMutation: vi.fn(),
    mockProcessImage: vi.fn(),
    mockGenerateHash: vi.fn(),
    mockUploadFile: vi.fn(),
  }))

vi.mock('~~/convex/_generated/api', () => ({
  api: { sensors: { ingestCameraImage: 'ingestCameraImage' } },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: vi.fn(() => ({ mutation: mockMutation })),
}))

vi.mock('~~/server/utils/images', () => ({
  processImage: mockProcessImage,
  generateHash: mockGenerateHash,
}))

vi.mock('~~/server/utils/storage', () => ({
  uploadFile: mockUploadFile,
}))

const SRC = '../../../../../server/routes/api/v1/camera.post'

function mockEvent() {
  return { headers: new Headers() }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  mockProcessImage.mockReset()
  mockGenerateHash.mockReset()
  mockUploadFile.mockReset()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  )
  globalThis.readRawBody = vi.fn()
  globalThis.readMultipartFormData = vi.fn()
})

describe('POST /api/v1/camera', () => {
  describe('authentication', () => {
    it('returns 401 when API key does not match', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'secret-key'
      const { default: cameraHandler } = await import(SRC)

      const event = mockEvent()
      event.headers.set('x-api-key', 'wrong-key')

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    })

    it('accepts request when DEVICE_API_KEY is unset', async () => {
      vi.resetModules()
      delete process.env.DEVICE_API_KEY
      const { default: cameraHandler } = await import(SRC)

      mockGenerateHash.mockReturnValue('hash123')
      mockProcessImage.mockResolvedValue([
        { size: 50, buffer: Buffer.from('s50') },
      ])
      mockUploadFile.mockResolvedValue(undefined)
      mockMutation.mockResolvedValue(undefined)
      globalThis.readRawBody = vi.fn().mockResolvedValue('fake-body')

      const event = mockEvent()
      event.headers.set('x-device-id', 'device-1')

      const result = await cameraHandler(event)
      expect(result).toEqual({ success: true, path: 'hash123' })
    })
  })

  describe('request validation', () => {
    let cameraHandler: any

    beforeEach(async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'valid-key'
      const mod = await import(SRC)
      cameraHandler = mod.default
    })

    it('returns 400 without x-device-id header', async () => {
      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'deviceId is required',
      })
    })

    it('returns 400 with empty device ID', async () => {
      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', '  ')

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'deviceId is required',
      })
    })

    it('returns 400 with non-image content type', async () => {
      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', 'device-1')
      event.headers.set('content-type', 'text/plain')

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'content-type must be an image type',
      })
    })

    it('returns 413 when content-length exceeds max', async () => {
      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', 'device-1')
      event.headers.set('content-type', 'image/jpeg')
      event.headers.set('content-length', String(30 * 1024 * 1024))

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 413,
        statusMessage: 'Image too large (max 20MB)',
      })
    })

    it('returns 400 when raw body is empty', async () => {
      globalThis.readRawBody = vi.fn().mockResolvedValue(undefined)

      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', 'device-1')
      event.headers.set('content-type', 'image/jpeg')

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Image body is required',
      })
    })

    it('returns 400 when raw body is empty string', async () => {
      globalThis.readRawBody = vi.fn().mockResolvedValue('')

      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', 'device-1')
      event.headers.set('content-type', 'image/jpeg')

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'Image body is required',
      })
    })

    it('returns 413 when raw body exceeds max size', async () => {
      globalThis.readRawBody = vi.fn().mockResolvedValue(
        Buffer.alloc(25 * 1024 * 1024).toString(),
      )

      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', 'device-1')
      event.headers.set('content-type', 'image/jpeg')

      await expect(cameraHandler(event)).rejects.toMatchObject({
        statusCode: 413,
        statusMessage: 'Image too large (max 20MB)',
      })
    })
  })

  describe('success path', () => {
    let cameraHandler: any

    beforeEach(async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'valid-key'
      const mod = await import(SRC)
      cameraHandler = mod.default

      mockGenerateHash.mockReturnValue('camera-hash-1234')
      mockProcessImage.mockResolvedValue([
        { size: 50, buffer: Buffer.from('s50') },
        { size: 200, buffer: Buffer.from('s200') },
        { size: 400, buffer: Buffer.from('s400') },
        { size: 800, buffer: Buffer.from('s800') },
        { size: 1200, buffer: Buffer.from('s1200') },
      ])
      mockUploadFile.mockResolvedValue(undefined)
      mockMutation.mockResolvedValue(undefined)
    })

    it('processes image, uploads variants, and ingests via convex', async () => {
      const rawBody = 'fake-image-bytes'
      globalThis.readRawBody = vi.fn().mockResolvedValue(rawBody)

      const before = Date.now()
      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', 'device-42')
      event.headers.set('content-type', 'image/jpeg')

      const result = await cameraHandler(event)

      expect(mockGenerateHash).toHaveBeenCalledWith(Buffer.from(rawBody))
      expect(mockProcessImage).toHaveBeenCalledWith(Buffer.from(rawBody), [50, 200, 400, 800, 1200])

      expect(mockUploadFile).toHaveBeenCalledTimes(5)
      expect(mockUploadFile).toHaveBeenCalledWith(
        'images',
        'camera-hash-1234/50w.webp',
        Buffer.from('s50'),
        'image/webp',
      )
      expect(mockUploadFile).toHaveBeenCalledWith(
        'images',
        'camera-hash-1234/200w.webp',
        Buffer.from('s200'),
        'image/webp',
      )
      expect(mockUploadFile).toHaveBeenCalledWith(
        'images',
        'camera-hash-1234/400w.webp',
        Buffer.from('s400'),
        'image/webp',
      )
      expect(mockUploadFile).toHaveBeenCalledWith(
        'images',
        'camera-hash-1234/800w.webp',
        Buffer.from('s800'),
        'image/webp',
      )
      expect(mockUploadFile).toHaveBeenCalledWith(
        'images',
        'camera-hash-1234/1200w.webp',
        Buffer.from('s1200'),
        'image/webp',
      )

      expect(mockMutation).toHaveBeenCalledWith(
        'ingestCameraImage',
        expect.objectContaining({
          deviceId: 'device-42',
          imageUrl: 'camera-hash-1234',
          capturedAt: expect.any(Number),
        }),
      )
      expect(mockMutation.mock.calls[0][1].capturedAt).toBeGreaterThanOrEqual(before)

      expect(result).toEqual({ success: true, path: 'camera-hash-1234' })
    })

    it('uses jpeg as default content-type', async () => {
      globalThis.readRawBody = vi.fn().mockResolvedValue('data')
      mockMutation.mockResolvedValue(undefined)

      const event = mockEvent()
      event.headers.set('x-api-key', 'valid-key')
      event.headers.set('x-device-id', 'device-1')

      await cameraHandler(event)

      expect(mockProcessImage).toHaveBeenCalled()
    })
  })
})
