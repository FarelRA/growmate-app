<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  recording: {
    _id: string
    path: string
    fileName: string
    size: number
    durationMs?: number
    capturedAt: number
    downloadUrl: string
  }
}>()

const emit = defineEmits<{
  close: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const playing = ref(true)
const progress = ref(0)
const currentTime = ref('00:00')
const totalTime = ref('00:00')
const error = ref<string | null>(null)
const loaded = ref(false)

let decoder: VideoDecoder | null = null
const frames: { data: Uint8Array; type: 'key' | 'delta'; timestamp: number }[] = []
let currentFrame = 0
let playbackTimer: ReturnType<typeof setTimeout> | null = null
let canvasCtx: CanvasRenderingContext2D | null = null
let spsNal: Uint8Array | null = null

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

onMounted(async () => {
  if (typeof VideoDecoder === 'undefined') {
    error.value = 'Browser tidak mendukung pemutaran video'
    return
  }

  try {
    const resp = await fetch(props.recording.downloadUrl)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = await resp.arrayBuffer()
    const allBytes = new Uint8Array(buf)

    if (allBytes.length < 4) {
      error.value = 'File video kosong'
      return
    }

    const startCodes = [
      new Uint8Array([0x00, 0x00, 0x00, 0x01]),
      new Uint8Array([0x00, 0x00, 0x01]),
    ]

    function findStart(data: Uint8Array, offset: number): { pos: number; len: number } | null {
      for (let pos = offset; pos < data.length; pos++) {
        for (const sc of startCodes) {
          let match = true
          for (let i = 0; i < sc.length; i++) {
            if (pos + i >= data.length || data[pos + i] !== sc[i]) {
              match = false
              break
            }
          }
          if (match) return { pos, len: sc.length }
        }
      }
      return null
    }

    let pos = 0
    let frameIndex = 0
    while (pos < allBytes.length) {
      const start = findStart(allBytes, pos)
      if (!start) break
      const nalStart = start.pos + start.len
      const nextStart = findStart(allBytes, nalStart)
      if (!nextStart) break
      const nalUnit = allBytes.slice(nalStart, nextStart.pos)
      const nalType = nalUnit[0] & 0x1F

      if (nalType === 7) {
        spsNal = new Uint8Array(nalUnit)
      }

      if (nalType === 5 || nalType === 1) {
        frames.push({
          data: new Uint8Array(nalUnit),
          type: nalType === 5 ? 'key' : 'delta',
          timestamp: frameIndex * 66_000,
        })
        frameIndex++
      }

      pos = nextStart.pos + nextStart.len
    }

    if (frames.length === 0) {
      error.value = 'Tidak ada frame video yang ditemukan'
      return
    }

    if (props.recording.durationMs) {
      totalTime.value = formatDuration(props.recording.durationMs)
    } else {
      totalTime.value = formatDuration(frameIndex * 66)
    }

    const canvas = canvasRef.value
    if (!canvas) return
    canvas.width = 640
    canvas.height = 480
    canvasCtx = canvas.getContext('2d')!

    decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        if (!canvasCtx) { frame.close(); return }
        canvasCtx.drawImage(frame, 0, 0)
        frame.close()
      },
      error: (e) => {
        error.value = `Decoder error: ${e.message}`
      },
    })

    if (spsNal) {
      const profile = spsNal[1]
      const constraints = spsNal[2]
      const level = spsNal[3] & 0x3F
      const codec = `avc1.${profile.toString(16).padStart(2, '0')}${constraints.toString(16).padStart(2, '0')}${level.toString(16).padStart(2, '0')}`
      decoder.configure({ codec, optimizeForLatency: false })
    }

    loaded.value = true
    startPlayback()
  } catch {
    error.value = 'Gagal memuat rekaman'
  }
})

function startPlayback() {
  if (!decoder || frames.length === 0) return
  currentFrame = 0
  playFrame()
}

function playFrame() {
  if (!playing.value || !decoder || currentFrame >= frames.length) {
    if (currentFrame >= frames.length) {
      playing.value = false
      progress.value = 100
    }
    return
  }

  const frame = frames[currentFrame]
  const chunk = new EncodedVideoChunk({
    type: frame.type,
    data: frame.data,
    timestamp: frame.timestamp,
    duration: 66_000,
  })

  try {
    decoder.decode(chunk)
  } catch { /* drop */ }

  progress.value = (currentFrame / frames.length) * 100
  currentTime.value = formatDuration(Math.round(frame.timestamp / 1000))
  currentFrame++

  playbackTimer = setTimeout(playFrame, 66)
}

function togglePlay() {
  playing.value = !playing.value
  if (playing.value) {
    if (currentFrame >= frames.length) {
      currentFrame = 0
    }
    playFrame()
  } else if (playbackTimer) {
    clearTimeout(playbackTimer)
    playbackTimer = null
  }
}

function onSeek(event: Event) {
  const target = event.target as HTMLInputElement
  const pct = parseFloat(target.value)
  progress.value = pct
  currentFrame = Math.floor((pct / 100) * frames.length)
  if (playing.value) {
    if (playbackTimer) clearTimeout(playbackTimer)
    playFrame()
  }
}

onUnmounted(() => {
  if (playbackTimer) clearTimeout(playbackTimer)
  decoder?.close()
})
</script>

<template>
  <div class="rounded-[1.5rem] bg-black overflow-hidden">
    <canvas
      ref="canvasRef"
      class="w-full aspect-video"
      :class="{ hidden: !loaded && !error }"
    />
    <div
      v-if="!loaded && !error"
      class="flex aspect-video items-center justify-center text-white/60 text-sm"
    >
      Memuat rekaman...
    </div>
    <div
      v-if="error"
      class="flex aspect-video items-center justify-center text-red-400 text-sm p-4"
    >
      {{ error }}
    </div>
    <div
      v-if="loaded"
      class="flex items-center gap-3 px-4 py-3 bg-black/80"
    >
      <button
        type="button"
        class="text-white text-lg w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
        @click="togglePlay"
      >
        {{ playing ? '⏸' : '▶' }}
      </button>
      <input
        type="range"
        min="0"
        max="100"
        step="0.1"
        :value="progress"
        class="flex-1 h-1 accent-gm-primary"
        @input="onSeek"
      />
      <span class="text-white/70 text-xs tabular-nums whitespace-nowrap">
        {{ currentTime }} / {{ totalTime }}
      </span>
      <button
        type="button"
        class="text-white/70 text-sm w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
        @click="emit('close')"
      >
        ✕
      </button>
    </div>
  </div>
</template>
