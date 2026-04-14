<script setup lang="ts">
import ProfileView from '@/views/ProfileView.vue'

definePageMeta({
  requiresAuth: true,
})
</script>

<template>
  <ProfileView />
</template>
