import { ref } from 'vue'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/lib/api'

const JWT_STORAGE_KEY = '__convexAuthJWT'
const REFRESH_TOKEN_STORAGE_KEY = '__convexAuthRefreshToken'

const token = ref<string | null>(null)
const isLoading = ref(true)
const isAuthenticated = ref(false)
let authStateInitialized = false

export type SetupStatus = {
  authenticated?: boolean
  setupComplete?: boolean
  nextStep?: 'complete-profile' | 'claim-device' | 'select-plant' | 'done'
  nextDeviceId?: string | null
  isAdmin?: boolean
}

function storageKey(key: string) {
  return `${key}_${encodeURIComponent(getConvexUrl())}`
}

function getConvexUrl() {
  const convexUrl = useRuntimeConfig().public.convexUrl
  if (!convexUrl) {
    throw new Error('NUXT_PUBLIC_CONVEX_URL is not configured')
  }
  return convexUrl
}

function getStoredValue(key: string) {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(storageKey(key))
}

function setStoredValue(key: string, value: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey(key), value)
}

function removeStoredValue(key: string) {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(storageKey(key))
}

function syncTokenFromStorage() {
  token.value = getStoredValue(JWT_STORAGE_KEY)
  isAuthenticated.value = token.value !== null
  isLoading.value = false
}

function storeTokens(tokens: { token: string; refreshToken?: string } | null) {
  if (!tokens) {
    token.value = null
    isAuthenticated.value = false
    removeStoredValue(JWT_STORAGE_KEY)
    removeStoredValue(REFRESH_TOKEN_STORAGE_KEY)
    return
  }

  token.value = tokens.token
  isAuthenticated.value = true
  setStoredValue(JWT_STORAGE_KEY, tokens.token)

  if (tokens.refreshToken) {
    setStoredValue(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken)
  }
}

function createClient(authToken?: string) {
  const client = new ConvexHttpClient(getConvexUrl())
  if (authToken) {
    client.setAuth(authToken)
  }
  return client
}

export function initAuthState() {
  if (import.meta.server || authStateInitialized) {
    return
  }

  syncTokenFromStorage()

  window.addEventListener('storage', (event) => {
    if (event.key === storageKey(JWT_STORAGE_KEY)) {
      token.value = event.newValue
      isAuthenticated.value = event.newValue !== null
    }
  })

  authStateInitialized = true
}

export const authState = {
  token,
  isLoading,
  isAuthenticated,
}

export async function signInWithPassword(flow: 'signIn' | 'signUp', email: string, password: string) {
  const client = createClient()
  const result = await client.action(api.auth.signIn, {
    provider: 'password',
    params: { email, password, flow },
  })

  if (result.tokens) {
    storeTokens(result.tokens)
  }

  return result
}

export async function signOutCurrentUser() {
  try {
    if (token.value) {
      await createClient(token.value).action(api.auth.signOut, {})
    }
  } catch {
    // Clearing local auth state is the important part here.
  } finally {
    storeTokens(null)
  }
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  try {
    return await createClient(token.value ?? undefined).query(api.growmate.checkSetupStatus, {})
  } catch {
    return {
      authenticated: false,
      nextStep: 'complete-profile',
      nextDeviceId: null,
      isAdmin: false,
      setupComplete: false,
    }
  }
}

export async function getAuthToken({ forceRefreshToken }: { forceRefreshToken: boolean }) {
  if (!forceRefreshToken) {
    return token.value
  }

  const refreshToken = getStoredValue(REFRESH_TOKEN_STORAGE_KEY)
  if (!refreshToken) {
    return token.value
  }

  const result = await createClient().action(api.auth.signIn, { refreshToken })
  if (result.tokens === undefined) {
    return token.value
  }

  storeTokens(result.tokens ?? null)
  return token.value
}
