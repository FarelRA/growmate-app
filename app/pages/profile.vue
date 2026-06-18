<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { signOutCurrentUser } from '@/lib/auth'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { formatRoleLabel, formatTierLabel } from '@/lib/glossary'

definePageMeta({
  requiresAuth: true,
})

const router = useRouter()

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

const isAdmin = computed(() => profile.value?.role === 'admin')

watch(
  profile,
  (value) => {
    if (!value) return
    form.value = {
      name: value.name,
      handle: value.handle,
      avatar: value.avatar,
      role: value.role === 'company' ? 'company' : 'grower',
    }
  },
  { immediate: true },
)

async function handleSave() {
  saving.value = true
  try {
    await updateProfile({
      name: form.value.name,
      handle: form.value.handle,
      avatar: form.value.avatar.trim() || undefined,
      role: isAdmin.value ? undefined : form.value.role,
    })
    toast.success('Profil diperbarui')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memperbarui profil'))
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
  await router.replace(isAdmin.value ? '/admin' : '/dashboard')
}
</script>

<template>
  <div v-if="profile" class="mx-auto max-w-3xl space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Profil</p>
          <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">
            Pengaturan akun
          </h1>
          <p class="mt-2 text-sm text-gm-muted">
            Halaman ini membantu Anda memperbarui identitas akun yang digunakan pada aktivitas
            budidaya, komunitas, dan interaksi di dalam GrowMate.
          </p>
        </div>
        <button
          class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text"
          @click="handleBack"
        >
          Kembali
        </button>
      </div>
    </section>

    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <div class="grid gap-5 md:grid-cols-2">
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Email</span>
          <input
            :value="profile.email"
            disabled
            class="w-full rounded-2xl bg-[#f3f3f3] px-4 py-3 text-sm text-gm-muted outline-none"
          />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Jenis akses</span>
          <input
            :value="formatTierLabel(profile.tier)"
            disabled
            class="w-full rounded-2xl bg-[#f3f3f3] px-4 py-3 text-sm text-gm-muted outline-none"
          />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Nama lengkap</span>
          <input
            v-model="form.name"
            class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary"
          />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Nama pengguna</span>
          <input
            v-model="form.handle"
            class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary"
          />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Inisial profil</span>
          <input
            v-model="form.avatar"
            maxlength="2"
            class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm uppercase outline-none transition focus:border-gm-primary"
          />
        </label>
        <label>
          <span class="mb-2 block text-sm font-semibold text-gm-text">Peran</span>
          <select
            v-model="form.role"
            :disabled="isAdmin"
            class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary disabled:bg-[#f3f3f3] disabled:text-gm-muted"
          >
            <option value="grower">{{ formatRoleLabel('grower') }}</option>
            <option value="company">{{ formatRoleLabel('company') }}</option>
          </select>
        </label>
      </div>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          class="rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          :disabled="saving"
          @click="handleSave"
        >
          {{ saving ? 'Menyimpan...' : 'Simpan profil' }}
        </button>
        <button
          class="rounded-full bg-[#ffdbcf] px-6 py-3 text-sm font-bold text-[#795548] disabled:opacity-50"
          :disabled="loggingOut"
          @click="handleLogout"
        >
          {{ loggingOut ? 'Sedang keluar...' : 'Keluar' }}
        </button>
      </div>
    </section>
  </div>
</template>
