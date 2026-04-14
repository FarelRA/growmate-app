<script setup lang="ts">
import SelectPlantView from '@/views/SelectPlantView.vue'

definePageMeta({
  requiresAuth: true,
  onboarding: true,
})
</script>

<template>
  <SelectPlantView />
</template>
