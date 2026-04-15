<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { signInWithPassword } from '@/lib/auth'
import { getErrorMessage } from '@/lib/errors'

definePageMeta({
  public: true,
})

const router = useRouter()
const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleRegister() {
  if (!email.value || !password.value) {
    toast.error('Please fill in all fields')
    return
  }
  if (password.value.length < 8) {
    toast.error('Password must be at least 8 characters')
    return
  }

  loading.value = true
  try {
    await signInWithPassword('signUp', email.value, password.value)
    toast.success('Account created successfully')
    await router.replace('/complete-profile')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Registration failed'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-6 lg:py-8">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10">
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Register</p>
      <h1 class="mt-3 font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl">Start your <span class="italic text-gm-primary">GrowMate setup</span>.</h1>
      <p class="mt-4 max-w-xl text-sm leading-relaxed text-gm-muted">Create your account first, then complete your profile and connect your first device in the same guided flow.</p>

      <div class="mt-8 space-y-4">
        <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Step 1</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">Create account credentials</div>
        </div>
        <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Step 2</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">Complete profile details</div>
        </div>
        <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Step 3</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">Link a device and choose a plant</div>
        </div>
      </div>
    </section>

    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Create Account</p>
        <h2 class="mt-3 font-headline text-3xl font-black tracking-tight text-gm-text">Join GrowMate</h2>
        <p class="mt-2 text-sm text-gm-muted">Set your login credentials. Your subscription defaults to basic and can only be changed by admins.</p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleRegister">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Email</span>
          <input v-model="email" type="email" required class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20" placeholder="you@example.com" />
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Password</span>
          <input v-model="password" type="password" required minlength="8" class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20" placeholder="At least 8 characters" />
          <span class="mt-2 block text-xs text-gm-muted">Use at least 8 characters.</span>
        </label>

        <button type="submit" :disabled="loading" class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)] disabled:opacity-50">
          {{ loading ? 'Creating account...' : 'Create Account' }}
        </button>
      </form>

      <div class="mt-6 text-sm text-gm-muted">
        Already have an account?
        <router-link to="/login" class="font-bold text-gm-primary">Sign in</router-link>
      </div>
    </section>
  </div>
</template>
