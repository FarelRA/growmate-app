/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SRC = '../../../../server/api/v2/recordings/[deviceId].get'

const mockQuery = vi.hoisted(() => vi.fn())
const { mockGetSignedUrl, mockPublicClient } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn(async () => 'https://signed.example/url'),
  mockPublicClient: {},
}))

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    auth: { isAuthenticated: 'isAuthenticated' },
    streams: { getOwnedDevice: 'getOwnedDevice', listRecordings: 'listRecordings' },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvexAuth: () => ({
    query: mockQuery,
  }),
}))

vi.mock('~~/server/utils/storage', () => ({
  s3PublicClient: () => mockPublicClient,
  RECORDINGS_BUCKET: 'recordings',
}))

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class GetObjectCommand {
    constructor(public input: unknown) {}
  },
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => (mockGetSignedUrl as (...a: unknown[]) => unknown)(...args),
}))

function mockEvent(deviceId = 'dev-1', bearer = 'token-123') {
  const event: any = { headers: new Headers(), params: { deviceId } }
  if (bearer) event.headers.set('authorization', `Bearer ${bearer}`)
  return event
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.getRouterParam = vi.fn((event: any, name: string) => event.params?.[name]) as any
  mockQuery.mockImplementation(async (ref: string) => {
    if (ref === 'isAuthenticated') return true
    throw new Error(`unexpected query: ${ref}`)
  })
})

describe('GET /api/v2/recordings/:deviceId auth', () => {
  it('rejects requests without a Bearer token', async () => {
    const handler = (await import(SRC)).default
    await expect(handler(mockEvent('dev-1', null as any))).rejects.toMatchObject({
      statusCode: 401,
    })
  })

  it('rejects unauthenticated callers', async () => {
    mockQuery.mockImplementation(async (ref: string) => {
      if (ref === 'isAuthenticated') return false
      throw new Error(`unexpected query: ${ref}`)
    })
    const handler = (await import(SRC)).default
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 401 })
  })

  it('returns 404 for unknown devices', async () => {
    mockQuery.mockImplementation(async (ref: string) => {
      if (ref === 'isAuthenticated') return true
      if (ref === 'getOwnedDevice') return null
      throw new Error(`unexpected query: ${ref}`)
    })
    const handler = (await import(SRC)).default
    await expect(handler(mockEvent('ghost'))).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns 404 for foreign (claimed by someone else) devices', async () => {
    mockQuery.mockImplementation(async (ref: string) => {
      if (ref === 'isAuthenticated') return true
      if (ref === 'getOwnedDevice') return null
      if (ref === 'listRecordings') return [{ _id: 'r1', path: 'dev-x/stream/a.h264' }]
      throw new Error(`unexpected query: ${ref}`)
    })
    const handler = (await import(SRC)).default
    await expect(handler(mockEvent('foreign-dev'))).rejects.toMatchObject({ statusCode: 404 })
    expect(mockQuery).not.toHaveBeenCalledWith('listRecordings', expect.anything())
  })

  it('returns 200 with signed URLs only for the owner (claimed device)', async () => {
    mockQuery.mockImplementation(async (ref: string) => {
      if (ref === 'isAuthenticated') return true
      if (ref === 'getOwnedDevice') return { deviceId: 'dev-1', name: 'GrowMate' }
      if (ref === 'listRecordings') {
        return [{ _id: 'r1', fileName: 'a.h264', path: 'dev-1/stream/a.h264', size: 10 }]
      }
      throw new Error(`unexpected query: ${ref}`)
    })
    const handler = (await import(SRC)).default
    const result = await handler(mockEvent('dev-1'))
    expect(mockQuery).toHaveBeenCalledWith('getOwnedDevice', { deviceId: 'dev-1' })
    expect(result.recordings).toHaveLength(1)
    expect(result.recordings[0]).toMatchObject({
      _id: 'r1',
      downloadUrl: 'https://signed.example/url',
    })
    // Presigned with the PUBLIC-host client so URLs resolve in browsers.
    expect(mockGetSignedUrl).toHaveBeenCalledWith(
      mockPublicClient,
      expect.anything(),
      { expiresIn: 3600 },
    )
  })
})
