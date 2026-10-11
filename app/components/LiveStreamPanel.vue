<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { authState, getAuthToken } from '@/utils/auth'

// Live viewer for the tech MJPEG push (POST /api/v1/video/live).
// A plain <img> renders the multipart/x-mixed-replace fan-out —
// no player code, per the device docs. onload fires on the first
// frame; onerror on failure.
const props = defineProps<{
  deviceId: string
}>()

const loading = ref(true)
const streamActive = ref(false)
const error = ref<string | null>(null)
const elapsed = ref('00:00')

let timerInterval: ReturnType<typeof setInterval> | null = null
let startTime = 0
const cacheBuster = ref(0)

const streamSrc = computed(() => {
  const token = authState.token.value
  const base = `/api/v1/video/live/${encodeURIComponent(props.deviceId)}`
  const params = new URLSearchParams()
  if (token) params.set('token', token)
  if (cacheBuster.value) params.set('t', String(cacheBuster.value))
  const query = params.toString()
  return query ? `${base}?${query}` : base
})

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
}

function onFirstFrame() {
  loading.value = false
  streamActive.value = true
  error.value = null
  startTime = Date.now()
  stopTimer()
  timerInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - startTime) / 1000)
    elapsed.value = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  }, 1000)
}

function onStreamError() {
  loading.value = false
  streamActive.value = false
  stopTimer()
  error.value = 'Koneksi kamera gagal'
}

async function retry() {
  loading.value = true
  streamActive.value = false
  error.value = null
  try {
    await getAuthToken({ forceRefreshToken: true })
  } catch {
    // Fall back to the cached token; the server rejects expired tokens
    // and the error state returns.
  }
  cacheBuster.value += 1
}

function toggleFullscreen() {
  const img = document.getElementById('live-stream-img')
  if (!img) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    img.requestFullscreen()
  }
}

onUnmounted(() => {
  stopTimer()
})
</script>

<template>
  <section class="space-y-4">
    <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Kamera</p>
      <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Siaran langsung</h1>
      <p class="mt-3 text-sm leading-relaxed text-gm-muted">Streaming kamera perangkat secara real-time.</p>
    </article>

    <article class="overflow-hidden rounded-[2rem] bg-black shadow-[0_12px_36px_rgba(15,23,42,0.1)]">
      <div class="relative">
        <img
          id="live-stream-img"
          :src="streamSrc"
          alt="Siaran langsung kamera perangkat"
          class="w-full"
          :class="{ hidden: !streamActive && !loading }"
          @load="onFirstFrame"
          @error="onStreamError"
        />

        <div
          v-if="loading && !error"
          class="flex aspect-video items-center justify-center bg-black/90"
        >
          <div class="text-center text-white/60">
            <span class="material-symbols-outlined text-5xl">videocam</span>
            <p class="mt-3 text-sm">Menghubungkan ke kamera...</p>
          </div>
        </div>

        <div
          v-if="error"
          class="flex aspect-video flex-col items-center justify-center gap-3 bg-black/90"
        >
          <div class="text-center text-red-400">
            <span class="material-symbols-outlined text-5xl">error</span>
            <p class="mt-3 text-sm">{{ error }}</p>
          </div>
          <button type="button" class="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20" @click="retry">Coba Lagi</button>
        </div>

        <div
          v-if="streamActive"
          class="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4"
        >
          <span class="flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            <span class="h-2 w-2 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
          <span class="rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
            {{ elapsed }}
          </span>
        </div>

        <button
          v-if="streamActive"
          type="button"
          class="absolute bottom-3 right-3 rounded-full bg-black/50 p-2 text-white/70 backdrop-blur-sm hover:text-white"
          @click="toggleFullscreen"
        >
          <span class="material-symbols-outlined text-lg">fullscreen</span>
        </button>
      </div>
    </article>
  </section>
</template>
