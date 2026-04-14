<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConvexQuery } from '@convex-vue/core'
import MetricLineChart from '@/components/MetricLineChart.vue'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getSetupRoute } from '@/lib/setup'

const router = useRouter()

const { data: setupStatus } = useConvexQuery(api.growmate.checkSetupStatus, {})
const { data: devices } = useConvexQuery(api.growmate.userDevices, {})

watch(devices, (deviceList) => {
  if (!deviceList) return
  syncActiveDevice(deviceList)
}, { immediate: true })

watch(setupStatus, async (status) => {
  if (!status) return
  if (!status.authenticated || !status.setupComplete || status.isAdmin) {
    await router.replace(getSetupRoute(status))
  }
}, { immediate: true })

const currentDeviceId = computed(() => activeDeviceId.value || devices.value?.[0]?.deviceId || undefined)

const { data } = useConvexQuery(
  api.growmate.deviceHistory,
  computed(() => ({ deviceId: currentDeviceId.value })),
)

const metricCards = computed(() => {
  const history = data.value?.metricHistory
  if (!history) return []

  return [
    { key: 'soil', label: 'Soil Moisture', unit: '%', accent: 'text-[#795548]' },
    { key: 'light', label: 'Light Intensity', unit: '%', accent: 'text-gm-primary' },
    { key: 'temperature', label: 'Temperature', unit: '°C', accent: 'text-[#c56b00]' },
    { key: 'air', label: 'Humidity', unit: '%', accent: 'text-[#006493]' },
    { key: 'water', label: 'Reservoir', unit: '%', accent: 'text-[#0077b6]' },
  ].map((metric) => {
    const points = history[metric.key] ?? []
    const latest = points[points.length - 1]?.value
    return { ...metric, points, latest }
  })
})
</script>

