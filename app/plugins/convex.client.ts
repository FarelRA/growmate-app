import { createConvexVue } from '@convex-vue/core'
import { authState, getAuthToken, initAuthState } from '@/utils/auth'
import { initActiveDeviceState } from '@/composables/useActiveDevice'

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
    },
  })

  nuxtApp.vueApp.use(convexPlugin)
})
