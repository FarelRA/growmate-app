<script setup lang="ts">
import ClaimDeviceView from '@/views/ClaimDeviceView.vue'

definePageMeta({
  requiresAuth: true,
  onboarding: true,
})
</script>

<template>
  <ClaimDeviceView />
</template>
