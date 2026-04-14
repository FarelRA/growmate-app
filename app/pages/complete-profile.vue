<script setup lang="ts">
import CompleteProfileView from '@/views/CompleteProfileView.vue'

definePageMeta({
  requiresAuth: true,
  onboarding: true,
})
</script>

<template>
  <CompleteProfileView />
</template>
