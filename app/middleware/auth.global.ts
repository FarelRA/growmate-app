import { watch } from 'vue'
import { authState, fetchSetupStatus, initAuthState } from '@/lib/auth'
import { getSetupRoute } from '@/lib/setup'

function routePath(target: ReturnType<typeof getSetupRoute>) {
  return typeof target === 'string' ? target : (target.path ?? '/')
}

/**
 * Wait until the client auth state has resolved. Protected pages must never
 * render while `isLoading` is true: navigation is held here (Nuxt shows its
 * pending state) and only continues — to the page or to a redirect — once
 * auth is known.
 */
function waitForAuthReady(timeoutMs = 5000) {
  if (!authState.isLoading.value) {
    return Promise.resolve()
  }
  return new Promise<void>((resolve) => {
    const stop = watch(
      () => authState.isLoading.value,
      (loading) => {
        if (!loading) {
          clearTimeout(timer)
          stop()
          resolve()
        }
      },
    )
    const timer = setTimeout(() => {
      stop()
      resolve()
    }, timeoutMs)
  })
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  initAuthState()

  await waitForAuthReady()

  if (to.meta.public) {
    if (!authState.isLoading.value && authState.isAuthenticated.value) {
      if (to.meta.redirectIfAuthenticated) {
        const status = await fetchSetupStatus()
        if (!status) {
          return
        }
        return navigateTo(getSetupRoute(status), { replace: true })
      }
    }
    return
  }

  if (!to.meta.requiresAuth) {
    return
  }

  if (authState.isLoading.value) {
    return navigateTo('/login', { replace: true })
  }

  if (!authState.isAuthenticated.value) {
    return navigateTo('/login', { replace: true })
  }

  const status = await fetchSetupStatus()

  if (!status) {
    return
  }

  if (!status.authenticated) {
    return navigateTo('/login', { replace: true })
  }

  if (status.isAdmin) {
    if (to.path !== '/admin' && to.path !== '/profile') {
      return navigateTo('/admin', { replace: true })
    }
    return
  }

  if (to.meta.onboarding) {
    const isManualDeviceLinking =
      to.path === '/claim-device' && typeof to.query.manual === 'string' && to.query.manual === '1'
    const target = getSetupRoute(status)
    if (status.setupComplete && !isManualDeviceLinking) {
      return navigateTo('/dashboard', { replace: true })
    }
    if (routePath(target) !== to.path) {
      if (isManualDeviceLinking) {
        return
      }
      return navigateTo(target, { replace: true })
    }
    return
  }

  if (to.meta.requiresSetup && !status.setupComplete) {
    return navigateTo(getSetupRoute(status), { replace: true })
  }
})
