<script setup lang="ts">
definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

await navigateTo({ path: '/', query: { panel: 'history' } }, { replace: true })
</script>

<template />
