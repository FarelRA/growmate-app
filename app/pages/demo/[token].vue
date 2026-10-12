<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeAuthTokens } from '@/utils/auth'

definePageMeta({
  public: true,
})

usePublicSeo({
  title: 'GrowMate | Akun Demo',
  description: 'Buka akun demo GrowMate langsung dari tautan.',
  path: '/demo',
})

const route = useRoute()
const status = ref<'loading' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  const token = route.params.token
  const linkToken = Array.isArray(token) ? token[0] : token
  if (!linkToken) {
    status.value = 'error'
    errorMessage.value = 'Tautan demo tidak valid.'
    return
  }
  try {
    const result = await $fetch<{ token: string; refreshToken: string | null }>('/api/demo/login', {
      method: 'POST',
      body: { token: linkToken },
    })
    storeAuthTokens({ token: result.token, refreshToken: result.refreshToken ?? undefined })
    await navigateTo('/dashboard')
  } catch {
    status.value = 'error'
    errorMessage.value = 'Tautan demo tidak valid atau sudah kedaluwarsa.'
  }
})
</script>

<template>
  <section class="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4 text-center">
    <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">GrowMate</p>
    <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Akun Demo</h1>
    <div v-if="status === 'loading'" class="mt-6" role="status">
      <div class="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-gm-primary border-t-transparent" />
      <p class="mt-4 text-sm text-gm-muted">Membuka akun demo…</p>
    </div>
    <div v-else class="mt-6 rounded-[1.5rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p class="text-sm text-gm-muted">{{ errorMessage }}</p>
      <NuxtLink to="/login" class="mt-4 inline-block rounded-full bg-gm-primary px-6 py-2.5 text-sm font-bold text-white">
        Ke halaman masuk
      </NuxtLink>
    </div>
  </section>
</template>
