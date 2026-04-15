<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { useConvexMutation } from '@convex-vue/core'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

definePageMeta({
  requiresAuth: true,
  onboarding: true,
})

const router = useRouter()
const name = ref('')
const handle = ref('')
const role = ref('grower')
const avatar = ref('')
const loading = ref(false)

const { mutate: completeProfile } = useConvexMutation(api.growmate.completeProfile)

async function handleCompleteProfile() {
  if (!name.value || !handle.value) {
    toast.error('Please fill in all required fields')
    return
  }

  loading.value = true
  try {
    await completeProfile({
      name: name.value,
      handle: handle.value,
      role: role.value as 'grower' | 'company',
      avatar: avatar.value || name.value.split(' ').map((n) => n[0]).join('').toUpperCase(),
    })

    toast.success('Profile updated successfully')
    router.push('/claim-device')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to complete profile'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_1fr] lg:px-6 lg:py-8">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10">
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Setup</p>
      <h1 class="mt-3 font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl">Complete your <span class="italic text-gm-primary">profile</span>.</h1>
      <p class="mt-4 max-w-xl text-sm leading-relaxed text-gm-muted">Set the public identity that appears around GrowMate. Subscription is fixed to basic by default and managed outside this screen.</p>

      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Visible</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">Name, handle, role, and avatar initials</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Next step</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">Link your first GrowMate device</div>
        </article>
      </div>
    </section>

    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Profile Details</p>
        <h2 class="mt-3 font-headline text-3xl font-black tracking-tight text-gm-text">Tell us about yourself</h2>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleCompleteProfile">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Full Name</span>
          <input v-model="name" type="text" required class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20" />
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Username / Handle</span>
          <input v-model="handle" type="text" required class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20" placeholder="e.g. john.gardener" />
          <span class="mt-2 block text-xs text-gm-muted">This appears on your public activity in community features.</span>
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Role</span>
          <select v-model="role" class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20">
            <option value="grower">Individual Grower</option>
            <option value="company">Agricultural Company</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Avatar Initials</span>
          <input v-model="avatar" type="text" maxlength="2" class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm uppercase outline-none transition focus:ring-2 focus:ring-gm-primary/20" placeholder="e.g. JR" />
        </label>

        <button type="submit" :disabled="loading" class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)] disabled:opacity-50">
          {{ loading ? 'Saving profile...' : 'Complete Profile' }}
        </button>
      </form>
    </section>
  </div>
</template>
