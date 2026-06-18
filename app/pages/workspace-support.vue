<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Id } from '@/lib/convex-types'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

const route = useRoute()
const router = useRouter()

const { data } = useConvexQuery(api.support.supportInbox, {})
const { mutate: createSupportRequest } = useConvexMutation(api.support.createSupportRequest)
const { mutate: sendSupportMessage } = useConvexMutation(api.support.sendSupportMessage)
const { mutate: closeSupportRequest } = useConvexMutation(api.support.closeSupportRequest)

const newTicketTopic = ref('')
const replyMessage = ref('')
const creatingTicket = ref(false)
const sendingReply = ref(false)
const closingTicket = ref(false)
const selectedRequestId = ref<string | null>(null)

const selectedRequest = computed(
  () =>
    data.value?.requests.find((request) => request._id === selectedRequestId.value) ??
    data.value?.requests[0] ??
    null,
)

watch(
  [() => data.value?.requests, () => route.query.ticketId],
  ([requests, ticketId]) => {
    if (!requests?.length) {
      selectedRequestId.value = null
      return
    }

    const requestedTicketId = typeof ticketId === 'string' ? ticketId : null
    if (requestedTicketId && requests.some((request) => request._id === requestedTicketId)) {
      selectedRequestId.value = requestedTicketId
      return
    }

    if (
      !selectedRequestId.value ||
      !requests.some((request) => request._id === selectedRequestId.value)
    ) {
      selectedRequestId.value = requests[0]._id
    }
  },
  { immediate: true },
)

async function handleCreateTicket() {
  if (!newTicketTopic.value.trim()) return
  creatingTicket.value = true
  try {
    const result = await createSupportRequest({ topic: newTicketTopic.value, priority: 'normal' })
    newTicketTopic.value = ''
    toast.success('Tiket dukungan dibuat')
    await router.replace({ path: '/workspace-support', query: { ticketId: result.requestId } })
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal membuat tiket'))
  } finally {
    creatingTicket.value = false
  }
}

async function handleSendReply() {
  if (!selectedRequest.value || !replyMessage.value.trim()) return
  sendingReply.value = true
  try {
    await sendSupportMessage({
      requestId: selectedRequest.value._id as Id<'supportRequests'>,
      body: replyMessage.value,
    })
    replyMessage.value = ''
    toast.success('Balasan terkirim')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mengirim balasan'))
  } finally {
    sendingReply.value = false
  }
}

async function selectTicket(ticketId: string) {
  selectedRequestId.value = ticketId
  await router.replace({ path: '/workspace-support', query: { ticketId } })
}

async function handleCloseTicket() {
  if (!selectedRequest.value || selectedRequest.value.status === 'closed') return
  if (
    !window.confirm(
      'Tutup tiket ini? Anda masih bisa membukanya lagi nanti dengan mengirim balasan baru.',
    )
  ) {
    return
  }

  closingTicket.value = true
  try {
    await closeSupportRequest({ requestId: selectedRequest.value._id as Id<'supportRequests'> })
    toast.success('Tiket ditutup')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menutup tiket'))
  } finally {
    closingTicket.value = false
  }
}
</script>

