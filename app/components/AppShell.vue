<script setup lang="ts">
import { computed } from 'vue'
import AppChrome from '@/components/AppChrome.vue'

const route = useRoute()
const showChrome = computed(() => !route.meta.public && !route.meta.onboarding)
</script>

<template>
  <ClientOnly v-if="showChrome">
    <AppChrome>
      <slot />
    </AppChrome>
    <template #fallback>
      <div class="min-h-screen bg-gm-surface text-gm-text">
        <main class="mx-auto max-w-7xl px-4 pt-4 pb-28 sm:px-6 sm:pt-6 lg:px-8">
          <slot />
        </main>
      </div>
    </template>
  </ClientOnly>

  <div v-else class="min-h-screen bg-gm-surface text-gm-text">
    <main>
      <slot />
    </main>
  </div>
</template>
