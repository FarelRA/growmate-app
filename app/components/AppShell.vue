<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { api } from '@/lib/api'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const route = useRoute()
const notificationsOpen = ref(false)
const installPromptEvent = ref<BeforeInstallPromptEvent | null>(null)
const { data: notifications } = useConvexQuery(api.growmate.headerNotifications, {})
const { data: setupStatus } = useConvexQuery(api.growmate.checkSetupStatus, {})
const { mutate: markNotificationRead } = useConvexMutation(api.growmate.markNotificationRead)

const growerNavigation = [
  { label: 'Dashboard', short: 'Home', icon: 'dashboard', to: '/' },
  { label: 'Assistant', short: 'Assistant', icon: 'psychology', to: '/assistant' },
  { label: 'Market', short: 'Market', icon: 'shopping_basket', to: '/marketplace' },
  { label: 'Community', short: 'Community', icon: 'groups', to: '/community' },
]

const adminNavigation = [
  { label: 'Admin', short: 'Admin', icon: 'admin_panel_settings', to: '/admin' },
  { label: 'Profile', short: 'Profile', icon: 'person', to: '/profile' },
]

const canInstall = computed(() => installPromptEvent.value !== null)
const showChrome = computed(() => !route.meta.public && !route.meta.onboarding)
const navigation = computed(() => (setupStatus.value?.isAdmin ? adminNavigation : growerNavigation))
const activePath = computed(() => (route.path === '/devices' || route.path === '/history' ? '/' : route.path))

function handleBeforeInstallPrompt(event: Event) {
  event.preventDefault()
  installPromptEvent.value = event as BeforeInstallPromptEvent
}

function handleAppInstalled() {
  installPromptEvent.value = null
}

async function handleOpenNotifications() {
  notificationsOpen.value = !notificationsOpen.value
}

async function handleNotificationClick(notificationId: string) {
  await markNotificationRead({ notificationId: notificationId as never })
}

async function handleInstallApp() {
  if (!installPromptEvent.value)
    return

  await installPromptEvent.value.prompt()
  const { outcome } = await installPromptEvent.value.userChoice

  if (outcome !== 'accepted')
    return

  installPromptEvent.value = null
}

onMounted(() => {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.addEventListener('appinstalled', handleAppInstalled)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  window.removeEventListener('appinstalled', handleAppInstalled)
})
</script>

<template>
  <div class="min-h-screen bg-gm-surface text-gm-text">
    <header v-if="showChrome" class="sticky top-0 z-40 w-full bg-[#f9f9f9] px-4 py-3 sm:px-6 sm:py-4">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <span class="material-symbols-outlined text-2xl text-gm-primary">potted_plant</span>
          <h1 class="font-headline text-xl font-black italic tracking-tight text-gm-primary">GrowMate</h1>
        </div>
        <div class="flex items-center gap-3">
          <button
            v-if="canInstall"
            class="rounded-full bg-gm-primary px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7d29]"
            @click="handleInstallApp"
          >
            Install App
          </button>
          <button class="relative rounded-full p-2 text-slate-500 transition-colors hover:bg-[#f3f3f3]" @click="handleOpenNotifications">
            <span class="material-symbols-outlined">notifications</span>
            <span v-if="notifications?.unreadCount" class="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-gm-primary px-1 text-center text-[10px] font-bold text-white">{{ notifications.unreadCount }}</span>
          </button>
          <NuxtLink class="rounded-full bg-gm-surface-high px-4 py-2 text-xs font-bold text-gm-primary transition-colors hover:bg-[#f3f3f3]" to="/profile">Profile</NuxtLink>
        </div>
      </div>
      <div v-if="notificationsOpen" class="mx-auto mt-4 max-w-7xl">
        <div class="ml-auto max-w-md rounded-[1.5rem] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-gm-text">Notifications</h2>
            <span class="text-xs text-gm-muted">{{ notifications?.unreadCount ?? 0 }} unread</span>
          </div>
          <div v-if="notifications?.items.length" class="mt-4 space-y-3">
            <button v-for="item in notifications.items" :key="item._id" class="w-full rounded-2xl p-3 text-left" :class="item.read ? 'bg-[#fafafa]' : 'bg-gm-primary/5'" @click="handleNotificationClick(item._id)">
              <div class="text-sm font-semibold text-gm-text">{{ item.title }}</div>
              <div class="mt-1 text-xs text-gm-muted">{{ item.detail }}</div>
              <div class="mt-2 text-[11px] text-gm-muted">{{ item.relativeTime }}</div>
            </button>
          </div>
          <div v-else class="mt-4 rounded-2xl bg-[#f3f3f3] p-4 text-sm text-gm-muted">No notifications yet.</div>
        </div>
      </div>
    </header>

    <main :class="showChrome ? 'mx-auto max-w-7xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:px-8' : ''">
      <slot />
    </main>

    <nav v-if="showChrome" class="fixed bottom-0 left-0 right-0 z-50 rounded-t-[1.5rem] bg-[#f9f9f9]/80 px-3 pt-2 pb-5 shadow-[0_-4px_32px_rgba(0,0,0,0.04)] backdrop-blur-lg sm:px-4 sm:pt-3 sm:pb-6">
      <div class="mx-auto grid max-w-7xl gap-2" :class="navigation.length <= 2 ? 'grid-cols-2' : 'grid-cols-4'">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="flex min-w-0 flex-col items-center justify-center rounded-[1.25rem] px-2 py-2 transition-all duration-300 ease-in-out"
          :class="activePath === item.to ? 'bg-gradient-to-br from-gm-primary to-gm-primary-soft text-white' : 'text-slate-500'"
        >
          <span class="material-symbols-outlined text-[22px]" :style="activePath === item.to ? 'font-variation-settings: \'FILL\' 1;' : ''">{{ item.icon }}</span>
          <span class="mt-1 truncate text-[10px] font-medium uppercase tracking-wider">{{ item.short }}</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>
