<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { signOutCurrentUser } from '@/lib/auth'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { getSetupRoute } from '@/lib/setup'

const router = useRouter()

const { data: setupStatus } = useConvexQuery(api.growmate.checkSetupStatus, {})
const { data: profile } = useConvexQuery(api.growmate.currentUserProfile, {})
const { mutate: updateProfile } = useConvexMutation(api.growmate.updateCurrentUserProfile)

const form = ref({
  name: '',
  handle: '',
  avatar: '',
  role: 'grower' as 'grower' | 'company',
})
const saving = ref(false)
const loggingOut = ref(false)

const isAdmin = computed(() => Boolean(setupStatus.value?.isAdmin))

watch(setupStatus, async (status) => {
  if (!status) return
  if (!status.authenticated) {
    await router.replace('/login')
  }
}, { immediate: true })

watch(profile, (value) => {
  if (!value) return
  form.value = {
    name: value.name,
    handle: value.handle,
    avatar: value.avatar,
    role: value.role === 'company' ? 'company' : 'grower',
  }
}, { immediate: true })

async function handleSave() {
  saving.value = true
  try {
    await updateProfile({
      name: form.value.name,
      handle: form.value.handle,
      avatar: form.value.avatar.trim() || undefined,
      role: isAdmin.value ? undefined : form.value.role,
    })
    toast.success('Profile updated')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to update profile'))
  } finally {
    saving.value = false
  }
}

async function handleLogout() {
  loggingOut.value = true
  try {
    await signOutCurrentUser()
    await router.replace('/login')
  } finally {
    loggingOut.value = false
  }
}

async function handleBack() {
  await router.replace(getSetupRoute(setupStatus.value))
}
</script>

<template>
  <div v-if="profile" class="mx-auto max-w-3xl space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Profile</p>
          <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Account settings</h1>
          <p class="mt-2 text-sm text-gm-muted">Only user-changeable settings live here. Subscription and ecosystem controls stay admin-managed.</p>
        </div>
        <button class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text" @click="handleBack">Back</button>
      </div>
    </section>

    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <div class="grid gap-5 md:grid-cols-2">
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Email</span>
          <input :value="profile.email" disabled class="w-full rounded-2xl bg-[#f3f3f3] px-4 py-3 text-sm text-gm-muted outline-none" />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Subscription</span>
          <input :value="profile.tier" disabled class="w-full rounded-2xl bg-[#f3f3f3] px-4 py-3 text-sm capitalize text-gm-muted outline-none" />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Full name</span>
          <input v-model="form.name" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary" />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Handle</span>
          <input v-model="form.handle" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary" />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Avatar initials</span>
          <input v-model="form.avatar" maxlength="2" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm uppercase outline-none transition focus:border-gm-primary" />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Role</span>
          <select v-model="form.role" :disabled="isAdmin" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary disabled:bg-[#f3f3f3] disabled:text-gm-muted">
            <option value="grower">Individual Grower</option>
            <option value="company">Agricultural Company</option>
          </select>
        </label>
      </div>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row">
        <button class="rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="saving" @click="handleSave">
          {{ saving ? 'Saving...' : 'Save profile' }}
        </button>
        <button class="rounded-full bg-[#ffdbcf] px-6 py-3 text-sm font-bold text-[#795548] disabled:opacity-50" :disabled="loggingOut" @click="handleLogout">
          {{ loggingOut ? 'Logging out...' : 'Logout' }}
        </button>
      </div>
    </section>
  </div>
</template>
