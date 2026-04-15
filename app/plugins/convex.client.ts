import type { Plugin } from 'vue'
import { createConvexVue } from '@convex-vue/core'
import { authState, getAuthToken, initAuthState } from '@/lib/auth'
import { initActiveDeviceState } from '@/lib/devices'

export default defineNuxtPlugin((nuxtApp) => {
  initAuthState()
  initActiveDeviceState()

  const convexUrl = useRuntimeConfig().public.convexUrl
  if (!convexUrl) {
    throw new Error('NUXT_PUBLIC_CONVEX_URL is not configured')
  }

  const convexPlugin = createConvexVue({
    convexUrl,
    auth: {
      getToken: getAuthToken,
      isAuthenticated: authState.isAuthenticated,
      isLoading: authState.isLoading,
      installNavigationGuard: false,
      needsAuth: (to: { meta?: { requiresAuth?: boolean } }) => Boolean(to.meta?.requiresAuth),
      redirectTo: () => ({ path: '/login' }),
    } as never,
  })

  nuxtApp.vueApp.use(convexPlugin as unknown as Plugin)
})
