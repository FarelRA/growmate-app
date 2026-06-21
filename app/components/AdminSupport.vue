<script setup lang="ts">
const props = defineProps<{
  supportQueue: { _id: string; topic: string; userName: string; status: 'open' | 'in_progress' | 'resolved' | 'closed'; priority: 'low' | 'normal' | 'high' | 'urgent' }[]
  selectedSupportRequest: {
    _id: string
    topic: string
    userName: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    priority: 'low' | 'normal' | 'high' | 'urgent'
    messages: { _id: string; senderRole: string; senderName: string; createdAtLabel: string; body: string }[]
  } | null
  selectedSupportRequestId: string | null
  supportReplyInput: string
  updatingTicketId: string | null
  sendingTicketMessage: boolean
}>()
const emit = defineEmits<{
  selectRequest: [id: string]
  sendReply: []
  updateTicket: [requestId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', priority: 'low' | 'normal' | 'high' | 'urgent']
  'update:selectedSupportRequestId': [id: string | null]
  'update:supportReplyInput': [value: string]
}>()
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <h2 class="font-headline text-2xl font-bold text-gm-text">Daftar tiket</h2>
      <div class="mt-5 grid gap-3">
        <button v-for="request in props.supportQueue" :key="request._id" class="rounded-[1.5rem] p-4 text-left" :class="props.selectedSupportRequestId === request._id ? 'bg-gm-primary text-white' : 'bg-[#f3f3f3] text-gm-text'" @click="emit('update:selectedSupportRequestId', request._id)">
          <div class="text-sm font-bold">{{ request.topic }}</div>
          <div class="mt-1 text-xs" :class="props.selectedSupportRequestId === request._id ? 'text-white/70' : 'text-gm-muted'">{{ request.userName }} • {{ request.status.replaceAll('_', ' ') }} • {{ request.priority }}</div>
        </button>
      </div>
    </article>
    <article v-if="props.selectedSupportRequest" class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="font-headline text-2xl font-bold text-gm-text">{{ props.selectedSupportRequest.topic }}</h2>
          <p class="mt-1 text-sm text-gm-muted">{{ props.selectedSupportRequest.userName }} • {{ props.selectedSupportRequest.status.replaceAll('_', ' ') }} • {{ props.selectedSupportRequest.priority }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <select aria-label="Status tiket" class="rounded-2xl bg-[#f7f7f7] px-4 py-2 text-xs font-semibold text-gm-text outline-none" :value="props.selectedSupportRequest.status" :disabled="props.updatingTicketId === props.selectedSupportRequest._id" @change="emit('updateTicket', props.selectedSupportRequest._id, ($event.target as HTMLSelectElement).value as 'open' | 'in_progress' | 'resolved' | 'closed', props.selectedSupportRequest.priority)">
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select aria-label="Prioritas tiket" class="rounded-2xl bg-[#f7f7f7] px-4 py-2 text-xs font-semibold text-gm-text outline-none" :value="props.selectedSupportRequest.priority" :disabled="props.updatingTicketId === props.selectedSupportRequest._id" @change="emit('updateTicket', props.selectedSupportRequest._id, props.selectedSupportRequest.status, ($event.target as HTMLSelectElement).value as 'low' | 'normal' | 'high' | 'urgent')">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>
      <div class="mt-5 max-h-80 space-y-3 overflow-y-auto">
        <div v-for="message in props.selectedSupportRequest.messages" :key="message._id" class="rounded-[1.5rem] p-3" :class="message.senderRole === 'admin' ? 'bg-gm-primary/10 ml-8' : 'bg-[#f3f3f3] mr-8'">
          <div class="flex items-center justify-between gap-2">
            <div class="text-xs font-bold text-gm-text">{{ message.senderName }}</div>
            <div class="text-[10px] text-gm-muted">{{ message.createdAtLabel }}</div>
          </div>
          <p class="mt-1 text-sm text-gm-muted">{{ message.body }}</p>
        </div>
      </div>
      <div class="mt-5 flex gap-3">
        <label class="min-w-0 flex-1">
          <span class="sr-only">Balas tiket</span>
          <input :value="props.supportReplyInput" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Balas tiket..." @input="emit('update:supportReplyInput', ($event.target as HTMLInputElement).value)" @keydown.enter="emit('sendReply')" />
        </label>
        <button class="shrink-0 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="props.sendingTicketMessage || !props.supportReplyInput.trim()" @click="emit('sendReply')">{{ props.sendingTicketMessage ? 'Mengirim...' : 'Kirim' }}</button>
      </div>
    </article>
  </section>
</template>
