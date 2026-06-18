<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'
import { formatTierLabel } from '@/lib/glossary'
import type { ChatMessage } from '@/components/ChatThread.vue'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

const router = useRouter()

const { data: devices } = useConvexQuery(api.devices.userDevices, {})

watch(
  devices,
  (deviceList) => {
    if (!deviceList) return
    syncActiveDevice(deviceList)
  },
  { immediate: true },
)

const currentDeviceId = computed(
  () => activeDeviceId.value || devices.value?.[0]?.deviceId || undefined,
)

const { data } = useConvexQuery(
  api.assistant.assistant,
  computed(() => ({ deviceId: currentDeviceId.value })),
)

const { mutate: sendMessage } = useConvexMutation(api.assistant.sendAssistantMessage)
const { mutate: resetAssistantThread } = useConvexMutation(api.assistant.resetAssistantThread)

const messageInput = ref('')
const sending = ref(false)
const resetting = ref(false)

const tierLabel = computed(() => formatTierLabel(data.value?.user.tier ?? 'basic'))
const activeTickets = computed(() =>
  (data.value?.supportRequests ?? []).filter(
    (request) => request.status !== 'resolved' && request.status !== 'closed',
  ),
)

const introAssistantMessage: ChatMessage = {
  _id: '__intro__',
  role: 'assistant',
  status: 'done',
  body: data.value?.plant
    ? `# Floral Assistant\nSaya siap membantu mendampingi **${data.value.plant.name}** pada **${data.value.device?.name ?? 'perangkat aktif Anda'}**. Tanyakan tentang perawatan, gejala tanaman, tahap pertumbuhan, atau keputusan otomatisasi.`
    : '# Floral Assistant\nSaya siap membantu. Pilih perangkat aktif lalu tanyakan tentang perawatan tanaman, kendala budidaya, atau keputusan otomatisasi.',
}

const displayMessages = computed<ChatMessage[]>(() => {
  const messages = data.value?.messages ?? []
  return messages.length ? messages : [introAssistantMessage]
})

async function handleSendMessage() {
  if (!messageInput.value.trim()) return
  sending.value = true
  try {
    await sendMessage({ body: messageInput.value, deviceId: currentDeviceId.value })
    messageInput.value = ''
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mengirim pesan'))
  } finally {
    sending.value = false
  }
}

async function handleResetThread() {
  resetting.value = true
  try {
    await resetAssistantThread({})
    toast.success('Percakapan asisten direset')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mereset percakapan'))
  } finally {
    resetting.value = false
  }
}

async function openTicket(ticketId?: string) {
  await router.push({ path: '/workspace-support', query: { ticketId } })
}
</script>

