<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { signInWithPassword } from '@/lib/auth'
import { getErrorMessage } from '@/lib/errors'

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
    toast.error('Please fill in all fields')
    return
  }
  loading.value = true
  try {
    await signInWithPassword('signIn', email.value, password.value)
    toast.success('Logged in successfully')
    await router.replace('/dashboard')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Invalid email or password'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-6 lg:py-8">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10">
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">GrowMate</p>
      <h1 class="mt-3 font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl">Return to the <span class="italic text-gm-primary">digital greenhouse</span>.</h1>
      <p class="mt-4 max-w-xl text-sm leading-relaxed text-gm-muted">Pick up where you left off with device-aware care, assistant guidance, and the full GrowMate ecosystem in one place.</p>
    </section>

    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Login</p>
        <h2 class="mt-3 font-headline text-3xl font-black tracking-tight text-gm-text">Welcome back</h2>
        <p class="mt-2 text-sm text-gm-muted">Sign in to continue to your GrowMate workspace.</p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleLogin">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Email</span>
          <input v-model="email" type="email" required class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20" placeholder="you@example.com" />
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Password</span>
          <input v-model="password" type="password" required class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20" placeholder="Your password" />
        </label>

        <button type="submit" :disabled="loading" class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)] disabled:opacity-50">
          {{ loading ? 'Signing in...' : 'Sign In' }}
        </button>
      </form>

      <div class="mt-6 text-sm text-gm-muted">
        New here?
        <router-link to="/register" class="font-bold text-gm-primary">Create an account</router-link>
      </div>
    </section>
  </div>
</template>
