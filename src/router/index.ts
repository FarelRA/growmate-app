import { createRouter, createWebHistory } from 'vue-router'
import { authState } from '@/lib/auth'
import DashboardView from '@/views/DashboardView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // Public routes
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { public: true },
    },
    // Onboarding routes (require auth but not full setup)
    {
      path: '/complete-profile',
      name: 'complete-profile',
      component: () => import('@/views/CompleteProfileView.vue'),
      meta: { requiresAuth: true, onboarding: true },
    },
    {
      path: '/claim-device',
      name: 'claim-device',
      component: () => import('@/views/ClaimDeviceView.vue'),
      meta: { requiresAuth: true, onboarding: true },
    },
    {
      path: '/select-plant',
      name: 'select-plant',
      component: () => import('@/views/SelectPlantView.vue'),
      meta: { requiresAuth: true, onboarding: true },
    },
    // Protected routes (require full setup)
    {
      path: '/',
      name: 'dashboard',
      component: DashboardView,
      meta: { requiresAuth: true, requiresSetup: true },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/views/ProfileView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/devices',
      name: 'devices',
      redirect: () => ({ path: '/', query: { panel: 'devices' } }),
      meta: { requiresAuth: true },
    },
    {
      path: '/history',
      name: 'history',
      redirect: () => ({ path: '/', query: { panel: 'history' } }),
      meta: { requiresAuth: true, requiresSetup: true },
    },
    {
      path: '/assistant',
      name: 'assistant',
      component: () => import('@/views/AssistantView.vue'),
      meta: { requiresAuth: true, requiresSetup: true },
    },
    {
      path: '/support',
      name: 'support',
      component: () => import('@/views/SupportView.vue'),
      meta: { requiresAuth: true, requiresSetup: true },
    },
    {
      path: '/marketplace',
      name: 'marketplace',
      component: () => import('@/views/MarketplaceView.vue'),
      meta: { requiresAuth: true, requiresSetup: true },
    },
    {
      path: '/community',
      name: 'community',
      component: () => import('@/views/CommunityView.vue'),
      meta: { requiresAuth: true, requiresSetup: true },
    },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.public) {
    if (authState.isLoading.value) {
      return true
    }

    if (authState.isAuthenticated.value) {
      return '/'
    }

    return true
  }

  if (!to.meta.requiresAuth) {
    return true
  }

  if (authState.isLoading.value) {
    return true
  }

  if (!authState.isAuthenticated.value) {
    return '/login'
  }

  return true
})

export default router
