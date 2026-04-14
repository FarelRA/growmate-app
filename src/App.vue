<script setup lang="ts">
import { RouterView } from 'vue-router'
import { Toaster } from 'vue-sonner'
import AppShell from './components/AppShell.vue'
</script>

<template>
  <AppShell>
    <RouterView />
  </AppShell>
  <Toaster
    rich-colors
    position="top-center"
    :expand="false"
    :visible-toasts="3"
    close-button
    :duration="2800"
  />
</template>