<template>
  <div v-if="data" class="space-y-8">
    <section class="rounded-[2rem] bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">History Archive</p>
          <h1 class="mt-2 font-headline text-4xl font-black tracking-tight text-gm-text">Device timeline and metric archive</h1>
          <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">
            Every meaningful grow action is appended here: plant lifecycle, manual actions, automation changes, camera uploads, and telemetry trends.
          </p>
        </div>
        <div v-if="devices?.length" class="flex flex-wrap gap-3">
          <button
            v-for="device in devices"
            :key="device.deviceId"
            type="button"
            class="rounded-full px-4 py-2 text-sm font-semibold transition"
            :class="device.deviceId === currentDeviceId ? 'bg-gm-primary text-white' : 'bg-[#f3f3f3] text-gm-muted'"
            @click="setActiveDeviceId(device.deviceId)"
          >
            {{ device.name }}
          </button>
        </div>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-5">
      <article
        v-for="metric in metricCards"
        :key="metric.key"
        class="rounded-[1.75rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
      >
        <div class="flex items-center justify-between">
          <p class="text-sm font-semibold text-gm-muted">{{ metric.label }}</p>
          <span class="text-xs font-bold uppercase tracking-[0.18em]" :class="metric.accent">History</span>
        </div>
        <div class="mt-3 flex items-baseline gap-1">
          <span class="font-headline text-3xl font-black text-gm-text">{{ metric.latest ?? '--' }}</span>
          <span class="text-sm font-bold text-gm-muted">{{ metric.unit }}</span>
        </div>
        <div class="mt-4 h-24 rounded-2xl bg-[#f7f7f7] p-2">
          <MetricLineChart :points="metric.points" />
        </div>
      </article>
    </section>

    <section class="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
      <div class="space-y-8">
        <article class="rounded-[2rem] bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.18em] text-gm-primary">Timeline</p>
              <h2 class="mt-2 font-headline text-2xl font-bold text-gm-text">Recent grow events</h2>
            </div>
            <div class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
              {{ data.timeline.length }} entries
            </div>
          </div>

          <div class="mt-6 space-y-4">
            <div v-for="event in data.timeline" :key="event._id" class="rounded-[1.5rem] border border-[#ececec] p-4">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p class="text-sm font-bold text-gm-text">{{ event.title }}</p>
                  <p v-if="event.detail" class="mt-1 text-sm text-gm-muted">{{ event.detail }}</p>
                </div>
                <div class="text-right text-xs text-gm-muted">
                  <div>{{ event.timestampLabel }}</div>
                  <div>{{ event.relativeTime }}</div>
                </div>
              </div>
            </div>
          </div>
        </article>

        <article class="rounded-[2rem] bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-gm-primary">Automation</p>
          <h2 class="mt-2 font-headline text-2xl font-bold text-gm-text">Automation log</h2>

          <div v-if="data.automationLogs.length" class="mt-6 space-y-4">
            <div v-for="log in data.automationLogs" :key="log._id" class="rounded-[1.5rem] bg-[#f7f7f7] p-4">
              <div class="flex items-center justify-between gap-4">
                <div>
                  <p class="text-sm font-bold text-gm-text">{{ log.action.replaceAll('_', ' ') }}</p>
                  <p class="mt-1 text-xs text-gm-muted">
                    <span v-if="log.soilValue !== undefined">Soil {{ log.soilValue }}%</span>
                    <span v-if="log.threshold !== undefined"> • Threshold {{ log.threshold }}</span>
                    <span v-if="log.duration !== undefined"> • Duration {{ log.duration }}s</span>
                  </p>
                </div>
                <div class="text-right text-xs text-gm-muted">
                  <div>{{ log.timestampLabel }}</div>
                  <div>{{ log.relativeTime }}</div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="mt-6 rounded-[1.5rem] border border-dashed border-[#d8d8d8] p-6 text-sm text-gm-muted">
            No automation log entries yet for this device.
          </div>
        </article>
      </div>

      <div class="space-y-8">
        <article class="rounded-[2rem] bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-gm-primary">Current Plant</p>
          <h2 class="mt-2 font-headline text-2xl font-bold text-gm-text">{{ data.currentPlant?.name || 'No active plant' }}</h2>
          <p v-if="data.currentPlant" class="mt-2 text-sm text-gm-muted">
            {{ data.currentPlant.species }} • planted {{ data.currentPlant.plantedAtLabel }}
          </p>

          <div v-if="data.imageHistory.length" class="mt-6 grid grid-cols-2 gap-3">
            <div v-for="image in data.imageHistory.slice(0, 6)" :key="image._id" class="overflow-hidden rounded-[1.25rem] bg-[#f3f3f3]">
              <img :src="image.image" :alt="data.currentPlant?.name || 'Plant snapshot'" class="h-28 w-full object-cover" />
              <div class="px-3 py-2 text-[11px] text-gm-muted">
                {{ image.source }} • {{ image.capturedAtLabel }}
              </div>
            </div>
          </div>
        </article>

        <article class="rounded-[2rem] bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <p class="text-xs font-bold uppercase tracking-[0.18em] text-gm-primary">Archive</p>
          <h2 class="mt-2 font-headline text-2xl font-bold text-gm-text">Past plants on this device</h2>

          <div v-if="data.archivedPlants.length" class="mt-6 space-y-4">
            <div v-for="plant in data.archivedPlants" :key="plant._id" class="rounded-[1.5rem] bg-[#f7f7f7] p-4">
              <p class="text-sm font-bold text-gm-text">{{ plant.name }}</p>
              <p class="mt-1 text-sm text-gm-muted">{{ plant.species }} • {{ plant.growthStageLabel }}</p>
              <p class="mt-2 text-xs text-gm-muted">Planted {{ plant.plantedAtLabel }} • Archived {{ plant.archivedAtLabel }}</p>
            </div>
          </div>

          <div v-else class="mt-6 rounded-[1.5rem] border border-dashed border-[#d8d8d8] p-6 text-sm text-gm-muted">
            No archived plants yet. The first replaced plant will appear here.
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
