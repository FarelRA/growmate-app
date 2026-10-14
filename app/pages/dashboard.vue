<script setup lang="ts">
import { useDashboard } from '@/composables/useDashboard'
import { computed, watch } from 'vue'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

const {
  panelOptions,
  iconMap,
  accentMap,
  devices,
  data,
  historyData,
  activePanel,
  currentDeviceId,
  waterSensor,
  displayPlantImage,
  displaySensors,
  schedulePreview,
  historyMetricCards,
  scheduleForm,
  savingSchedule,
  deletingScheduleId,
  removingDeviceId,

  setPanel,
  handleSelectDevice,
  openSelectPlant,
  handleWater,
  handleLight,
  handleFertilize,
  handlePesticide,
  handleToggleAutomation,
  handleStartStream,
  handleStopStream,
  isStreaming,
  handleToggleSchedule,
  handleSaveSchedule,
  handleDeleteSchedule,
  handleRemoveDevice,
  resetScheduleForm,
  editSchedule,

  isV2,
  batterySoC,
  batteryCurrent,
  batteryIcon,
  timeToEmpty,
  timeToFull,
  hasModem,
  hasSolarPanel,
  solarPanelWatts,
  tankCapacity,
  tankMinLevel,
} = useDashboard()

const router = useRouter()

const deviceVersion = computed(() => data.value?.device?.version ?? 'v1')
const showStreamTab = computed(() => deviceVersion.value === 'v2')

const displayPanelOptions = computed(() => {
  if (showStreamTab.value) {
    const panels = [...panelOptions]
    if (!panels.some((p) => p.key === 'stream')) {
      panels.push({ key: 'stream', label: 'Siaran', icon: 'videocam' })
    }
    return panels
  }
  return panelOptions
})

function reloadDashboard() {
  window.location.reload()
}

