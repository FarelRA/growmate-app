<script setup lang="ts">
import MetricLineChart from '@/components/MetricLineChart.vue'
import WaterGauge from '@/components/WaterGauge.vue'

defineProps<{
  plant: { name: string; species: string; health: string; image?: string | null } | null
  device: { name: string; deviceId: string; isOnline: boolean; firmwareVersion?: string | null; version?: string } | null
  reservoirDays: number
  alerts: { type: string; message: string }[]
  waterSensor: { value: number } | null
  displayPlantImage: string | null
  displaySensors: { _id: string; kind: string; value: number; unit: string; label: string; status: string; target: string; accent: string; history: { value: number; measuredAt: number }[] }[]
  iconMap: Record<string, string>
  accentMap: Record<string, string>
  isV2?: boolean
  batterySoC?: number
  batteryCurrent?: number
  batteryIcon?: string
  timeToEmpty?: string
  timeToFull?: string
  tankSwitchOpen?: boolean
  drawerSwitchOpen?: boolean
  hasModem?: boolean
  hasSolarPanel?: boolean
  solarPanelWatts?: number
  tankCapacity?: number
  tankMinLevel?: number
}>()

defineEmits<{
  water: []
  light: [enabled: boolean]
  fertilize: []
  pesticide: []
  selectPlant: [deviceId?: string]
  setPanel: [panel: 'overview' | 'care' | 'devices' | 'history']
}>()

function formatPlantHealthLabel(value: string) {
  switch (value) {
    case 'excellent': return 'sangat baik'
    case 'good': return 'baik'
    case 'fair': return 'perlu perhatian'
    case 'poor': return 'kurang stabil'
    default: return value
  }
}
</script>