<template>
  <div v-if="data" class="space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Dukungan</p>
          <h1
            class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl"
          >
            Kotak masuk tiket
          </h1>
          <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">
            Halaman ini membantu Anda membuka tiket, memantau perkembangan penanganan, dan
            berdiskusi langsung dengan tim pendamping GrowMate.
          </p>
        </div>
        <button
          class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text"
          @click="router.push('/assistant')"
        >
          Kembali ke asisten
        </button>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <article
        class="space-y-4 rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
      >
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Buat tiket</div>
          <div class="mt-2 text-sm text-gm-muted">
            Tuliskan kebutuhan bantuan, kendala perangkat, atau hal yang perlu ditindaklanjuti.
          </div>
        </div>
        <label class="block">
          <span class="mb-2 block text-sm font-semibold text-gm-text">Topik bantuan</span>
          <textarea
            v-model="newTicketTopic"
            rows="4"
            class="w-full rounded-[1.5rem] bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
            placeholder="Apa yang Anda butuhkan bantuannya?"
          />
        </label>
        <button
          class="rounded-full bg-[#ffdbcf] px-5 py-3 text-sm font-bold text-[#795548] disabled:opacity-50"
          :disabled="creatingTicket"
          @click="handleCreateTicket"
        >
          {{ creatingTicket ? 'Membuat...' : 'Buat tiket' }}
        </button>

        <div class="pt-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-headline text-2xl font-bold text-gm-text">Daftar tiket aktif</h2>
            <span
              class="rounded-full bg-[#f3f3f3] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-text"
              >{{ data.activeCount }}</span
            >
          </div>
          <div class="mt-4 space-y-3">
            <button
              v-for="request in data.requests"
              :key="request._id"
              type="button"
              class="block w-full rounded-[1.5rem] p-4 text-left transition"
              :class="selectedRequest?._id === request._id ? 'bg-gm-primary/5' : 'bg-[#f7f7f7]'"
              @click="selectTicket(request._id)"
            >
              <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
              <div class="mt-1 text-xs uppercase tracking-[0.18em] text-gm-muted">
                {{ request.priority }} • {{ request.status.replaceAll('_', ' ') }}
              </div>
              <div class="mt-2 text-xs text-gm-muted">Diperbarui {{ request.updatedAtLabel }}</div>
            </button>
          </div>
        </div>
      </article>

      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div v-if="selectedRequest" class="space-y-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">
              Percakapan tiket
            </p>
            <h2 class="mt-2 font-headline text-2xl font-bold text-gm-text">
              {{ selectedRequest.topic }}
            </h2>
            <p class="mt-2 text-sm text-gm-muted">
              Status: {{ selectedRequest.status.replaceAll('_', ' ') }} • Prioritas:
              {{ selectedRequest.priority }}
            </p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              v-if="selectedRequest.status !== 'closed'"
              class="rounded-full bg-[#ffdbcf] px-5 py-3 text-sm font-bold text-[#795548] disabled:opacity-50"
              :disabled="closingTicket"
              @click="handleCloseTicket"
            >
              {{ closingTicket ? 'Menutup...' : 'Tutup tiket' }}
            </button>
          </div>

          <div class="space-y-3 rounded-[1.5rem] bg-[#f7f7f7] p-4">
            <div
              v-for="message in selectedRequest.messages"
              :key="message._id"
              class="flex"
              :class="message.mine ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-6"
                :class="
                  message.mine
                    ? 'bg-gm-primary text-white'
                    : message.senderRole === 'admin'
                      ? 'bg-[#e8f4ff] text-gm-text'
                      : 'bg-white text-gm-text'
                "
              >
                <div class="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">
                  {{
                    message.senderRole === 'admin'
                      ? 'Admin'
                      : message.senderRole === 'system'
                        ? 'Sistem'
                        : 'Anda'
                  }}
                </div>
                <div class="whitespace-pre-wrap">{{ message.body }}</div>
                <div class="mt-2 text-[11px] opacity-70">{{ message.createdAtLabel }}</div>
              </div>
            </div>
          </div>

          <div class="rounded-[1.5rem] bg-[#e8e8e8] p-2">
            <div class="flex items-end gap-3">
              <label class="flex-1">
                <span class="sr-only">Balasan</span>
                <textarea
                  v-model="replyMessage"
                  rows="2"
                  class="min-h-[56px] w-full resize-none rounded-[1.25rem] bg-white px-4 py-3 text-sm outline-none"
                  placeholder="Tulis balasan atau informasi tambahan untuk tim dukungan..."
                  @keyup.enter.exact.prevent="!sendingReply && handleSendReply()"
                />
              </label>
              <button
                class="rounded-full bg-gm-primary p-4 text-white disabled:opacity-50"
                aria-label="Kirim pesan"
                :disabled="sendingReply"
                @click="handleSendReply"
              >
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">{{
                  sendingReply ? 'hourglass_top' : 'send'
                }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="rounded-[1.5rem] bg-[#f7f7f7] p-5 text-sm text-gm-muted">
          Belum ada tiket. Buat satu untuk memulai percakapan dukungan.
        </div>
      </article>
    </section>
  </div>
</template>
