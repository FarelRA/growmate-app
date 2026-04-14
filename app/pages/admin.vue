<script setup lang="ts">
import AdminView from '@/views/AdminView.vue'

definePageMeta({
  requiresAuth: true,
})
</script>

<template>
  <AdminView />
</template>