<template>
  <section class="space-y-4">
    <article class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
      <div class="relative min-h-[220px] bg-[#f3f3f3]">
        <img
          v-if="displayPlantImage"
          :src="displayPlantImage"
          :alt="plant?.name"
          class="h-full w-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"></div>
        <div class="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md">
          <span class="material-symbols-outlined text-sm">eco</span>
          Kondisi {{ formatPlantHealthLabel(plant?.health ?? '') }}
        </div>
        <div class="absolute bottom-4 left-4 right-4">
          <div class="rounded-[1.5rem] bg-white/16 p-4 backdrop-blur-md">
            <h1 class="font-headline text-3xl font-black tracking-tight text-white">{{ plant?.name }}</h1>
            <p class="mt-1 text-sm text-white/80">{{ plant?.species }}</p>
          </div>
        </div>
      </div>
    </article>

    <section class="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <div class="space-y-4">
        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Sensor</p>
              <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">Kondisi tanaman saat ini</h2>
            </div>
          </div>
          <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <article
              v-for="sensor in displaySensors"
              :key="sensor._id"
              class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
            >
              <div class="flex items-start justify-between gap-3">
                <div :class="['rounded-2xl p-3', accentMap[sensor.accent] ?? '']">
                  <span class="material-symbols-outlined text-[20px]">{{ iconMap[sensor.kind] ?? '' }}</span>
                </div>
                <div class="text-right">
                  <div class="text-[11px] font-bold uppercase tracking-[0.18em] text-gm-primary">{{ sensor.status }}</div>
                  <div class="mt-1 text-xs text-gm-muted">{{ sensor.target }}</div>
                </div>
              </div>
              <div class="mt-5">
                <div class="text-sm font-medium text-gm-muted">{{ sensor.label }}</div>
                <div class="mt-1 flex items-end gap-1">
                  <span class="font-headline text-4xl font-black tracking-tight text-gm-text">{{ sensor.value }}</span>
                  <span class="pb-1 text-sm font-bold text-gm-muted">{{ sensor.unit }}</span>
                </div>
              </div>
              <div class="mt-4 h-16 rounded-[1.25rem] bg-white p-2">
                <MetricLineChart :points="sensor.history" :height="64" />
              </div>
            </article>
          </div>
        </article>

        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Aksi cepat</p>
              <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">Tindakan langsung</h2>
            </div>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button type="button" class="rounded-[1.5rem] bg-gradient-to-r from-gm-primary to-gm-primary-soft px-4 py-4 text-left text-white" @click="$emit('water')">
              <span class="material-symbols-outlined text-[22px]">water_drop</span>
              <div class="mt-3 text-sm font-bold">{{ isV2 ? 'Siram + Pupuk' : 'Siram sekarang' }}</div>
            </button>
            <button v-if="!isV2" type="button" class="rounded-[1.5rem] bg-[#fff6da] px-4 py-4 text-left text-[#7a5a00]" @click="$emit('light', true)">
              <span class="material-symbols-outlined text-[22px]">light_mode</span>
              <div class="mt-3 text-sm font-bold">Nyalakan lampu</div>
            </button>
            <button v-if="!isV2" type="button" class="rounded-[1.5rem] bg-[#f3f3f3] px-4 py-4 text-left text-gm-text" @click="$emit('light', false)">
              <span class="material-symbols-outlined text-[22px]">dark_mode</span>
              <div class="mt-3 text-sm font-bold">Matikan lampu</div>
            </button>
            <button v-if="isV2" type="button" class="rounded-[1.5rem] bg-gradient-to-r from-emerald-600 to-emerald-400 px-4 py-4 text-left text-white" @click="$emit('fertilize')">
              <span class="material-symbols-outlined text-[22px]">spa</span>
              <div class="mt-3 text-sm font-bold">Beri pupuk</div>
            </button>
            <button v-if="isV2" type="button" class="rounded-[1.5rem] bg-gradient-to-r from-amber-600 to-amber-400 px-4 py-4 text-left text-white" @click="$emit('pesticide')">
              <span class="material-symbols-outlined text-[22px]">bug_report</span>
              <div class="mt-3 text-sm font-bold">Pestisida</div>
            </button>
            <button type="button" class="rounded-[1.5rem] bg-[#e8f4ff] px-4 py-4 text-left text-[#006493]" @click="$emit('selectPlant')">
              <span class="material-symbols-outlined text-[22px]">edit</span>
              <div class="mt-3 text-sm font-bold">Ganti tanaman</div>
            </button>
          </div>
        </article>

        <WaterGauge
          v-if="isV2"
          :level="waterSensor?.value ?? 0"
          label="Level Tangki Pupuk"
          :capacity="tankCapacity ?? 10"
          :min-level="tankMinLevel ?? 10"
        />
        <article v-else class="rounded-[2rem] bg-[#f3f3f3] p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#006493]">Cadangan air</p>
              <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">{{ waterSensor?.value ?? 0 }}%</h2>
              <p class="mt-2 text-sm leading-relaxed text-gm-muted">Perkiraan cukup untuk {{ reservoirDays }} hari ke depan</p>
            </div>
            <div class="relative h-28 w-16 overflow-hidden rounded-[1.25rem] bg-white shadow-inner">
              <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#006493] to-[#00a4ed]" :style="{ height: `${waterSensor?.value ?? 0}%` }"></div>
              <div class="absolute inset-0 flex items-center justify-center text-sm font-black text-gm-text mix-blend-overlay">{{ waterSensor?.value ?? 0 }}%</div>
            </div>
          </div>
        </article>
      </div>

      <div class="space-y-4">
        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div>
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Perangkat</p>
              <h2 class="mt-2 font-headline text-xl font-black tracking-tight text-gm-text">{{ device?.name }}</h2>
            </div>
          </div>
          <div class="mt-4 space-y-3 text-sm text-gm-muted">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0 truncate">{{ device?.deviceId }}</div>
              <span
                class="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                :class="device?.isOnline ? 'bg-[#94f990]/35 text-[#005313]' : 'bg-[#e8e8e8] text-gm-muted'"
              >
                {{ device?.isOnline ? 'Terhubung' : 'Tidak terhubung' }}
              </span>
            </div>
            <div v-if="device?.firmwareVersion">Firmware {{ device.firmwareVersion }}</div>
          </div>
          <button type="button" class="mt-5 w-full rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-bold text-gm-text" @click="$emit('setPanel', 'devices')">
            Kelola perangkat
          </button>
        </article>

        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Peringatan</p>
              <h2 class="mt-2 font-headline text-xl font-black tracking-tight text-gm-text">Ringkasan perhatian</h2>
            </div>
          </div>
          <div v-if="alerts?.length" class="mt-4 space-y-3">
            <div
              v-for="(alert, index) in alerts.slice(0, 3)"
              :key="index"
              class="rounded-[1.5rem] p-4 text-sm"
              :class="alert.type === 'critical' ? 'bg-red-50 text-red-900' : alert.type === 'warning' ? 'bg-yellow-50 text-yellow-900' : 'bg-[#cae6ff]/40 text-[#006493]'"
            >
              {{ alert.message }}
            </div>
          </div>
          <div v-else class="mt-4 rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted">Semua dalam kondisi stabil saat ini.</div>
        </article>

        <template v-if="isV2">
          <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Baterai</p>
                <h2 class="mt-2 font-headline text-xl font-black tracking-tight text-gm-text">
                  <span class="material-symbols-outlined align-middle text-[20px]">{{ batteryIcon }}</span>
                  {{ batterySoC }}%
                </h2>
                <p class="mt-1 text-xs text-gm-muted">
                  {{ (batteryCurrent ?? 0) > 0 ? `+${batteryCurrent}mA (mengisi)` : `${batteryCurrent}mA (menggunakan baterai)` }}
                </p>
              </div>
            </div>
            <div class="mt-3 text-xs text-gm-muted">
              <p>{{ (batteryCurrent ?? 0) > 0 ? timeToFull : timeToEmpty }}</p>
            </div>
            <div v-if="hasModem" class="mt-2 flex items-center gap-1 text-xs text-gm-muted">
              <span class="material-symbols-outlined text-sm">signal_cellular_alt</span> Modem terpasang
            </div>
            <div v-if="hasSolarPanel" class="mt-1 flex items-center gap-1 text-xs text-gm-muted">
              <span class="material-symbols-outlined text-sm">solar_power</span> Panel surya {{ solarPanelWatts }}W
            </div>
          </article>

          <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Sakelar</p>
            <div class="mt-3 space-y-2 text-sm">
              <div :class="tankSwitchOpen ? 'text-red-500' : 'text-green-600'" class="flex items-center gap-2">
                <span class="inline-block h-2 w-2 rounded-full" :class="tankSwitchOpen ? 'bg-red-500' : 'bg-green-600'" />
                <span>{{ tankSwitchOpen ? 'Tutup tangki terbuka' : 'Tutup tangki tertutup' }}</span>
              </div>
              <div :class="drawerSwitchOpen ? 'text-red-500' : 'text-green-600'" class="flex items-center gap-2">
                <span class="inline-block h-2 w-2 rounded-full" :class="drawerSwitchOpen ? 'bg-red-500' : 'bg-green-600'" />
                <span>{{ drawerSwitchOpen ? 'Laci terbuka' : 'Laci tertutup' }}</span>
              </div>
            </div>
          </article>
        </template>
      </div>
    </section>
  </section>
</template>
