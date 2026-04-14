<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'

const router = useRouter()

const { data: devices } = useConvexQuery(api.growmate.userDevices, {})

watch(devices, (deviceList) => {
  if (!deviceList) return
  syncActiveDevice(deviceList)
}, { immediate: true })

const currentDeviceId = computed(() => activeDeviceId.value || devices.value?.[0]?.deviceId || undefined)

const { data } = useConvexQuery(
  api.growmate.assistant,
  computed(() => ({ deviceId: currentDeviceId.value })),
)

const { mutate: sendMessage } = useConvexMutation(api.growmate.sendAssistantMessage)
const { mutate: resetAssistantThread } = useConvexMutation(api.growmate.resetAssistantThread)

const messageInput = ref('')
const sending = ref(false)
const resetting = ref(false)

const tierLabel = computed(() => (data.value?.user.tier === 'advanced' ? 'Advanced' : 'Basic'))
const activeTickets = computed(() => (data.value?.supportRequests ?? []).filter((request) => request.status !== 'resolved' && request.status !== 'closed'))

const introAssistantMessage = {
  _id: '__intro__',
  role: 'assistant',
  status: 'done',
  body: data.value?.plant
    ? `# Floral Assistant\nI am ready to help with **${data.value.plant.name}** on **${data.value.device?.name ?? 'your active device'}**. Ask about care, symptoms, growth stage, or automation decisions.`
    : '# Floral Assistant\nI am ready to help. Pick an active device and ask about plant care, troubleshooting, or automation decisions.',
}

const displayMessages = computed(() => {
  const messages = data.value?.messages ?? []
  return messages.length ? messages : [introAssistantMessage]
})

function sanitizeAssistantBody(body: string) {
  return body
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim()
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatInline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
}

function renderAssistantBody(body: string) {
  const cleaned = sanitizeAssistantBody(body)
  if (!cleaned) return ''

  const lines = cleaned.split(/\n+/)
  const blocks: string[] = []
  let listItems: string[] = []

  function flushList() {
    if (!listItems.length) return
    blocks.push(`<ul>${listItems.join('')}</ul>`)
    listItems = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      flushList()
      continue
    }

    if (/^#{1,6}\s/.test(line)) {
      flushList()
      const level = line.match(/^#+/)?.[0].length ?? 1
      blocks.push(`<h${Math.min(level, 3)}>${formatInline(line.replace(/^#{1,6}\s*/, ''))}</h${Math.min(level, 3)}>`)
      continue
    }

    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      listItems.push(`<li>${formatInline(line.replace(/^([-*]|\d+\.)\s+/, ''))}</li>`)
      continue
    }

    flushList()
    blocks.push(`<p>${formatInline(line)}</p>`)
  }

  flushList()
  return blocks.join('')
}

async function handleSendMessage() {
  if (!messageInput.value.trim()) return
  sending.value = true
  try {
    await sendMessage({ body: messageInput.value, deviceId: currentDeviceId.value })
    messageInput.value = ''
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to send message'))
  } finally {
    sending.value = false
  }
}

async function handleResetThread() {
  resetting.value = true
  try {
    await resetAssistantThread({})
    toast.success('Assistant thread reset')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to reset thread'))
  } finally {
    resetting.value = false
  }
}

async function openTicket(ticketId?: string) {
  await router.push({ path: '/support', query: { ticketId } })
}
</script>

