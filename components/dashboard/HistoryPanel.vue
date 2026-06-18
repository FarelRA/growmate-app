<script setup lang="ts">
import MetricLineChart from '@/components/MetricLineChart.vue'

defineProps<{
  historyData: {
    timeline: { _id: string; title: string; detail?: string; timestampLabel: string; relativeTime: string }[]
    currentPlant: { name: string; species: string } | null
    imageHistory: { _id: string; image: string; capturedAtLabel: string }[]
    archivedPlants: { _id: string; name: string; species: string; plantedAtLabel: string; archivedAtLabel: string }[]
  } | null
  historyMetricCards: { key: string; label: string; unit: string; stroke: string; fill: string; points: { value: number; measuredAt: number }[]; latest: number | undefined }[]
}>()
</script>

<template>
  <section class="space-y-4">
    <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Riwayat</p>
      <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Arsip metrik</h1>
      <p class="mt-3 text-sm leading-relaxed text-gm-muted">Riwayat data metrik dan sensor, berfokus pada tren, timeline, dan tanaman yang diarsipkan.</p>
    </article>

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

    <section class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" v-if="historyData">
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
              <img :src="image.image" :alt="historyData.currentPlant?.name || 'Snapshot tanaman'" class="h-24 w-full object-cover" />
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
  </section>
</template>
