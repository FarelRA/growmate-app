<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{
  error: NuxtError
}>()

const statusCode = computed(() => props.error?.statusCode ?? 500)
const isNotFound = computed(() => statusCode.value === 404)

const title = computed(() =>
  isNotFound.value ? 'Halaman tidak ditemukan' : 'Terjadi kesalahan',
)
const description = computed(() =>
  isNotFound.value
    ? 'Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.'
    : (props.error?.message ?? 'Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.'),
)

const goHome = () => clearError({ redirect: '/' })
const retry = () => clearError()
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gm-surface px-4 py-16">
    <div class="w-full max-w-md rounded-3xl border border-gm-surface-high bg-white p-8 text-center shadow-sm">
      <p class="font-headline text-6xl font-extrabold text-gm-primary">
        {{ statusCode }}
      </p>
      <h1 class="mt-3 font-headline text-xl font-bold text-gm-text">
        {{ title }}
      </h1>
      <p class="mt-2 text-sm leading-relaxed text-gm-muted">
        {{ description }}
      </p>
      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          class="gm-soft-button rounded-full bg-gm-primary px-6 py-2.5 text-sm font-semibold text-white"
          @click="goHome"
        >
          Kembali ke Beranda
        </button>
        <button
          v-if="!isNotFound"
          type="button"
          class="gm-soft-button rounded-full border border-gm-surface-high px-6 py-2.5 text-sm font-semibold text-gm-text"
          @click="retry"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  </div>
</template>