<template>
  <div v-if="data" class="space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Assistant</p>
          <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl">Your personal <span class="italic text-gm-primary">floral mentor</span></h1>
          <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">Use the control cards below to choose the right device, monitor plan limits, and manage support.</p>
        </div>
      </div>
    </section>

    <section class="grid gap-4 lg:grid-cols-[1fr_0.9fr_0.9fr]">
      <article class="rounded-[1.75rem] bg-[#f3f3f3] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-bold uppercase tracking-[0.2em] text-gm-muted">Active device</span>
          <span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-text">{{ devices?.length ?? 0 }} linked</span>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button v-for="device in devices" :key="device.deviceId" type="button" class="rounded-full px-4 py-2 text-xs font-bold transition-all" :class="device.deviceId === currentDeviceId ? 'bg-gm-primary text-white shadow-[0_10px_20px_rgba(0,110,28,0.18)]' : 'bg-white text-gm-muted'" @click="setActiveDeviceId(device.deviceId)">
            {{ device.name }}
          </button>
        </div>
      </article>

      <article class="rounded-[1.75rem] bg-[#f3f3f3] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div class="text-xs font-bold uppercase tracking-[0.2em] text-gm-muted">Plan and limits</div>
        <div class="mt-3 text-2xl font-black text-gm-text">{{ tierLabel }}</div>
        <div class="mt-2 text-sm text-gm-muted">{{ data.quota.remainingToday }} messages left today</div>
        <div class="mt-1 text-xs text-gm-muted">{{ data.quota.usedToday }} / {{ data.quota.limit }} used today</div>
      </article>

      <article class="rounded-[1.75rem] bg-[#f3f3f3] p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-bold uppercase tracking-[0.2em] text-gm-muted">Support tickets</span>
          <span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-text">{{ activeTickets.length }}</span>
        </div>
        <div class="mt-4 space-y-2">
          <button v-for="request in activeTickets.slice(0, 2)" :key="request._id" type="button" class="block w-full rounded-[1rem] bg-white px-4 py-3 text-left transition hover:bg-gm-primary/5" @click="openTicket(request._id)">
            <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
            <div class="mt-1 text-[11px] uppercase tracking-[0.18em] text-gm-muted">{{ request.priority }} • {{ request.status.replaceAll('_', ' ') }}</div>
          </button>
          <button type="button" class="w-full rounded-full bg-white px-4 py-3 text-sm font-bold text-gm-text" @click="openTicket()">
            Open tickets
          </button>
        </div>
      </article>
    </section>

    <section v-if="data.recommendations.length" class="grid gap-4 md:grid-cols-3">
      <article v-for="card in data.recommendations" :key="`${card.title}-${card.sort}`" class="rounded-[1.75rem] p-4" :class="card.accent">
        <p class="text-xs font-bold uppercase tracking-[0.2em]">Recommended</p>
        <p class="mt-2 text-sm font-semibold">{{ card.title }}</p>
        <p class="mt-2 text-xs leading-relaxed">{{ card.detail }}</p>
      </article>
    </section>

    <section v-if="!data.plant" class="rounded-[1.75rem] bg-[#f3f3f3] p-6 text-center">
      <span class="material-symbols-outlined text-5xl text-gm-primary">spa</span>
      <h2 class="mt-4 font-headline text-2xl font-bold text-gm-text">Choose a plant for this device</h2>
      <p class="mt-2 text-sm text-gm-muted">Floral Assistant becomes much more useful once the active device has a current plant profile.</p>
      <button class="mt-5 rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" @click="router.push({ path: '/select-plant', query: { deviceId: data.device?.deviceId, returnTo: '/assistant' } })">Select Plant</button>
    </section>

    <section class="space-y-5">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Floral Assistant</p>
          <h2 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Conversation thread</h2>
          <p class="mt-2 text-sm text-gm-muted">Ask about symptoms, growth stages, lighting, watering, and what to do next.</p>
        </div>
        <button class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text disabled:opacity-50" :disabled="resetting" @click="handleResetThread">{{ resetting ? 'Resetting...' : 'Reset thread' }}</button>
      </div>

      <div class="space-y-4">
        <div v-for="message in displayMessages" :key="message._id" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
          <div class="max-w-[96%] sm:max-w-[88%]">
            <div class="rounded-[1.75rem] px-4 py-4 text-sm leading-7" :class="message.role === 'user' ? 'bg-gm-primary text-white shadow-[0_16px_32px_rgba(0,110,28,0.16)]' : 'bg-white text-gm-text shadow-[0_10px_28px_rgba(15,23,42,0.04)]'">
              <div v-if="message.role === 'assistant'" class="assistant-rich" v-html="renderAssistantBody(message.body || (message.status === 'streaming' ? 'Floral Assistant is thinking...' : ''))"></div>
              <div v-else class="whitespace-pre-wrap">{{ message.body }}</div>
              <div v-if="message.role === 'assistant' && message.status === 'streaming'" class="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gm-primary">
                <span class="h-2 w-2 animate-pulse rounded-full bg-gm-primary"></span>
                Streaming
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-[#f3f3f3] p-2 rounded-[1.75rem]">
        <div class="flex items-end gap-3">
          <textarea v-model="messageInput" rows="1" class="min-h-[56px] flex-1 resize-none rounded-[1.25rem] bg-white px-4 py-3 text-sm outline-none disabled:opacity-50" :disabled="sending || data.quota.remainingToday <= 0" placeholder="Ask your mentor anything..." @keyup.enter.exact.prevent="!sending && data.quota.remainingToday > 0 && handleSendMessage()" />
          <button class="rounded-full bg-gm-primary p-4 text-white shadow-md disabled:opacity-50" :disabled="sending || data.quota.remainingToday <= 0" @click="handleSendMessage">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">{{ sending ? 'hourglass_top' : 'send' }}</span>
          </button>
        </div>
      </div>

      <div v-if="data.quota.remainingToday <= 0" class="text-center text-xs text-gm-muted">
        Daily limit reached for the {{ tierLabel.toLowerCase() }} plan. Ask an admin if your subscription needs to change.
      </div>
    </section>
  </div>
</template>

<style scoped>
.assistant-rich :deep(h1),
.assistant-rich :deep(h2),
.assistant-rich :deep(h3) {
  margin: 0 0 0.5rem;
  font-weight: 800;
  line-height: 1.25;
}

.assistant-rich :deep(p) {
  margin: 0.5rem 0;
}

.assistant-rich :deep(ul) {
  margin: 0.5rem 0;
  padding-left: 1.25rem;
  list-style: disc;
}

.assistant-rich :deep(li) {
  margin: 0.25rem 0;
}

.assistant-rich :deep(code) {
  border-radius: 0.375rem;
  background: rgba(15, 23, 42, 0.06);
  padding: 0.1rem 0.35rem;
  font-size: 0.92em;
}
</style>
