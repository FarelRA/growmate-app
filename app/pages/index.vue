<script setup lang="ts">
import DashboardView from '@/views/DashboardView.vue'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})
</script>

<template>
  <DashboardView />
</template>
