<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { fetchSetupStatus, signInWithPassword } from '@/lib/auth'
import { getErrorMessage } from '@/lib/errors'
import { getSetupRoute } from '@/lib/setup'

definePageMeta({
  public: true,
  redirectIfAuthenticated: true,
})

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    toast.error('Harap isi semua kolom')
    return
  }
  loading.value = true
  try {
    await signInWithPassword('signIn', email.value, password.value)
    const status = await fetchSetupStatus()
    toast.success('Berhasil masuk')
    await router.replace(status ? getSetupRoute(status) : '/dashboard')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Email atau kata sandi tidak valid'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-8"
  >
    <section
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">GrowMate</p>
      <h1 class="mt-3 font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl">
        Kembali ke <span class="italic text-gm-primary">rumah kaca digital</span>.
      </h1>
      <p class="mt-4 max-w-xl text-sm leading-relaxed text-gm-muted">
        Lanjutkan aktivitas Anda dengan perawatan berbasis perangkat, panduan asisten, dan ekosistem
        GrowMate lengkap di satu tempat.
      </p>
    </section>

    <section
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Masuk</p>
        <h2 class="mt-3 font-headline text-3xl font-black tracking-tight text-gm-text">
          Selamat datang kembali
        </h2>
        <p class="mt-2 text-sm text-gm-muted">
          Masuk untuk melanjutkan pemantauan, perawatan, dan pengelolaan budidaya Anda.
        </p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleLogin">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Email</span>
          <input
            v-model="email"
            type="email"
            required
            class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20"
            placeholder="nama@contoh.com"
          />
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Kata Sandi</span>
          <input
            v-model="password"
            type="password"
            required
            class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20"
            placeholder="Kata sandi Anda"
          />
        </label>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)] disabled:opacity-50"
        >
          {{ loading ? 'Sedang masuk...' : 'Masuk' }}
        </button>
      </form>

      <div class="mt-6 text-sm text-gm-muted">
        Belum punya akun?
        <router-link to="/register" class="font-bold text-gm-primary">Buat akun</router-link>
      </div>
    </section>
  </div>
</template>