// Stream tab is v2-only: when the active device cannot stream while the
// stream panel is selected (device switch or direct ?panel=stream link),
// fall back to overview so the page never renders a blank panel.
watch(
  [showStreamTab, activePanel],
  ([canStream, panel]) => {
    if (import.meta.server) return
    if (!canStream && panel === 'stream') {
      setPanel('overview')
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-4" v-if="data">
    <section class="rounded-[1.75rem] bg-[#f3f3f3] p-2 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div :class="['grid gap-2', showStreamTab ? 'grid-cols-5' : 'grid-cols-4']">
        <button
          v-for="panel in displayPanelOptions"
          :key="panel.key"
          type="button"
          class="flex min-w-0 flex-col items-center justify-center rounded-[1.25rem] px-2 py-3 text-center transition-all"
          :class="
            activePanel === panel.key
              ? 'bg-white text-gm-primary shadow-[0_10px_20px_rgba(15,23,42,0.06)]'
              : 'text-gm-muted'
          "
          @click="setPanel(panel.key)"
        >
          <span class="material-symbols-outlined text-[20px]">{{ panel.icon }}</span>
          <span
            class="mt-1 w-full truncate px-1 text-[10px] font-bold uppercase tracking-[0.18em]"
            >{{ panel.label }}</span
          >
        </button>
      </div>
    </section>

    <section
      v-if="!data.plant"
      class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
    >
      <div class="space-y-4">
        <div
          class="inline-flex items-center gap-2 rounded-full bg-gm-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gm-primary"
        >
          <span class="material-symbols-outlined text-sm">psychiatry</span>
          Perlu penentuan tanaman
        </div>
        <div>
          <h2 class="font-headline text-3xl font-black tracking-tight text-gm-text">
            {{ data.device?.name }}
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-gm-muted">
            Perangkat ini sudah aktif, tetapi sistem masih memerlukan pilihan tanaman agar saran
            perawatan, pemantauan, dan otomatisasi dapat berjalan sesuai kebutuhan budidaya.
          </p>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-5 py-3 text-sm font-bold text-white"
            @click="openSelectPlant(data.device?.deviceId)"
          >
            Pilih Tanaman
          </button>
          <button
            type="button"
            class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text"
            @click="setPanel('devices')"
          >
            Buka Perangkat
          </button>
        </div>
      </div>
    </section>

    <OverviewPanel
      v-else-if="activePanel === 'overview'"
      :plant="data.plant"
      :device="data.device"
      :reservoir-days="data.reservoirDays"
      :alerts="data.alerts"
      :water-sensor="waterSensor"
      :display-plant-image="displayPlantImage"
      :display-sensors="displaySensors"
      :icon-map="iconMap"
      :accent-map="accentMap"
      :is-v2="isV2"
      :battery-soc="batterySoC"
      :battery-current="batteryCurrent"
      :battery-icon="batteryIcon"
      :time-to-empty="timeToEmpty"
      :time-to-full="timeToFull"
      :has-modem="hasModem"
      :has-solar-panel="hasSolarPanel"
      :solar-panel-watts="solarPanelWatts"
      :tank-capacity="tankCapacity"
      :tank-min-level="tankMinLevel"
      @water="handleWater"
      @light="handleLight"
      @fertilize="handleFertilize"
      @pesticide="handlePesticide"
      @select-plant="openSelectPlant(data.device?.deviceId)"
      @set-panel="setPanel"
    />

    <CarePanel
      v-else-if="activePanel === 'care'"
      :device="data.device"
      :schedules="data.schedules"
      :schedule-form="scheduleForm"
      :schedule-preview="schedulePreview"
      :saving-schedule="savingSchedule"
      :deleting-schedule-id="deletingScheduleId"
      @update:schedule-form="scheduleForm = $event"
      @water="handleWater"
      @light="handleLight"
      @fertilize="handleFertilize"
      @pesticide="handlePesticide"
      @toggle-automation="handleToggleAutomation"
      @toggle-schedule="handleToggleSchedule"
      @save-schedule="handleSaveSchedule"
      @delete-schedule="handleDeleteSchedule"
      @reset-schedule="resetScheduleForm"
      @edit-schedule="editSchedule"
    />

    <DevicesPanel
      v-else-if="activePanel === 'devices'"
      :devices="devices ?? []"
      :current-device-id="currentDeviceId"
      :removing-device-id="removingDeviceId"
      @select-device="handleSelectDevice"
      @select-plant="openSelectPlant"
      @remove-device="handleRemoveDevice"
      @connect-device="router.push({ path: '/claim-device', query: { manual: '1' } })"
    />

    <HistoryPanel
      v-else-if="activePanel === 'history'"
      :device-id="data.device?.deviceId ?? ''"
      :history-data="historyData"
      :history-metric-cards="historyMetricCards"
      :device-version="deviceVersion"
    />

    <LiveStreamPanel
      v-else-if="activePanel === 'stream' && showStreamTab"
      :device-id="data.device?.deviceId ?? ''"
      :streaming="isStreaming"
      @request-start="handleStartStream"
      @request-stop="handleStopStream"
    />
  </div>

  <div v-else class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
    <div class="animate-pulse space-y-3" aria-hidden="true">
      <div class="h-6 w-1/3 rounded-full bg-[#f3f3f3]"></div>
      <div class="h-4 w-2/3 rounded-full bg-[#f3f3f3]"></div>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div class="h-28 rounded-[1.5rem] bg-[#f3f3f3]"></div>
        <div class="h-28 rounded-[1.5rem] bg-[#f3f3f3]"></div>
      </div>
    </div>
    <p class="mt-5 text-sm text-gm-muted" role="status">Memuat dashboard...</p>
    <p class="mt-1 text-xs text-gm-muted">
      Jika pemuatan macet, data perangkat mungkin gagal dimuat.
    </p>
    <button
      type="button"
      class="mt-4 rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text"
      @click="reloadDashboard"
    >
      Muat ulang
    </button>
  </div>
</template>
