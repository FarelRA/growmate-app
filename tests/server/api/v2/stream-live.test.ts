/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SRC = '../../../../server/api/v2/stream/[deviceId]/live.get'

const mockQuery = vi.hoisted(() => vi.fn())
const mockAddViewer = vi.hoisted(() => vi.fn())
const mockRemoveViewer = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    auth: { isAuthenticated: 'isAuthenticated' },
    streams: { getOwnedDevice: 'getOwnedDevice' },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvexAuth: () => ({
    query: mockQuery,
  }),
}))

vi.mock('~~/server/utils/streamManager', () => ({
  streamManager: {
    addViewer: (...args: unknown[]) => (mockAddViewer as any)(...args),
    removeViewer: (...args: unknown[]) => (mockRemoveViewer as any)(...args),
  },
}))

function upgradeRequest(deviceId = 'dev-1', token: string | null = 'token-123') {
  const base = `ws://localhost/api/v2/stream/${deviceId}/live`
  return new Request(token ? `${base}?token=${encodeURIComponent(token)}` : base)
}

function mockPeer(url: string, context: Record<string, unknown> = {}) {
  return {
    request: new Request(url),
    context,
    send: vi.fn(),
    close: vi.fn(),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockQuery.mockReset()
  mockAddViewer.mockReset()
  mockRemoveViewer.mockReset();
  (globalThis as any).defineWebSocketHandler = (hooks: any) => hooks
  mockQuery.mockImplementation(async (ref: string) => {
    if (ref === 'isAuthenticated') return true
    if (ref === 'getOwnedDevice') return { deviceId: 'dev-1', name: 'GrowMate' }
    throw new Error(`unexpected query: ${ref}`)
  })
})

describe('WS /api/v2/stream/:deviceId/live auth', () => {
  it('rejects upgrade without a token (401)', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default as any
    const result = await handler.upgrade(upgradeRequest('dev-1', null))
    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects upgrade with an invalid token (401)', async () => {
    mockQuery.mockImplementation(async (ref: string) => {
      if (ref === 'isAuthenticated') return false
      throw new Error(`unexpected query: ${ref}`)
    })
    vi.resetModules()
    const handler = (await import(SRC)).default as any
    const result = await handler.upgrade(upgradeRequest())
    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalledWith('getOwnedDevice', expect.anything())
  })

  it('rejects upgrade when the auth query throws (401)', async () => {
    mockQuery.mockRejectedValue(new Error('bad jwt'))
    vi.resetModules()
    const handler = (await import(SRC)).default as any
    const result = await handler.upgrade(upgradeRequest())
    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(401)
  })

  it('denies a foreign (not-owned) device with 404', async () => {
    mockQuery.mockImplementation(async (ref: string) => {
      if (ref === 'isAuthenticated') return true
      if (ref === 'getOwnedDevice') return null
      throw new Error(`unexpected query: ${ref}`)
    })
    vi.resetModules()
    const handler = (await import(SRC)).default as any
    const result = await handler.upgrade(upgradeRequest('foreign-dev'))
    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(404)
    expect(mockQuery).toHaveBeenCalledWith('getOwnedDevice', { deviceId: 'foreign-dev' })
  })

  it('authorizes an owned device and attaches the viewer on open', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default as any
    const result = await handler.upgrade(upgradeRequest('dev-1'))
    expect(result).not.toBeInstanceOf(Response)
    expect(result?.context).toMatchObject({ deviceId: 'dev-1' })
    expect(mockQuery).toHaveBeenCalledWith('getOwnedDevice', { deviceId: 'dev-1' })

    // crossws applies the upgrade context to peer.context before open()
    const peer = mockPeer('ws://localhost/api/v2/stream/dev-1/live?token=token-123', {
      ...result.context,
    })
    handler.open(peer)
    expect(mockAddViewer).toHaveBeenCalledWith('dev-1', peer)
    expect(peer.close).not.toHaveBeenCalled()
  })

  it('closes peers that reach open() without upgrade authorization', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default as any
    const peer = mockPeer('ws://localhost/api/v2/stream/dev-1/live?token=token-123')
    handler.open(peer)
    expect(peer.close).toHaveBeenCalled()
    expect(mockAddViewer).not.toHaveBeenCalled()
  })
})
