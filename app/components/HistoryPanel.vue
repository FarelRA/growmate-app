<script setup lang="ts">
import { getImageUrl } from '@/lib/images'
import MetricLineChart from '@/components/MetricLineChart.vue'
import PastRecordingViewer from '@/components/PastRecordingViewer.vue'
import { ref } from 'vue'

const props = defineProps<{
  historyData: {
    timeline: { _id: string; title: string; detail?: string; timestampLabel: string; relativeTime: string }[]
    currentPlant: { name: string; species: string } | null
    imageHistory: { _id: string; imageUrl: string | null; capturedAtLabel: string }[]
    archivedPlants: { _id: string; name: string; species: string; plantedAtLabel: string; archivedAtLabel: string | null }[]
    recordings?: {
      _id: string
      fileName: string
      path: string
      size: number
      durationMs?: number
      capturedAt: number
      capturedAtLabel: string
    }[]
  } | null
  historyMetricCards: { key: string; label: string; unit: string; stroke: string; fill: string; points: { value: number; measuredAt: number }[]; latest: number | undefined }[]
  deviceVersion?: string
}>()

const activeSubTab = ref<'metrics' | 'logs' | 'recordings' | 'timeline' | 'images'>('metrics')
const selectedRecording = ref<{
  _id: string
  path: string
  fileName: string
  size: number
  durationMs?: number
  capturedAt: number
  downloadUrl: string
} | null>(null)
const showPlayback = ref(false)
const recordingsLoading = ref(false)
const recordingList = ref<{
  _id: string
  fileName: string
  path: string
  size: number
  durationMs?: number
  capturedAt: number
  capturedAtLabel: string
}[]>(props.historyData?.recordings ?? [])

const isV2 = () => props.deviceVersion === 'v2'

