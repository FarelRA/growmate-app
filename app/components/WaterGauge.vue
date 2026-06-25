<script setup lang="ts">
defineProps<{
  level: number
  label: string
  capacity: number
  minLevel?: number
}>()
</script>

<template>
  <article class="rounded-[2rem] bg-[#f3f3f3] p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
    <div class="flex items-start justify-between gap-4">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em]" :class="minLevel !== undefined ? 'text-emerald-700' : 'text-[#006493]'">{{ label }}</p>
        <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">{{ level }}%</h2>
        <p class="mt-2 text-sm leading-relaxed text-gm-muted">Kapasitas {{ capacity }}L</p>
        <p v-if="minLevel !== undefined && level <= minLevel" class="mt-1 text-xs font-semibold text-red-500">Level rendah — isi ulang tangki</p>
      </div>
      <div class="relative h-28 w-16 overflow-hidden rounded-[1.25rem] bg-white shadow-inner">
        <div
          class="absolute bottom-0 left-0 w-full"
          :class="minLevel !== undefined ? 'bg-gradient-to-t from-emerald-700 to-emerald-400' : 'bg-gradient-to-t from-[#006493] to-[#00a4ed]'"
          :style="{ height: `${level}%` }"
        />
        <div class="absolute inset-0 flex items-center justify-center text-sm font-black text-gm-text mix-blend-overlay">{{ level }}%</div>
      </div>
    </div>
  </article>
</template>
