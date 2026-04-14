<script setup lang="ts">
import MarketplaceView from '@/views/MarketplaceView.vue'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})
</script>

<template>
  <MarketplaceView />
</template>
