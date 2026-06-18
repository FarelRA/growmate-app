<script setup lang="ts">
defineProps<{
  threads: { _id: string; productTitle: string; participantName: string; role: string; sellerUnreadCount: number; buyerUnreadCount: number; lastMessagePreview: string }[]
  selectedThread: { _id: string; productTitle: string; participantName: string; messages: { _id: string; body: string; mine: boolean; createdAtLabel: string }[] } | null
  selectedThreadId: string | null
  replyMessage: string
  sendingReply: boolean
}>()

defineEmits<{
  selectThread: [threadId: string]
  'update:replyMessage': [value: string]
  replyThread: []
}>()
</script>

<template>
  <article class="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="font-headline text-2xl font-bold text-gm-text">Percakapan Marketplace</h2>
        <p class="text-sm text-gm-muted">Setiap percakapan pembeli dan penjual tetap terhubung ke penawaran yang sedang dibahas.</p>
      </div>
    </div>

    <div class="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <div class="space-y-3">
        <button
          v-for="thread in threads"
          :key="thread._id"
          type="button"
          class="w-full rounded-[1.25rem] p-4 text-left"
          :class="selectedThreadId === thread._id ? 'bg-gm-primary/5' : 'bg-[#fafafa]'"
          @click="$emit('selectThread', thread._id)"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-sm font-bold text-gm-text">{{ thread.productTitle }}</div>
              <div class="mt-1 text-xs text-gm-muted">{{ thread.participantName }} • {{ thread.role }}</div>
            </div>
            <div class="text-[11px] text-gm-muted">
              {{ thread.role === 'seller' ? thread.sellerUnreadCount : thread.buyerUnreadCount }}
            </div>
          </div>
          <div class="mt-2 text-xs text-gm-muted">{{ thread.lastMessagePreview }}</div>
        </button>

        <div v-if="!threads.length" class="rounded-[1.25rem] bg-[#f3f3f3] p-6 text-sm text-gm-muted">
          Belum ada percakapan marketplace.
        </div>
      </div>

      <div v-if="selectedThread" class="flex min-h-[420px] flex-col rounded-[1.5rem] bg-[#f7f7f7] p-4">
        <div class="border-b border-[#e5e5e5] px-2 pb-4">
          <div class="text-sm font-bold text-gm-text">{{ selectedThread.productTitle }}</div>
          <div class="mt-1 text-xs text-gm-muted">Sedang berbicara dengan {{ selectedThread.participantName }}</div>
        </div>
        <div class="flex-1 space-y-3 overflow-y-auto px-1 py-4">
          <div
            v-for="message in selectedThread.messages"
            :key="message._id"
            class="flex"
            :class="message.mine ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[85%] rounded-[1.25rem] px-4 py-3 text-sm"
              :class="message.mine ? 'bg-gm-primary text-white' : 'bg-white text-gm-text'"
            >
              <div>{{ message.body }}</div>
              <div class="mt-2 text-[11px]" :class="message.mine ? 'text-white/70' : 'text-gm-muted'">{{ message.createdAtLabel }}</div>
            </div>
          </div>
        </div>
        <div class="flex gap-3 border-t border-[#e5e5e5] pt-4">
          <label class="flex-1">
            <span class="sr-only">Balasan</span>
            <input
              :value="replyMessage"
              @input="$emit('update:replyMessage', ($event.target as HTMLInputElement).value)"
              @keyup.enter="!sendingReply && $emit('replyThread')"
              class="w-full rounded-full bg-white px-5 py-3 text-sm outline-none"
              placeholder="Balas di percakapan listing ini..."
            />
          </label>
          <button @click="$emit('replyThread')" class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" :disabled="sendingReply">
            {{ sendingReply ? 'Mengirim...' : 'Kirim' }}
          </button>
        </div>
      </div>

      <div v-else class="rounded-[1.5rem] bg-[#f3f3f3] p-8 text-sm text-gm-muted">
        Pilih percakapan untuk mengelola pertanyaan listing.
      </div>
    </div>
  </article>
</template>
