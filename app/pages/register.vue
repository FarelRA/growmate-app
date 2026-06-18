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

async function handleRegister() {
  if (!email.value || !password.value) {
    toast.error('Harap isi semua kolom')
    return
  }
  if (password.value.length < 8) {
    toast.error('Kata sandi minimal 8 karakter')
    return
  }

  loading.value = true
  try {
    await signInWithPassword('signUp', email.value, password.value)
    const status = await fetchSetupStatus()
    toast.success('Akun berhasil dibuat')
    await router.replace(status ? getSetupRoute(status) : '/complete-profile')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Pendaftaran gagal'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-6 lg:py-8"
  >
    <section
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Daftar</p>
      <h1 class="mt-3 font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl">
        Mulai <span class="italic text-gm-primary">perjalanan budidaya cerdas</span> Anda.
      </h1>
      <p class="mt-4 max-w-xl text-sm leading-relaxed text-gm-muted">
        Buat akun terlebih dulu, lalu lengkapi profil dan hubungkan perangkat pertama Anda dalam
        alur terpandu yang sama.
      </p>

      <div class="mt-8 space-y-4">
        <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Langkah 1</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">Buat kredensial akun</div>
        </div>
        <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Langkah 2</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">Lengkapi detail profil</div>
        </div>
        <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Langkah 3</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">
            Hubungkan perangkat dan pilih tanaman
          </div>
        </div>
      </div>
    </section>

    <section
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Buat Akun</p>
        <h2 class="mt-3 font-headline text-3xl font-black tracking-tight text-gm-text">
          Gabung ke GrowMate
        </h2>
        <p class="mt-2 text-sm text-gm-muted">
          Atur akses awal Anda. Setelah itu, Anda dapat melanjutkan ke profil, perangkat, dan
          tanaman yang ingin dipantau.
        </p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleRegister">
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
            minlength="8"
            class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20"
            placeholder="Minimal 8 karakter"
          />
          <span class="mt-2 block text-xs text-gm-muted">Gunakan minimal 8 karakter.</span>
        </label>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)] disabled:opacity-50"
        >
          {{ loading ? 'Sedang membuat akun...' : 'Buat Akun' }}
        </button>
      </form>

      <div class="mt-6 text-sm text-gm-muted">
        Sudah punya akun?
        <router-link to="/login" class="font-bold text-gm-primary">Masuk</router-link>
      </div>
    </section>
  </div>
</template>
