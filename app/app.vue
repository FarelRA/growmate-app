<script setup lang="ts">
import { computed } from 'vue'
import { Toaster } from 'vue-sonner'
import AppShell from '@/components/AppShell.vue'

const route = useRoute()
const renderClientOnlyPage = computed(() => Boolean(route.meta.requiresAuth || route.meta.onboarding))
</script>

<template>
  <AppShell>
    <ClientOnly v-if="renderClientOnlyPage">
      <NuxtPage />
      <template #fallback>
        <div class="min-h-[40vh]" />
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
