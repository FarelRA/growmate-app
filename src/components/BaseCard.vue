<script setup lang="ts">
defineProps<{
  muted?: boolean
  padded?: boolean
}>()
</script>

<template>
  <section
    :class="[
      muted ? 'bg-gm-surface-low' : 'bg-white',
      padded === false ? '' : 'p-5 md:p-6',
      'rounded-[28px] shadow-[0_20px_60px_rgba(26,28,28,0.05)]',
    ]"
  >
    <slot />
  </section>
</template>