<template>
  <div v-if="data" class="space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Asisten</p>
          <h1
            class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl"
          >
            <span class="italic text-gm-primary">mentor tanaman</span> pribadi Anda
          </h1>
          <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">
            Gunakan bagian ini untuk memilih perangkat aktif, memahami kapasitas penggunaan
            harian, dan menindaklanjuti kebutuhan dukungan dengan lebih cepat.
          </p>
        </div>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-[1fr_0.9fr_0.9fr]">
      <article class="rounded-[1.75rem] bg-[#f3f3f3] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-bold uppercase tracking-[0.2em] text-gm-muted"
            >Perangkat aktif</span
          >
          <span
            class="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-text"
            >{{ devices?.length ?? 0 }} terhubung</span
          >
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="device in devices"
            :key="device.deviceId"
            type="button"
            class="rounded-full px-4 py-2 text-xs font-bold transition-all"
            :class="
              device.deviceId === currentDeviceId
                ? 'bg-gm-primary text-white shadow-[0_10px_20px_rgba(0,110,28,0.18)]'
                : 'bg-white text-gm-muted'
            "
            @click="setActiveDeviceId(device.deviceId)"
          >
            {{ device.name }}
          </button>
        </div>
      </article>

      <article class="rounded-[1.75rem] bg-[#f3f3f3] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div class="text-xs font-bold uppercase tracking-[0.2em] text-gm-muted">
          Paket dan batas
        </div>
        <div class="mt-3 text-2xl font-black text-gm-text">{{ tierLabel }}</div>
        <div class="mt-2 text-sm text-gm-muted">
          {{ data.quota.remainingToday }} pesan tersisa hari ini
        </div>
        <div class="mt-1 text-xs text-gm-muted">
          {{ data.quota.usedToday }} / {{ data.quota.limit }} terpakai hari ini
        </div>
      </article>

      <article class="rounded-[1.75rem] bg-[#f3f3f3] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-bold uppercase tracking-[0.2em] text-gm-muted"
            >Tiket dukungan</span
          >
          <span
            class="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-text"
            >{{ activeTickets.length }}</span
          >
        </div>
        <div class="mt-4 space-y-2">
          <button
            v-for="request in activeTickets.slice(0, 2)"
            :key="request._id"
            type="button"
            class="block w-full rounded-[1rem] bg-white px-4 py-3 text-left transition hover:bg-gm-primary/5"
            @click="openTicket(request._id)"
          >
            <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
            <div class="mt-1 text-[11px] uppercase tracking-[0.18em] text-gm-muted">
              {{ request.priority }} • {{ request.status.replaceAll('_', ' ') }}
            </div>
          </button>
          <button
            type="button"
            class="w-full rounded-full bg-white px-4 py-3 text-sm font-bold text-gm-text"
            @click="openTicket()"
          >
            Buka tiket
          </button>
        </div>
      </article>
    </section>

    <section v-if="data.recommendations.length" class="grid gap-4 md:grid-cols-3">
      <article
        v-for="card in data.recommendations"
        :key="`${card.title}-${card.sort}`"
        class="rounded-[1.75rem] p-4"
        :class="card.accent"
      >
        <p class="text-xs font-bold uppercase tracking-[0.2em]">Rekomendasi</p>
        <p class="mt-2 text-sm font-semibold">{{ card.title }}</p>
        <p class="mt-2 text-xs leading-relaxed">{{ card.detail }}</p>
      </article>
    </section>

    <section v-if="!data.plant" class="rounded-[1.75rem] bg-[#f3f3f3] p-6 text-center">
      <span class="material-symbols-outlined text-5xl text-gm-primary">spa</span>
      <h2 class="mt-4 font-headline text-2xl font-bold text-gm-text">
        Pilih tanaman untuk perangkat ini
      </h2>
      <p class="mt-2 text-sm text-gm-muted">
          Floral Assistant akan memberi saran yang jauh lebih relevan setelah perangkat aktif
          memiliki profil tanaman yang sedang dibudidayakan.
      </p>
      <button
        class="mt-5 rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white"
        @click="
          router.push({
            path: '/select-plant',
            query: { deviceId: data.device?.deviceId, returnTo: '/assistant' },
          })
        "
      >
        Pilih Tanaman
      </button>
    </section>

    <section class="space-y-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">
            Floral Assistant
          </p>
          <h2 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">
            Percakapan
          </h2>
          <p class="mt-2 text-sm text-gm-muted">
            Gunakan percakapan ini untuk memahami kondisi tanaman, menentukan langkah perawatan,
            dan mengambil keputusan budidaya dengan lebih percaya diri.
          </p>
        </div>
        <button
          class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text disabled:opacity-50"
          :disabled="resetting"
          @click="handleResetThread"
        >
          {{ resetting ? 'Mereset...' : 'Reset percakapan' }}
        </button>
      </div>

      <ChatThread :messages="displayMessages" />

      <ChatInput
        v-model="messageInput"
        :sending="sending"
        :disabled="(data.quota.remainingToday ?? 0) <= 0"
        @send="handleSendMessage"
      />

      <div v-if="(data.quota.remainingToday ?? 0) <= 0" class="text-center text-xs text-gm-muted">
        Batas harian untuk paket {{ tierLabel.toLowerCase() }} telah tercapai. Hubungi admin jika
        langganan Anda perlu diubah.
      </div>
    </section>
  </div>
</template>
