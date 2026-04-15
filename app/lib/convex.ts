import { createConvexVue } from '@convex-vue/core'
import { authState, getAuthToken } from '@/lib/auth'

export const convexPlugin = createConvexVue({
  convexUrl: import.meta.env.VITE_CONVEX_URL,
  auth: {
    getToken: getAuthToken,
    isAuthenticated: authState.isAuthenticated,
    isLoading: authState.isLoading,
    installNavigationGuard: false,
    needsAuth: (to: { meta?: { requiresAuth?: boolean } }) => Boolean(to.meta?.requiresAuth),
    redirectTo: () => ({ path: '/login' }),
  } as never,
})
