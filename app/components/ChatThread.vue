<script setup lang="ts">
export interface ChatMessage {
  _id: string
  role: 'user' | 'assistant'
  status: 'done' | 'streaming' | 'complete' | 'error'
  body?: string
}

defineProps<{
  messages: ChatMessage[]
}>()

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
      blocks.push(
        `<h${Math.min(level, 3)}>${formatInline(line.replace(/^#{1,6}\s*/, ''))}</h${Math.min(level, 3)}>`,
      )
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
</script>

<template>
  <div class="space-y-4">
    <div
      v-for="message in messages"
      :key="message._id"
      class="flex"
      :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
    >
      <div class="max-w-[96%] sm:max-w-[88%]">
        <div
          class="rounded-[1.75rem] px-4 py-4 text-sm leading-7"
          :class="
            message.role === 'user'
              ? 'bg-gm-primary text-white shadow-[0_16px_32px_rgba(0,110,28,0.16)]'
              : 'bg-white text-gm-text shadow-[0_10px_28px_rgba(15,23,42,0.04)]'
          "
        >
          <div
            v-if="message.role === 'assistant'"
            class="assistant-rich"
            v-html="
              renderAssistantBody(
                message.body ||
                  (message.status === 'streaming' ? 'Floral Assistant sedang berpikir...' : ''),
              )
            "
          />
          <div v-else class="whitespace-pre-wrap">{{ message.body }}</div>
          <div
            v-if="message.role === 'assistant' && message.status === 'streaming'"
            class="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gm-primary"
          >
            <span class="h-2 w-2 animate-pulse rounded-full bg-gm-primary" />
            Sedang memproses
          </div>
        </div>
      </div>
    </div>
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
