// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../../app/lib/api', () => ({
  api: {
    auth: {
      signIn: 'auth:signIn',
      signOut: 'auth:signOut',
    },
    users: {
      checkSetupStatus: 'users:checkSetupStatus',
    },
  },
}))

const { mockAction, mockQuery } = vi.hoisted(() => ({
  mockAction: vi.fn(),
  mockQuery: vi.fn(),
}))

vi.mock('convex/browser', () => {
  function ConvexHttpClientMock() {
    this.setAuth = vi.fn()
    this.query = mockQuery
    this.action = mockAction
    return this
  }
  return { ConvexHttpClient: ConvexHttpClientMock }
})

import {
  initAuthState,
  cleanupAuthState,
  authState,
  signInWithPassword,
  signOutCurrentUser,
  fetchSetupStatus,
  getAuthToken,
  AuthNotReadyError,
} from '../../../app/lib/auth'

describe('auth module', () => {
  beforeEach(() => {
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        convexUrl: 'https://test.convex.cloud',
      },
    }))
    cleanupAuthState()
    localStorage.clear()
    mockAction.mockReset()
    mockQuery.mockReset()
  })

  afterEach(() => {
    cleanupAuthState()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  describe('initAuthState', () => {
    it('sets isLoading to false and isAuthenticated to false when no token', () => {
      initAuthState()
      expect(authState.isLoading.value).toBe(false)
      expect(authState.isAuthenticated.value).toBe(false)
      expect(authState.token.value).toBeNull()
    })

    it('reads token from localStorage', () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'test-jwt')
      initAuthState()
      expect(authState.token.value).toBe('test-jwt')
      expect(authState.isAuthenticated.value).toBe(true)
    })

    it('is idempotent — second call returns early', () => {
      initAuthState()
      expect(authState.isLoading.value).toBe(false)
      initAuthState()
      expect(authState.isLoading.value).toBe(false)
    })
  })

  describe('cleanupAuthState', () => {
    it('removes the storage listener', () => {
      initAuthState()
      cleanupAuthState()
      // Should not error on second cleanup
      cleanupAuthState()
    })
  })

  describe('authState', () => {
    it('exposes token, isLoading, isAuthenticated refs', () => {
      expect(authState).toHaveProperty('token')
      expect(authState).toHaveProperty('isLoading')
      expect(authState).toHaveProperty('isAuthenticated')
    })
  })

  describe('signInWithPassword', () => {
    it('calls Convex signIn action with password provider', async () => {
      mockAction.mockResolvedValue({ tokens: { token: 'new-jwt', refreshToken: 'refresh' } })

      const result = await signInWithPassword('signIn', 'test@example.com', 'password123')

      expect(mockAction).toHaveBeenCalledWith('auth:signIn', {
        provider: 'password',
        params: { email: 'test@example.com', password: 'password123', flow: 'signIn' },
      })
      expect(result).toEqual({ tokens: { token: 'new-jwt', refreshToken: 'refresh' } })
    })

    it('stores tokens on success', async () => {
      mockAction.mockResolvedValue({ tokens: { token: 'new-jwt', refreshToken: 'refresh' } })

      await signInWithPassword('signUp', 'user@example.com', 'secret')

      expect(authState.token.value).toBe('new-jwt')
      expect(authState.isAuthenticated.value).toBe(true)
    })

    it('does not fail when result has no tokens', async () => {
      mockAction.mockResolvedValue({})

      const result = await signInWithPassword('signIn', 'test@example.com', 'password')

      initAuthState()
      expect(authState.token.value).toBeNull()
      expect(authState.isAuthenticated.value).toBe(false)
      expect(result).toEqual({})
    })

    it('propagates errors from Convex action', async () => {
      mockAction.mockRejectedValue(new Error('Invalid credentials'))

      await expect(signInWithPassword('signIn', 'bad@user.com', 'wrong')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('signOutCurrentUser', () => {
    it('calls Convex signOut action when token exists', async () => {
      mockAction.mockResolvedValue({})
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'test-jwt')
      initAuthState()

      await signOutCurrentUser()

      expect(mockAction).toHaveBeenCalledWith('auth:signOut', {})
    })

    it('clears tokens on signOut', async () => {
      mockAction.mockResolvedValue({})
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'test-jwt')
      initAuthState()

      await signOutCurrentUser()

      expect(authState.token.value).toBeNull()
      expect(authState.isAuthenticated.value).toBe(false)
    })

    it('clears tokens even when signOut action fails', async () => {
      mockAction.mockRejectedValue(new Error('Network error'))
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'test-jwt')
      initAuthState()

      await signOutCurrentUser()

      expect(authState.token.value).toBeNull()
      expect(authState.isAuthenticated.value).toBe(false)
    })

    it('works when no token exists', async () => {
      initAuthState()
      await signOutCurrentUser()
      expect(authState.token.value).toBeNull()
    })
  })

  describe('fetchSetupStatus', () => {
    beforeEach(() => {
      initAuthState()
    })

    it('queries Convex for setup status', async () => {
      mockQuery.mockResolvedValue({ authenticated: true, setupComplete: true, nextStep: 'done', isAdmin: false })

      const result = await fetchSetupStatus()

      expect(mockQuery).toHaveBeenCalledWith('users:checkSetupStatus', {})
      expect(result).toEqual({ authenticated: true, setupComplete: true, nextStep: 'done', isAdmin: false })
    })

    it('rethrows ConvexError', async () => {
      const { ConvexError } = await import('convex/values')
      mockQuery.mockRejectedValue(new ConvexError('Unauthenticated'))

      await expect(fetchSetupStatus()).rejects.toThrow(ConvexError)
    })

    it('retries on Failed to fetch error', async () => {
      mockQuery
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce({ authenticated: true, setupComplete: false, nextStep: 'complete-profile' })

      const result = await fetchSetupStatus(1)

      expect(mockQuery).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ authenticated: true, setupComplete: false, nextStep: 'complete-profile' })
    })

    it('returns null after exhausting retries on network error', async () => {
      mockQuery.mockRejectedValue(new TypeError('Failed to fetch'))

      const result = await fetchSetupStatus(1)

      expect(mockQuery).toHaveBeenCalledTimes(2)
      expect(result).toBeNull()
    })

    it('returns null on generic error', async () => {
      mockQuery.mockRejectedValue(new Error('Unknown'))

      const result = await fetchSetupStatus(0)

      expect(result).toBeNull()
    })

    it('throws AuthNotReadyError when not initialized', async () => {
      cleanupAuthState()

      await expect(fetchSetupStatus()).rejects.toThrow(AuthNotReadyError)
    })
  })

  describe('getAuthToken', () => {
    it('returns current token without refresh', async () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'existing-jwt')
      initAuthState()

      const token = await getAuthToken()

      expect(token).toBe('existing-jwt')
      expect(mockAction).not.toHaveBeenCalled()
    })

    it('returns null when no token exists', async () => {
      initAuthState()
      const token = await getAuthToken()
      expect(token).toBeNull()
    })

    it('returns current token when forceRefresh fails due to missing refresh token', async () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'existing-jwt')
      cleanupAuthState()
      initAuthState()

      const token = await getAuthToken({ forceRefreshToken: true })

      expect(token).toBe('existing-jwt')
    })

    it('refreshes token when forceRefreshToken is true and refresh token exists', async () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'old-jwt')
      localStorage.setItem('__convexAuthRefreshToken_https%3A%2F%2Ftest.convex.cloud', 'refresh-token')
      mockAction.mockResolvedValue({ tokens: { token: 'new-jwt', refreshToken: 'new-refresh' } })
      cleanupAuthState()
      initAuthState()

      const token = await getAuthToken({ forceRefreshToken: true })

      expect(mockAction).toHaveBeenCalledWith('auth:signIn', { refreshToken: 'refresh-token' })
      expect(token).toBe('new-jwt')
      expect(authState.token.value).toBe('new-jwt')
    })

    it('returns old token if refresh returns undefined tokens', async () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'old-jwt')
      localStorage.setItem('__convexAuthRefreshToken_https%3A%2F%2Ftest.convex.cloud', 'refresh-token')
      mockAction.mockResolvedValue({})
      cleanupAuthState()
      initAuthState()

      await getAuthToken({ forceRefreshToken: true })

      expect(authState.token.value).toBe('old-jwt')
    })
  })

  describe('cross-tab storage sync', () => {
    it('updates authState when storage event fires for JWT key', () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'initial-jwt')
      initAuthState()
      expect(authState.token.value).toBe('initial-jwt')

      const storageKey = '__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud'
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: 'updated-jwt' }))

      expect(authState.token.value).toBe('updated-jwt')
      expect(authState.isAuthenticated.value).toBe(true)
    })

    it('sets isAuthenticated to false when storage event clears token', () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'existing-jwt')
      initAuthState()
      expect(authState.isAuthenticated.value).toBe(true)

      const storageKey = '__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud'
      window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: null }))

      expect(authState.token.value).toBeNull()
      expect(authState.isAuthenticated.value).toBe(false)
    })
  })
})
