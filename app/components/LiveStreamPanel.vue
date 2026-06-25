<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  deviceId: string
}>()

const videoReady = ref(false)
const wsConnected = ref(false)
const streamActive = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const elapsed = ref('00:00')

let ws: WebSocket | null = null
let decoder: VideoDecoder | null = null
let canvasCtx: CanvasRenderingContext2D | null = null
let startTime = 0
let timerInterval: NodeJS.Timeout | null = null
let reconnectTimer: NodeJS.Timeout | null = null

const webCodecsSupported = typeof VideoDecoder !== 'undefined' && typeof EncodedVideoChunk !== 'undefined'

function buildWsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const url = `${protocol}//${window.location.host}/api/v2/stream/${props.deviceId}/live`
  return url
}

function initDecoder() {
  if (!webCodecsSupported) {
    error.value = 'Browser tidak mendukung WebCodecs API'
    return
  }

  decoder = new VideoDecoder({
    output: (frame) => {
      if (!canvasCtx) { frame.close(); return }
      const canvas = canvasCtx.canvas
      canvas.width = frame.displayWidth
      canvas.height = frame.displayHeight
      canvasCtx.drawImage(frame, 0, 0)
      frame.close()
    },
    error: (e) => {
      error.value = `Decoder error: ${e.message}`
    },
  })
}

function connectWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  loading.value = true
  ws = new WebSocket(buildWsUrl())
  ws.binaryType = 'arraybuffer'

  ws.onopen = () => {
    wsConnected.value = true
    loading.value = false
    streamActive.value = true
    error.value = null
    startTime = Date.now()
    timerInterval = setInterval(() => {
      const secs = Math.floor((Date.now() - startTime) / 1000)
      elapsed.value = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
    }, 1000)
  }

  ws.onmessage = (event: MessageEvent) => {
    const data = event.data as ArrayBuffer
    if (data.byteLength < 7) return

    const view = new DataView(data)
    const flags = view.getUint8(0)
    const isKeyframe = (flags & 0x01) !== 0
    const tsHigh = view.getUint16(1, false)
    const tsLow = view.getUint32(3, false)
    const timestamp = tsHigh * 0x100000000 + tsLow
    const nalUnit = new Uint8Array(data, 7)

    const nalType = nalUnit[0]! & 0x1F

    if (nalType === 7) {
      if (decoder && decoder.state === 'unconfigured') {
        const codec = parseAVCCodec(nalUnit)
        const description = buildAVCDescription(nalUnit, undefined)
        decoder.configure({ codec, description, optimizeForLatency: true })
        if (!videoReady.value) videoReady.value = true
      }
      return
    }

    if (nalType === 8) return

    if (!decoder || decoder.state === 'unconfigured') return

    const chunk = new EncodedVideoChunk({
      type: isKeyframe ? 'key' : 'delta',
      timestamp: Math.round(timestamp / 1000),
      duration: 66_000,
      data: nalUnit,
    })

    try {
      decoder.decode(chunk)
    } catch {
      // frame dropped
    }
  }

  ws.onclose = () => {
    wsConnected.value = false
    streamActive.value = false
    loading.value = false
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    ws = null
    // Auto-reconnect after 3s
    reconnectTimer = setTimeout(() => {
      if (webCodecsSupported) connectWs()
    }, 3000)
  }

  ws.onerror = () => {
    wsConnected.value = false
    streamActive.value = false
    loading.value = false
    error.value = 'Koneksi WebSocket gagal'
  }
}

function toggleFullscreen() {
  const canvas = canvasCtx?.canvas
  if (!canvas) return
  if (document.fullscreenElement) {
    document.exitFullscreen()
  } else {
    canvas.requestFullscreen()
  }
}

function parseAVCCodec(sps: Uint8Array): string {
  if (sps.length < 4) return 'avc1.42E01E'
  const profile = sps[1]!
  const constraints = sps[2]!
  const level = sps[3]! & 0x3F
  return `avc1.${profile.toString(16).padStart(2, '0')}${constraints.toString(16).padStart(2, '0')}${level.toString(16).padStart(2, '0')}`
}

function buildAVCDescription(sps: Uint8Array, pps: Uint8Array | undefined): Uint8Array {
  const ppsData = pps ?? new Uint8Array(0)
  const size = 7 + 2 + sps.length + 1 + 2 + ppsData.length
  const buf = new Uint8Array(size)
  let off = 0
  buf[off++] = 0x01
  buf[off++] = sps[1]!
  buf[off++] = sps[2]!
  buf[off++] = sps[3]! & 0x3F
  buf[off++] = 0xFF | 0xFC
  buf[off++] = 0xE0 | 0x01
  buf[off++] = (sps.length >> 8) & 0xFF
  buf[off++] = sps.length! & 0xFF
  buf.set(sps, off); off += sps.length
  buf[off++] = ppsData.length > 0 ? 0x01 : 0x00
  if (ppsData.length > 0) {
    buf[off++] = (ppsData.length >> 8) & 0xFF
    buf[off++] = ppsData.length & 0xFF
    buf.set(ppsData, off)
  }
  return buf
}

function onCanvasReady(canvas: HTMLCanvasElement | null) {
  if (!canvas) return
  canvasCtx = canvas.getContext('2d')!
  initDecoder()
  connectWs()
}

onMounted(() => {
  if (webCodecsSupported) {
    // Initial connect happens via onCanvasReady when canvas mounts
  } else {
    error.value = 'Browser tidak mendukung pemutaran video langsung.'
  }
})

onUnmounted(() => {
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (timerInterval) clearInterval(timerInterval)
  if (ws) {
    ws.close()
    ws = null
  }
  if (decoder) {
    decoder.close()
    decoder = null
  }
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
        <canvas
          :ref="onCanvasReady as any"
          class="w-full"
          :class="{ hidden: !videoReady && !error && !loading }"
        />

        <div
          v-if="!webCodecsSupported"
          class="flex aspect-video flex-col items-center justify-center gap-2 bg-black/90 p-6 text-center"
        >
          <span class="material-symbols-outlined text-5xl text-white/40">videocam_off</span>
          <p class="text-sm text-white/60">Browser tidak mendukung pemutaran video langsung.</p>
          <p class="text-xs text-white/40">Gunakan Chrome 86+, Firefox 130+, atau Edge 86+.</p>
        </div>

        <div
          v-else-if="loading && !error"
          class="flex aspect-video items-center justify-center bg-black/90"
        >
          <div class="text-center text-white/60">
            <span class="material-symbols-outlined text-5xl">videocam</span>
            <p class="mt-3 text-sm">{{ wsConnected ? 'Menunggu stream...' : 'Menghubungkan ke kamera...' }}</p>
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
          <button type="button" class="rounded-full bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20" @click="connectWs">Coba Lagi</button>
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
