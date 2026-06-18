<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useConvexMutation } from '@convex-vue/core'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/lib/api'
import { setActiveDeviceId } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'

definePageMeta({
  requiresAuth: true,
  onboarding: true,
})

const route = useRoute()
const router = useRouter()
const deviceId = ref('')
const loading = ref(false)
const checkingDevice = ref(false)
const unclaimedDevice = ref<{ deviceId: string; name: string; firmwareVersion?: string } | null>(
  null,
)

const convexClient = new ConvexHttpClient(useRuntimeConfig().public.convexUrl)
const { mutate: claimDevice } = useConvexMutation(api.users.claimDevice)

const manualLinking = computed(() => route.query.manual === '1')
const pageTitle = computed(() =>
  manualLinking.value ? 'Tambahkan perangkat GrowMate lain' : 'Hubungkan perangkat GrowMate pertama Anda',
)
const pageDescription = computed(() =>
  manualLinking.value
    ? 'Masukkan ID perangkat untuk menambahkan perangkat baru ke akun dan melanjutkan pengelolaan budidaya dari satu tempat.'
    : 'Masukkan ID perangkat yang tercetak pada perangkat agar GrowMate dapat mulai memantau dan menyesuaikan perawatan tanaman Anda.',
)

watch(deviceId, (value) => {
  if (unclaimedDevice.value && value.trim() !== unclaimedDevice.value.deviceId) {
    unclaimedDevice.value = null
  }
})

async function checkDevice() {
  const trimmed = deviceId.value.trim()
  if (!trimmed) {
    toast.error('Harap masukkan ID perangkat')
    return
  }

  checkingDevice.value = true
  try {
    const result = await convexClient.query(api.devices.getUnclaimedDevice, { deviceId: trimmed })
    unclaimedDevice.value = result
    if (result) {
      toast.success(`Perangkat ditemukan: ${unclaimedDevice.value.name}`)
    } else {
      toast.error('Perangkat tidak ditemukan atau sudah diklaim')
    }
  } finally {
    checkingDevice.value = false
  }
}

async function handleClaimDevice() {
  if (!deviceId.value.trim()) {
    toast.error('Harap masukkan ID perangkat')
    return
  }

  if (!unclaimedDevice.value) {
    toast.error('Harap verifikasi ID perangkat terlebih dahulu')
    return
  }

  loading.value = true
  try {
    await claimDevice({
      deviceId: deviceId.value.trim(),
    })

    setActiveDeviceId(deviceId.value.trim())
    toast.success('Perangkat berhasil diklaim. Pilih tanaman berikutnya.')
    router.push({
      path: '/select-plant',
      query: {
        deviceId: deviceId.value.trim(),
        onboarding: manualLinking.value ? undefined : '1',
        returnTo: manualLinking.value ? '/dashboard' : undefined,
      },
    })
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mengklaim perangkat'))
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
      <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Setup Perangkat</p>
      <h1 class="mt-3 font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl">
        {{ pageTitle }}
      </h1>
      <p class="mt-4 max-w-xl text-sm leading-relaxed text-gm-muted">{{ pageDescription }}</p>

      <div class="mt-8 space-y-4">
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Tempat menemukannya
          </div>
          <div class="mt-2 text-sm font-semibold text-gm-text">
            Lihat label pada perangkat atau kemasan produk GrowMate.
          </div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Contoh</div>
          <div class="mt-2 text-sm font-semibold text-gm-text">ESP32_DEMO_001</div>
        </article>
        <article v-if="unclaimedDevice" class="rounded-[1.5rem] bg-[#e8ffe8] p-4 text-[#005313]">
          <div class="text-xs font-bold uppercase tracking-[0.18em]">Terverifikasi</div>
          <div class="mt-2 text-sm font-semibold">{{ unclaimedDevice.name }}</div>
          <div class="mt-1 text-xs">
            Firmware {{ unclaimedDevice.firmwareVersion || 'Tidak diketahui' }}
          </div>
        </article>
      </div>
    </section>

    <section
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8 lg:p-10"
    >
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Hubungkan Perangkat</p>
        <h2 class="mt-3 font-headline text-3xl font-black tracking-tight text-gm-text">
          Masukkan ID perangkat Anda
        </h2>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleClaimDevice">
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">ID Perangkat</span>
          <div class="flex gap-3">
            <input
              v-model="deviceId"
              type="text"
              required
              class="flex-1 rounded-[1.25rem] bg-[#f7f7f7] px-4 py-4 text-sm outline-none transition focus:ring-2 focus:ring-gm-primary/20"
              placeholder="ESP32_DEMO_001"
            />
            <button
              type="button"
              @click="checkDevice"
              :disabled="checkingDevice"
              class="rounded-full bg-[#f3f3f3] px-5 py-4 text-sm font-bold text-gm-text disabled:opacity-50"
            >
              {{ checkingDevice ? 'Memeriksa...' : 'Verifikasi' }}
            </button>
          </div>
        </label>

        <button
          type="submit"
          :disabled="loading || !unclaimedDevice"
          class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)] disabled:opacity-50"
        >
          {{ loading ? 'Menghubungkan perangkat...' : 'Hubungkan Perangkat dan Lanjutkan' }}
        </button>
      </form>
    </section>
  </div>
</template>
