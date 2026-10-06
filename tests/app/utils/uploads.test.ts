// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGetAuthToken } = vi.hoisted(() => ({
  mockGetAuthToken: vi.fn(),
}))

vi.mock('@/utils/auth', () => ({
  getAuthToken: (...args: unknown[]) => (mockGetAuthToken as any)(...args),
}))

import { uploadImageFile, readSelectedImage } from '../../../app/utils/uploads'

const mockFetch = vi.fn()

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status })
}

beforeEach(() => {
  mockFetch.mockReset()
  mockGetAuthToken.mockReset()
  mockGetAuthToken.mockResolvedValue('test-token')
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uploadImageFile', () => {
  it('POSTs FormData with a Bearer token to /api/v1/upload and returns the path', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ path: 'uploads/abc.jpg' }))
    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })

    const path = await uploadImageFile(file)

    expect(path).toBe('uploads/abc.jpg')
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/v1/upload')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('file')).toBe(file)
  })

  it('sends an empty Authorization header when no token exists', async () => {
    mockGetAuthToken.mockResolvedValue(null)
    mockFetch.mockResolvedValue(jsonResponse({ path: 'uploads/x.jpg' }))

    await uploadImageFile(new File(['d'], 'x.jpg', { type: 'image/jpeg' }))

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>).Authorization).toBe('')
  })

  it('throws "Upload failed" on non-OK responses', async () => {
    mockFetch.mockResolvedValue(new Response('boom', { status: 500 }))

    await expect(
      uploadImageFile(new File(['d'], 'x.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow('Upload failed')
  })

  it('throws "Upload failed" on unauthorized responses', async () => {
    mockFetch.mockResolvedValue(new Response('nope', { status: 401 }))

    await expect(
      uploadImageFile(new File(['d'], 'x.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow('Upload failed')
  })

  it('propagates network errors from fetch', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(
      uploadImageFile(new File(['d'], 'x.jpg', { type: 'image/jpeg' })),
    ).rejects.toThrow('Failed to fetch')
  })
})

describe('readSelectedImage', () => {
  it('returns null for nullish input', () => {
    expect(readSelectedImage(null)).toBeNull()
    expect(readSelectedImage(undefined)).toBeNull()
  })

  it('returns an object URL for a file', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    const original = URL.createObjectURL
    ;(URL as any).createObjectURL = createObjectURL
    try {
      const file = new File(['d'], 'x.jpg', { type: 'image/jpeg' })
      expect(readSelectedImage(file)).toBe('blob:mock-url')
      expect(createObjectURL).toHaveBeenCalledWith(file)
    } finally {
      ;(URL as any).createObjectURL = original
    }
  })
})
