// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockAction, mockQuery } = vi.hoisted(() => ({
  mockAction: vi.fn(),
  mockQuery: vi.fn(),
}))

vi.mock('convex/browser', () => {
  function ConvexHttpClientMock(this: Record<string, unknown>) {
    this.setAuth = vi.fn()
    this.clearAuth = vi.fn()
    this.query = mockQuery
    this.action = mockAction
    return this
  }
  return { ConvexHttpClient: ConvexHttpClientMock }
})

vi.mock('../../../app/lib/api', () => ({
  api: {
    auth: { signIn: 'auth:signIn', signOut: 'auth:signOut' },
    users: { checkSetupStatus: 'users:checkSetupStatus' },
    devices: { getUnclaimedDevice: 'devices:getUnclaimedDevice' },
  },
}))

import {
  __resetSharedConvexClientForTests,
  cleanupAuthState,
  getSharedConvexClient,
  initAuthState,
  runSharedConvexQuery,
} from '../../../app/lib/auth'

describe('shared convex client', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: { convexUrl: 'https://test.convex.cloud' },
    }))
    cleanupAuthState()
    __resetSharedConvexClientForTests()
    localStorage.clear()
    mockAction.mockReset()
    mockQuery.mockReset()
  })

  afterEach(() => {
    cleanupAuthState()
    __resetSharedConvexClientForTests()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('returns the same client instance on the client', () => {
    expect(getSharedConvexClient()).toBe(getSharedConvexClient())
  })

  it('attaches the current JWT before querying', async () => {
    localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'jwt-123')
    initAuthState()
    mockQuery.mockResolvedValue({ ok: true })

    const client = getSharedConvexClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runSharedConvexQuery('devices:getUnclaimedDevice' as any, { deviceId: 'GM-1' } as never)

    expect(client.setAuth).toHaveBeenCalledWith('jwt-123')
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  it('clears auth when no token is stored', async () => {
    initAuthState()
    mockQuery.mockResolvedValue(null)

    const client = getSharedConvexClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await runSharedConvexQuery('devices:getUnclaimedDevice' as any, { deviceId: 'GM-1' } as never)

    expect(client.clearAuth).toHaveBeenCalled()
  })

  it('force-refreshes the token and retries once on auth errors', async () => {
    localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'stale-jwt')
    localStorage.setItem('__convexAuthRefreshToken_https%3A%2F%2Ftest.convex.cloud', 'refresh-1')
    initAuthState()
    mockQuery
      .mockRejectedValueOnce(new Error('Invalid token: expired'))
      .mockResolvedValueOnce({ ok: true })
    mockAction.mockResolvedValue({ tokens: { token: 'fresh-jwt', refreshToken: 'refresh-2' } })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await runSharedConvexQuery('devices:getUnclaimedDevice' as any, { deviceId: 'GM-1' } as never)

    expect(result).toEqual({ ok: true })
    expect(mockQuery).toHaveBeenCalledTimes(2)
    expect(mockAction).toHaveBeenCalledWith('auth:signIn', { refreshToken: 'refresh-1' })
  })

  it('does not retry non-auth errors', async () => {
    initAuthState()
    mockQuery.mockRejectedValue(new Error('Something else broke'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(runSharedConvexQuery('devices:getUnclaimedDevice' as any, { deviceId: 'GM-1' } as never)).rejects.toThrow(
      'Something else broke',
    )
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockAction).not.toHaveBeenCalled()
  })
})
