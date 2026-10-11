<script setup lang="ts">
import { computed } from 'vue'
import { Toaster } from 'vue-sonner'
import AppShell from '@/components/AppShell.vue'

const route = useRoute()
const renderClientOnlyPage = computed(() =>
  Boolean(route.meta.requiresAuth || route.meta.onboarding),
)
</script>

<template>
  <AppShell>
    <ClientOnly v-if="renderClientOnlyPage">
      <NuxtPage />
      <template #fallback>
        <div class="mx-auto max-w-7xl px-4 py-10">
          <div class="animate-pulse space-y-4" aria-hidden="true">
            <div class="h-8 w-1/3 rounded-full bg-[#e8e8e8]"></div>
            <div class="h-32 rounded-[2rem] bg-[#e8e8e8]"></div>
          </div>
          <p class="mt-5 text-center text-sm text-gm-muted" role="status">Memuat halaman...</p>
        </div>
      </template>
    </ClientOnly>
    <NuxtPage v-else />
  </AppShell>
  <Toaster
    rich-colors
    position="top-center"
    :expand="false"
    :visible-toasts="3"
    close-button
    :duration="2800"
  />
</template>
