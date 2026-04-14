<script setup lang="ts">
import CommunityView from '@/views/CommunityView.vue'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})
</script>

<template>
  <CommunityView />
</template>
