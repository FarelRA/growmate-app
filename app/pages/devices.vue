<script setup lang="ts">
definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

await navigateTo({ path: '/', query: { panel: 'devices' } }, { replace: true })
</script>

<template />
