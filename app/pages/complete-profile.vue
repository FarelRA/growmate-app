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
    toast.error('Harap isi semua kolom wajib')
    return
  }

  loading.value = true
  try {
    await completeProfile({
      name: name.value,
      handle: handle.value,
      role: role.value as 'grower' | 'company',
      avatar:
        avatar.value ||
        name.value
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase(),
    })

    toast.success('Profil berhasil diperbarui')
    router.push('/claim-device')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal melengkapi profil'))
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div
    class="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_1fr] lg:px-6 lg:py-8"
  >
    <section
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Setup</p>
      <h1 class="mt-3 font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl">
        Lengkapi <span class="italic text-gm-primary">identitas akun</span> Anda.
      </h1>
      <p class="mt-4 max-w-xl text-sm leading-relaxed text-gm-muted">
        Informasi ini membantu GrowMate menyesuaikan pengalaman penggunaan, identitas komunitas, dan
        pengelolaan aktivitas budidaya Anda.
      </p>

      <div class="mt-8 grid gap-4 sm:grid-cols-2">
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Terlihat</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">
            Nama, handle, peran, dan inisial avatar
          </div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Langkah berikutnya
          </div>
          <div class="mt-2 text-sm font-semibold text-gm-text">
            Hubungkan perangkat GrowMate pertama Anda
          </div>
        </article>
      </div>
    </section>

    <section
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Detail Profil</p>
        <h2 class="mt-3 font-headline text-3xl font-black tracking-tight text-gm-text">
          Kenalkan diri Anda
        </h2>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleCompleteProfile">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Nama Lengkap</span>
          <input
            v-model="name"
            type="text"
            required
            class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20"
          />
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Nama pengguna</span>
          <input
            v-model="handle"
            type="text"
            required
            class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20"
            placeholder="contoh: john.gardener"
          />
          <span class="mt-2 block text-xs text-gm-muted"
            >Nama pengguna ini akan tampil saat Anda berbagi cerita atau aktivitas di komunitas.</span
          >
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Peran</span>
          <select
            v-model="role"
            class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20"
          >
            <option value="grower">Petani Individu</option>
            <option value="company">Perusahaan Pertanian</option>
          </select>
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Inisial profil</span>
          <input
            v-model="avatar"
            type="text"
            maxlength="2"
            class="w-full rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm uppercase outline-none transition focus:ring-2 focus:ring-gm-primary/20"
            placeholder="contoh: JR"
          />
        </label>

        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)] disabled:opacity-50"
        >
          {{ loading ? 'Menyimpan profil...' : 'Simpan dan Lanjutkan' }}
        </button>
      </form>
    </section>
  </div>
</template>
