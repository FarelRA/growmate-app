<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

const route = useRoute()
const router = useRouter()

const { data } = useConvexQuery(api.growmate.supportInbox, {})
const { mutate: createSupportRequest } = useConvexMutation(api.growmate.createSupportRequest)
const { mutate: sendSupportMessage } = useConvexMutation(api.growmate.sendSupportMessage)
const { mutate: closeSupportRequest } = useConvexMutation(api.growmate.closeSupportRequest)

const newTicketTopic = ref('')
const replyMessage = ref('')
const creatingTicket = ref(false)
const sendingReply = ref(false)
const closingTicket = ref(false)
const selectedRequestId = ref<string | null>(null)

const selectedRequest = computed(() => data.value?.requests.find((request) => request._id === selectedRequestId.value) ?? data.value?.requests[0] ?? null)

watch([() => data.value?.requests, () => route.query.ticketId], ([requests, ticketId]) => {
  if (!requests?.length) {
    selectedRequestId.value = null
    return
  }

  const requestedTicketId = typeof ticketId === 'string' ? ticketId : null
  if (requestedTicketId && requests.some((request) => request._id === requestedTicketId)) {
    selectedRequestId.value = requestedTicketId
    return
  }

  if (!selectedRequestId.value || !requests.some((request) => request._id === selectedRequestId.value)) {
    selectedRequestId.value = requests[0]._id
  }
}, { immediate: true })

async function handleCreateTicket() {
  if (!newTicketTopic.value.trim()) return
  creatingTicket.value = true
  try {
    const result = await createSupportRequest({ topic: newTicketTopic.value, priority: 'normal' })
    newTicketTopic.value = ''
    toast.success('Support ticket created')
    await router.replace({ path: '/support', query: { ticketId: result.requestId } })
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to create ticket'))
  } finally {
    creatingTicket.value = false
  }
}

async function handleSendReply() {
  if (!selectedRequest.value || !replyMessage.value.trim()) return
  sendingReply.value = true
  try {
    await sendSupportMessage({
      requestId: selectedRequest.value._id as never,
      body: replyMessage.value,
    })
    replyMessage.value = ''
    toast.success('Reply sent')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to send reply'))
  } finally {
    sendingReply.value = false
  }
}

async function selectTicket(ticketId: string) {
  selectedRequestId.value = ticketId
  await router.replace({ path: '/support', query: { ticketId } })
}

async function handleCloseTicket() {
  if (!selectedRequest.value || selectedRequest.value.status === 'closed') return
  if (!window.confirm('Close this ticket? You can still reopen it later by sending a new reply.')) {
    return
  }

  closingTicket.value = true
  try {
    await closeSupportRequest({ requestId: selectedRequest.value._id as never })
    toast.success('Ticket closed')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to close ticket'))
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
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Support</p>
          <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl">Ticket inbox</h1>
          <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">Open a ticket, track status changes, and chat directly with admins from a dedicated support thread view.</p>
        </div>
        <button class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text" @click="router.push('/assistant')">Back to assistant</button>
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <article class="space-y-4 rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div>
          <div class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Create ticket</div>
          <div class="mt-2 text-sm text-gm-muted">Describe the current issue or follow-up you need help with.</div>
        </div>
        <textarea v-model="newTicketTopic" rows="4" class="w-full rounded-[1.5rem] bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="What do you need help with?" />
        <button class="rounded-full bg-[#ffdbcf] px-5 py-3 text-sm font-bold text-[#795548] disabled:opacity-50" :disabled="creatingTicket" @click="handleCreateTicket">{{ creatingTicket ? 'Creating...' : 'Create ticket' }}</button>

        <div class="pt-4">
          <div class="flex items-center justify-between gap-3">
            <h2 class="font-headline text-2xl font-bold text-gm-text">Open tickets</h2>
            <span class="rounded-full bg-[#f3f3f3] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-text">{{ data.activeCount }}</span>
          </div>
          <div class="mt-4 space-y-3">
            <button v-for="request in data.requests" :key="request._id" type="button" class="block w-full rounded-[1.5rem] p-4 text-left transition" :class="selectedRequest?._id === request._id ? 'bg-gm-primary/5' : 'bg-[#f7f7f7]'" @click="selectTicket(request._id)">
              <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
              <div class="mt-1 text-xs uppercase tracking-[0.18em] text-gm-muted">{{ request.priority }} • {{ request.status.replaceAll('_', ' ') }}</div>
              <div class="mt-2 text-xs text-gm-muted">Updated {{ request.updatedAtLabel }}</div>
            </button>
          </div>
        </div>
      </article>

      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div v-if="selectedRequest" class="space-y-4">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Ticket thread</p>
            <h2 class="mt-2 font-headline text-2xl font-bold text-gm-text">{{ selectedRequest.topic }}</h2>
            <p class="mt-2 text-sm text-gm-muted">Status: {{ selectedRequest.status.replaceAll('_', ' ') }} • Priority: {{ selectedRequest.priority }}</p>
          </div>

          <div class="flex flex-wrap gap-3">
            <button v-if="selectedRequest.status !== 'closed'" class="rounded-full bg-[#ffdbcf] px-5 py-3 text-sm font-bold text-[#795548] disabled:opacity-50" :disabled="closingTicket" @click="handleCloseTicket">
              {{ closingTicket ? 'Closing...' : 'Close ticket' }}
            </button>
          </div>

          <div class="space-y-3 rounded-[1.5rem] bg-[#f7f7f7] p-4">
            <div v-for="message in selectedRequest.messages" :key="message._id" class="flex" :class="message.mine ? 'justify-end' : 'justify-start'">
              <div class="max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-6" :class="message.mine ? 'bg-gm-primary text-white' : message.senderRole === 'admin' ? 'bg-[#e8f4ff] text-gm-text' : 'bg-white text-gm-text'">
                <div class="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">{{ message.senderRole === 'admin' ? 'Admin' : message.senderRole === 'system' ? 'System' : 'You' }}</div>
                <div class="whitespace-pre-wrap">{{ message.body }}</div>
                <div class="mt-2 text-[11px] opacity-70">{{ message.createdAtLabel }}</div>
              </div>
            </div>
          </div>

          <div class="rounded-[1.5rem] bg-[#e8e8e8] p-2">
            <div class="flex items-end gap-3">
              <textarea v-model="replyMessage" rows="2" class="min-h-[56px] flex-1 resize-none rounded-[1.25rem] bg-white px-4 py-3 text-sm outline-none" placeholder="Reply to support..." @keyup.enter.exact.prevent="!sendingReply && handleSendReply()" />
              <button class="rounded-full bg-gm-primary p-4 text-white disabled:opacity-50" :disabled="sendingReply" @click="handleSendReply">
                <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">{{ sendingReply ? 'hourglass_top' : 'send' }}</span>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="rounded-[1.5rem] bg-[#f7f7f7] p-5 text-sm text-gm-muted">
          No tickets yet. Create one to start a support conversation.
        </div>
      </article>
    </section>
  </div>
</template>
