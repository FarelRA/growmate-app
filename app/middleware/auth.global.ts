import { authState, fetchSetupStatus, initAuthState } from '@/lib/auth'
import { getSetupRoute } from '@/lib/setup'

function routePath(target: ReturnType<typeof getSetupRoute>) {
  return typeof target === 'string' ? target : (target.path ?? '/')
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) {
    return
  }

  initAuthState()

  if (to.meta.public) {
    if (!authState.isLoading.value && authState.isAuthenticated.value) {
      const status = await fetchSetupStatus()
      return navigateTo(getSetupRoute(status), { replace: true })
    }
    return
  }

  if (!to.meta.requiresAuth) {
    return
  }

  if (authState.isLoading.value) {
    return
  }

  if (!authState.isAuthenticated.value) {
    return navigateTo('/login', { replace: true })
  }

  const status = await fetchSetupStatus()

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
    const target = getSetupRoute(status)
    if (status.setupComplete) {
      return navigateTo('/', { replace: true })
    }
    if (routePath(target) !== to.path) {
      return navigateTo(target, { replace: true })
    }
    return
  }

  if (to.meta.requiresSetup && !status.setupComplete) {
    return navigateTo(getSetupRoute(status), { replace: true })
  }
})
