<script setup lang="ts">
definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

await navigateTo({ path: '/dashboard', query: { panel: 'devices' } }, { replace: true })
</script>

<template>
  <div />
</template>