async function playRecording(rec: {
  _id: string
  path: string
  fileName: string
  size: number
  durationMs?: number
  capturedAt: number
}) {
  recordingsLoading.value = true
  try {
    const resp = await fetch(`/api/v2/recordings/${encodeURIComponent(rec.path.split('/')[0])}`)
    const json = await resp.json()
    const found = json.recordings?.find((r: { _id: string; path: string }) => r._id === rec._id)
    if (found) {
      selectedRecording.value = found
      showPlayback.value = true
    }
  } catch {
    // fallback: build URL manually
    selectedRecording.value = { ...rec, downloadUrl: '' }
    showPlayback.value = true
  } finally {
    recordingsLoading.value = false
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms?: number): string {
  if (!ms) return '--:--'
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <section class="space-y-4">
    <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Riwayat</p>
      <h1 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">Arsip metrik</h1>

      <div class="mt-4 flex gap-1 rounded-[1.25rem] bg-[#f3f3f3] p-1">
        <button
          type="button"
          class="flex-1 rounded-[1rem] px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] transition-all"
          :class="activeSubTab === 'metrics' ? 'bg-white text-gm-text shadow-sm' : 'text-gm-muted'"
          @click="activeSubTab = 'metrics'"
        >Metrik</button>
        <button
          type="button"
          class="flex-1 rounded-[1rem] px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] transition-all"
          :class="activeSubTab === 'logs' ? 'bg-white text-gm-text shadow-sm' : 'text-gm-muted'"
          @click="activeSubTab = 'logs'"
        >Log</button>
        <button
          v-if="isV2()"
          type="button"
          class="flex-1 rounded-[1rem] px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] transition-all"
          :class="activeSubTab === 'recordings' ? 'bg-white text-gm-text shadow-sm' : 'text-gm-muted'"
          @click="activeSubTab = 'recordings'"
        >Rekaman</button>
        <button
          type="button"
          class="flex-1 rounded-[1rem] px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] transition-all"
          :class="activeSubTab === 'timeline' ? 'bg-white text-gm-text shadow-sm' : 'text-gm-muted'"
          @click="activeSubTab = 'timeline'"
        >Timeline</button>
        <button
          type="button"
          class="flex-1 rounded-[1rem] px-3 py-2 text-center text-xs font-bold uppercase tracking-[0.15em] transition-all"
          :class="activeSubTab === 'images' ? 'bg-white text-gm-text shadow-sm' : 'text-gm-muted'"
          @click="activeSubTab = 'images'"
        >Gambar</button>
      </div>
    </article>

    <div v-if="activeSubTab === 'recordings'">
      <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 class="font-headline text-xl font-black tracking-tight text-gm-text">Rekaman Video</h2>
        <p class="mt-1 text-sm text-gm-muted">Rekaman siaran kamera perangkat yang telah disimpan.</p>

        <div v-if="recordingList.length === 0" class="mt-5 rounded-[1.5rem] bg-[#f3f3f3] p-5 text-sm text-gm-muted">
          Belum ada rekaman.
        </div>

        <div v-else class="mt-4 space-y-2">
          <article
            v-for="rec in recordingList"
            :key="rec._id"
            class="flex items-center justify-between gap-3 rounded-[1.25rem] bg-[#f3f3f3] p-4"
          >
            <div class="min-w-0">
              <div class="text-sm font-bold text-gm-text truncate">{{ rec.fileName }}</div>
              <div class="mt-1 flex gap-3 text-xs text-gm-muted">
                <span>{{ rec.capturedAtLabel }}</span>
                <span>{{ formatDuration(rec.durationMs) }}</span>
                <span>{{ formatBytes(rec.size) }}</span>
              </div>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-full bg-gm-primary px-4 py-2 text-xs font-bold text-white"
              :disabled="recordingsLoading"
              @click="playRecording(rec)"
            >▶ Putar</button>
          </article>
        </div>
      </article>
    </div>

    <template v-if="activeSubTab === 'metrics'">
      <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <article
          v-for="metric in historyMetricCards"
          :key="metric.key"
          class="rounded-[1.75rem] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
        >
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-semibold text-gm-muted">{{ metric.label }}</p>
            <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-gm-primary">Riwayat</span>
          </div>
          <div class="mt-3 flex items-end gap-1">
            <span class="font-headline text-3xl font-black tracking-tight text-gm-text">{{ metric.latest ?? '--' }}</span>
            <span class="pb-1 text-xs font-bold text-gm-muted">{{ metric.unit }}</span>
          </div>
          <div class="mt-4 h-20 rounded-[1.25rem] bg-[#f3f3f3] p-2">
            <MetricLineChart :points="metric.points" :height="80" :stroke="metric.stroke" :fill="metric.fill" />
          </div>
        </article>
      </section>
    </template>

    <template v-if="activeSubTab === 'logs' && historyData">
    </template>

    <section v-if="activeSubTab === 'timeline' && historyData" class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Linimasa</p>
          <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">Aktivitas budidaya terbaru</h2>
        </div>
        <div v-if="historyData.timeline.length" class="mt-5 space-y-3">
          <article
            v-for="event in historyData.timeline"
            :key="event._id"
            class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
          >
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ event.title }}</div>
                <div v-if="event.detail" class="mt-1 text-sm text-gm-muted">{{ event.detail }}</div>
              </div>
              <div class="text-right text-[11px] text-gm-muted">
                <div>{{ event.timestampLabel }}</div>
                <div>{{ event.relativeTime }}</div>
              </div>
            </div>
          </article>
        </div>
        <div v-else class="mt-5 rounded-[1.5rem] bg-[#f3f3f3] p-5 text-sm text-gm-muted">Riwayat akan muncul setelah pembaruan telemetri dan aksi perawatan pertama.</div>
      </article>

      <div class="space-y-4">
        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Tanaman saat ini</p>
          <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">{{ historyData.currentPlant?.name || 'Tidak ada tanaman aktif' }}</h2>
          <p v-if="historyData.currentPlant" class="mt-2 text-sm text-gm-muted">{{ historyData.currentPlant.species }}</p>
          <div v-if="historyData.imageHistory.length" class="mt-4 grid grid-cols-2 gap-2">
            <div
              v-for="image in historyData.imageHistory.slice(0, 4)"
              :key="image._id"
              class="overflow-hidden rounded-[1.25rem] bg-[#f3f3f3]"
            >
              <img :src="getImageUrl(image.imageUrl, 200) ?? undefined" :alt="historyData.currentPlant?.name || 'Snapshot tanaman'" class="h-24 w-full object-cover" />
              <div class="px-3 py-2 text-[11px] text-gm-muted">{{ image.capturedAtLabel }}</div>
            </div>
          </div>
        </article>

        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Arsip</p>
          <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">Tanaman sebelumnya pada pod ini</h2>
          <div v-if="historyData.archivedPlants.length" class="mt-4 space-y-3">
            <article
              v-for="plant in historyData.archivedPlants"
              :key="plant._id"
              class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
            >
              <div class="text-sm font-bold text-gm-text">{{ plant.name }}</div>
              <div class="mt-1 text-sm text-gm-muted">{{ plant.species }}</div>
              <div class="mt-2 text-[11px] text-gm-muted">Ditanam {{ plant.plantedAtLabel }} • Diarsipkan {{ plant.archivedAtLabel }}</div>
            </article>
          </div>
          <div v-else class="mt-4 rounded-[1.5rem] bg-[#f3f3f3] p-5 text-sm text-gm-muted">Belum ada tanaman yang diarsipkan untuk perangkat ini.</div>
        </article>
      </div>
    </section>

    <div v-if="activeSubTab === 'images' && historyData" class="grid gap-4 sm:grid-cols-2">
      <div v-if="historyData.imageHistory.length === 0" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)] text-sm text-gm-muted">
        Belum ada gambar yang tersedia.
      </div>
      <article
        v-for="image in historyData.imageHistory"
        :key="image._id"
        class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
      >
        <img :src="getImageUrl(image.imageUrl, 400) ?? undefined" :alt="'Snapshot tanaman'" class="w-full h-48 object-cover" />
        <div class="p-4 text-sm text-gm-muted">{{ image.capturedAtLabel }}</div>
      </article>
    </div>

    <Teleport to="body">
      <div
        v-if="showPlayback && selectedRecording"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        @click.self="showPlayback = false"
      >
        <div class="w-full max-w-2xl">
          <PastRecordingViewer
            :recording="selectedRecording"
            @close="showPlayback = false"
          />
        </div>
      </div>
    </Teleport>
  </section>
</template>
