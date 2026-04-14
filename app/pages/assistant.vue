<script setup lang="ts">
import AssistantView from '@/views/AssistantView.vue'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})
</script>

<template>
  <AssistantView />
</template>
