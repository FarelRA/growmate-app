import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockQuery, mockProcessImage, mockGenerateHash, mockUploadFile } =
  vi.hoisted(() => ({
    mockQuery: vi.fn(),
    mockProcessImage: vi.fn(),
    mockGenerateHash: vi.fn(),
    mockUploadFile: vi.fn(),
  }))

vi.mock('~~/convex/_generated/api', () => ({
  api: { auth: { isAuthenticated: 'isAuthenticated' } },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvexAuth: vi.fn(() => ({ query: mockQuery })),
}))

vi.mock('~~/server/utils/images', () => ({
  processImage: mockProcessImage,
  generateHash: mockGenerateHash,
}))

vi.mock('~~/server/utils/storage', () => ({
  uploadFile: mockUploadFile,
}))

import uploadHandler from '../../../../../server/routes/api/v1/upload.post'

function mockEvent() {
  return { headers: new Headers() } as unknown as Parameters<typeof uploadHandler>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  )
  globalThis.readMultipartFormData = vi.fn()
  globalThis.readRawBody = vi.fn()
})

describe('POST /api/v1/upload', () => {
  describe('authentication', () => {
    it('returns 401 without authorization header', async () => {
      await expect(uploadHandler(mockEvent())).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    })

    it('returns 401 with non-Bearer authorization', async () => {
      const event = mockEvent()
      event.headers.set('authorization', 'Basic xxx')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    })

    it('returns 401 when Convex auth fails', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Auth error'))

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer invalid-token')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    })

    it('returns 401 when Convex says not authenticated', async () => {
      mockQuery.mockResolvedValueOnce(false)

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer valid-token')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      })
    })
  })

  describe('file validation', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue(true)
    })

    it('returns 400 when multipart has no parts', async () => {
      globalThis.readMultipartFormData = vi.fn().mockResolvedValue(undefined)

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer token')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'No file uploaded',
      })
    })

    it('returns 400 when multipart is empty array', async () => {
      globalThis.readMultipartFormData = vi.fn().mockResolvedValue([])

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer token')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'No file uploaded',
      })
    })

    it('returns 400 when no part named "file"', async () => {
      globalThis.readMultipartFormData = vi.fn().mockResolvedValue([
        { name: 'other', data: Buffer.from('x') },
      ])

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer token')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'No file uploaded',
      })
    })

    it('returns 400 when file type is not an image', async () => {
      globalThis.readMultipartFormData = vi.fn().mockResolvedValue([
        { name: 'file', data: Buffer.from('x'), type: 'text/plain' },
      ])

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer token')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 400,
        statusMessage: 'File must be an image',
      })
    })

    it('returns 413 when file exceeds max size', async () => {
      const bigData = Buffer.alloc(21 * 1024 * 1024)
      globalThis.readMultipartFormData = vi.fn().mockResolvedValue([
        { name: 'file', data: bigData, type: 'image/jpeg' },
      ])

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer token')

      await expect(uploadHandler(event)).rejects.toMatchObject({
        statusCode: 413,
        statusMessage: 'Image too large (max 20MB)',
      })
    })
  })

  describe('success path', () => {
    beforeEach(() => {
      mockQuery.mockResolvedValue(true)
      mockGenerateHash.mockReturnValue('abc123def456')
      mockProcessImage.mockResolvedValue([
        { size: 50, buffer: Buffer.from('s50') },
        { size: 200, buffer: Buffer.from('s200') },
        { size: 400, buffer: Buffer.from('s400') },
        { size: 800, buffer: Buffer.from('s800') },
        { size: 1200, buffer: Buffer.from('s1200') },
        { size: 'original', buffer: Buffer.from('orig') },
      ])
      mockUploadFile.mockResolvedValue(undefined)
    })

    it('processes image and uploads all variants', async () => {
      const fileData = Buffer.from('fake-image')
      globalThis.readMultipartFormData = vi.fn().mockResolvedValue([
        { name: 'file', data: fileData, type: 'image/png' },
      ])

      const event = mockEvent()
      event.headers.set('authorization', 'Bearer token')

      const result = await uploadHandler(event)

      expect(mockGenerateHash).toHaveBeenCalledWith(fileData)
      expect(mockProcessImage).toHaveBeenCalledWith(fileData, [50, 200, 400, 800, 1200])

      expect(mockUploadFile).toHaveBeenCalledTimes(6)
      for (const size of [50, 200, 400, 800, 1200]) {
        expect(mockUploadFile).toHaveBeenCalledWith(
          'images',
          `abc123def456/${size}w.webp`,
          Buffer.from(`s${size}`),
          'image/webp',
        )
      }
      expect(mockUploadFile).toHaveBeenCalledWith(
        'images',
        'abc123def456/original.webp',
        Buffer.from('orig'),
        'image/webp',
      )

      expect(result).toEqual({ path: 'abc123def456' })
    })
  })
})
