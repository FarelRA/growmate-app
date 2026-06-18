<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import MetricLineChart from '@/components/MetricLineChart.vue'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

type DashboardPanel = 'overview' | 'care' | 'devices' | 'history'
type ScheduleCadenceUnit = 'hours' | 'days'

const route = useRoute()
const router = useRouter()

const panelOptions: Array<{ key: DashboardPanel; label: string; icon: string }> = [
  { key: 'overview', label: 'Ringkasan', icon: 'dashboard' },
  { key: 'care', label: 'Perawatan', icon: 'spa' },
  { key: 'devices', label: 'Perangkat', icon: 'hub' },
  { key: 'history', label: 'Riwayat', icon: 'timeline' },
]

const iconMap: Record<string, string> = {
  soil: 'opacity',
  light: 'light_mode',
  temperature: 'thermostat',
  air: 'air',
  water: 'water',
}

const accentMap: Record<string, string> = {
  earth: 'bg-gm-secondary-soft/40 text-[#795548]',
  sun: 'bg-[#94f990]/35 text-gm-primary',
  warm: 'bg-[#ffdbcf] text-[#795548]',
  air: 'bg-[#cae6ff]/50 text-[#006493]',
  water: 'bg-[#00a4ed]/15 text-[#006493]',
}

function isPanel(value: string | null): value is DashboardPanel {
  return value === 'overview' || value === 'care' || value === 'devices' || value === 'history'
}

const { data: devices } = useConvexQuery(api.growmate.userDevices, {})

watch(
  devices,
  (deviceList) => {
    if (!deviceList) return
    syncActiveDevice(deviceList)
  },
  { immediate: true },
)

const activePanel = computed<DashboardPanel>(() => {
  const panel = typeof route.query.panel === 'string' ? route.query.panel : null
  return isPanel(panel) ? panel : 'overview'
})

function setPanel(panel: DashboardPanel) {
  void router.replace({
    path: '/dashboard',
    query: {
      ...route.query,
      panel: panel === 'overview' ? undefined : panel,
    },
  })
}

const currentDeviceId = computed(
  () => activeDeviceId.value || devices.value?.[0]?.deviceId || undefined,
)

const { data } = useConvexQuery(
  api.growmate.dashboard,
  computed(() => ({ deviceId: currentDeviceId.value })),
)

const { data: plantLibrary } = useConvexQuery(api.growmate.plantLibrary, {})

const { data: historyData } = useConvexQuery(
  api.growmate.deviceHistory,
  computed(() => ({ deviceId: currentDeviceId.value })),
)

const emptySensorHistory = [
  { value: 0, measuredAt: 0 },
  { value: 0, measuredAt: 1 },
]

const fallbackSensors = [
  { kind: 'soil', label: 'Kelembapan Tanah', unit: '%', accent: 'earth' },
  { kind: 'light', label: 'Intensitas Cahaya', unit: '%', accent: 'sun' },
  { kind: 'temperature', label: 'Suhu', unit: 'C', accent: 'warm' },
  { kind: 'air', label: 'Kelembapan Udara', unit: '%', accent: 'air' },
  { kind: 'water', label: 'Level Air', unit: '%', accent: 'water' },
] as const

const { mutate: triggerWater } = useConvexMutation(api.growmate.triggerWatering)
const { mutate: triggerLighting } = useConvexMutation(api.growmate.triggerLighting)
const { mutate: updateAutomation } = useConvexMutation(api.growmate.updateDeviceAutomation)
const { mutate: toggleSchedule } = useConvexMutation(api.growmate.toggleCareSchedule)
const { mutate: saveCareSchedule } = useConvexMutation(api.growmate.saveCareSchedule)
const { mutate: deleteCareSchedule } = useConvexMutation(api.growmate.deleteCareSchedule)
const { mutate: removeDevice } = useConvexMutation(api.growmate.removeDevice)

const scheduleForm = ref({
  scheduleId: null as string | null,
  title: '',
  cadenceValue: 1,
  cadenceUnit: 'days' as ScheduleCadenceUnit,
  timeOfDay: '08:00',
})
const savingSchedule = ref(false)
const deletingScheduleId = ref<string | null>(null)
const removingDeviceId = ref<string | null>(null)

const waterSensor = computed(
  () => data.value?.sensors.find((sensor) => sensor.kind === 'water') ?? null,
)
const displayPlantImage = computed(() => {
  const plant = data.value?.plant
  if (!plant) return null
  if (plant.image) return plant.image

  return (
    plantLibrary.value?.find(
      (preset) => preset.name === plant.name || preset.species === plant.species,
    )?.image ?? null
  )
})

const displaySensors = computed(() => {
  const sensors = data.value?.sensors ?? []
  if (sensors.length > 0) return sensors

  return fallbackSensors.map((sensor) => ({
    _id: `empty-${sensor.kind}`,
    kind: sensor.kind,
    value: 0,
    unit: sensor.unit,
    label: sensor.label,
    status: 'Tidak ada data',
    target: 'Menunggu pembacaan pertama',
    accent: sensor.accent,
    history: emptySensorHistory,
  }))
})
const schedulePreview = computed(() => {
  const cadenceValue = Math.max(1, Number(scheduleForm.value.cadenceValue) || 1)
  if (scheduleForm.value.cadenceUnit === 'hours') {
    return cadenceValue === 1
      ? 'Berjalan setiap jam setelah Anda menandainya selesai.'
      : `Berjalan setiap ${cadenceValue} jam setelah Anda menandainya selesai.`
  }

  const timeLabel = formatClockLabel(scheduleForm.value.timeOfDay)
  return cadenceValue === 1
    ? `Berjalan setiap hari pukul ${timeLabel}.`
    : `Berjalan setiap ${cadenceValue} hari pukul ${timeLabel}.`
})

const historyMetricCards = computed(() => {
  const metricHistory = historyData.value?.metricHistory
  if (!metricHistory) return []

  return [
    { key: 'soil', label: 'Tanah', unit: '%', stroke: '#7a5649', fill: 'rgba(122, 86, 73, 0.12)' },
    { key: 'light', label: 'Cahaya', unit: '%', stroke: '#006e1c', fill: 'rgba(0, 110, 28, 0.12)' },
    {
      key: 'temperature',
      label: 'Suhu',
      unit: 'C',
      stroke: '#c56b00',
      fill: 'rgba(197, 107, 0, 0.12)',
    },
    {
      key: 'air',
      label: 'Kelembapan',
      unit: '%',
      stroke: '#006493',
      fill: 'rgba(0, 100, 147, 0.12)',
    },
    {
      key: 'water',
      label: 'Reservoir',
      unit: '%',
      stroke: '#00a4ed',
      fill: 'rgba(0, 164, 237, 0.12)',
    },
  ].map((metric) => {
    const points = metricHistory[metric.key] ?? []
    const latest = points[points.length - 1]?.value
    return { ...metric, points, latest }
  })
})

function handleSelectDevice(deviceId: string) {
  setActiveDeviceId(deviceId)
  toast.success('Perangkat aktif diperbarui')
}

function openSelectPlant(deviceId?: string) {
  void router.push({
    path: '/select-plant',
    query: {
      deviceId: deviceId ?? currentDeviceId.value,
      returnTo: '/dashboard',
      panel: activePanel.value,
    },
  })
}

function formatTimeInput(minutes: number | null | undefined) {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes ?? 8 * 60)))
  const hours = Math.floor(normalized / 60)
  const mins = normalized % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

function parseTimeInput(value: string) {
  const [hours, minutes] = value.split(':').map((part) => Number(part))
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return 8 * 60
  }

  return Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes))
}

function formatClockLabel(value: string) {
  const totalMinutes = parseTimeInput(value)
  const hours24 = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatPlantHealthLabel(value: string) {
  switch (value) {
    case 'excellent':
      return 'sangat baik'
    case 'good':
      return 'baik'
    case 'fair':
      return 'perlu perhatian'
    case 'poor':
      return 'kurang stabil'
    default:
      return value
  }
}

function resetScheduleForm() {
  scheduleForm.value = {
    scheduleId: null,
    title: '',
    cadenceValue: 1,
    cadenceUnit: 'days',
    timeOfDay: '08:00',
  }
}

function editSchedule(schedule: NonNullable<typeof data.value>['schedules'][number]) {
  scheduleForm.value = {
    scheduleId: schedule._id,
    title: schedule.title,
    cadenceValue: schedule.cadenceValue,
    cadenceUnit: schedule.cadenceUnit,
    timeOfDay: formatTimeInput(schedule.timeOfDayMinutes),
  }
}

watch(
  data,
  (value) => {
    if (!value || scheduleForm.value.timeOfDay) return
    resetScheduleForm()
  },
  { immediate: true },
)

async function handleWater() {
  if (!currentDeviceId.value) {
    toast.error('Pilih perangkat terlebih dahulu')
    return
  }

  try {
    await triggerWater({ deviceId: currentDeviceId.value })
    toast.success('Siklus penyiraman dimulai')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memicu penyiraman'))
  }
}

async function handleLight(enabled: boolean) {
  if (!currentDeviceId.value) {
    toast.error('Pilih perangkat terlebih dahulu')
    return
  }

  try {
    await triggerLighting({ deviceId: currentDeviceId.value, enabled })
    toast.success(enabled ? 'Lampu tumbuh dinyalakan' : 'Lampu tumbuh dimatikan')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mengubah pencahayaan'))
  }
}

async function handleToggleAutomation(type: 'watering' | 'lighting', enabled: boolean) {
  if (!data.value?.device) {
    toast.error('Pilih perangkat terlebih dahulu')
    return
  }

  try {
    if (type === 'watering') {
      await updateAutomation({
        deviceId: data.value.device.deviceId,
        autoWatering: !enabled,
      })
      toast.success(enabled ? 'Penyiraman otomatis dimatikan' : 'Penyiraman otomatis dinyalakan')
    } else {
      await updateAutomation({
        deviceId: data.value.device.deviceId,
        autoLighting: !enabled,
      })
      toast.success(enabled ? 'Pencahayaan otomatis dimatikan' : 'Pencahayaan otomatis dinyalakan')
    }
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memperbarui otomasi'))
  }
}

async function handleToggleSchedule(scheduleId: string, enabled: boolean) {
  try {
    await toggleSchedule({ scheduleId, enabled: !enabled })
    toast.success(enabled ? 'Jadwal dijeda' : 'Jadwal diaktifkan')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memperbarui jadwal'))
  }
}

async function handleSaveSchedule() {
  if (!currentDeviceId.value) {
    toast.error('Pilih perangkat terlebih dahulu')
    return
  }

  savingSchedule.value = true
  try {
    await saveCareSchedule({
      scheduleId: scheduleForm.value.scheduleId
        ? (scheduleForm.value.scheduleId as never)
        : undefined,
      deviceId: currentDeviceId.value,
      title: scheduleForm.value.title,
      cadenceValue: Math.max(1, Number(scheduleForm.value.cadenceValue) || 1),
      cadenceUnit: scheduleForm.value.cadenceUnit,
      timeOfDayMinutes:
        scheduleForm.value.cadenceUnit === 'days'
          ? parseTimeInput(scheduleForm.value.timeOfDay)
          : undefined,
      timezoneOffsetMinutes:
        scheduleForm.value.cadenceUnit === 'days' ? -new Date().getTimezoneOffset() : undefined,
    })
    toast.success(scheduleForm.value.scheduleId ? 'Jadwal diperbarui' : 'Jadwal dibuat')
    resetScheduleForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menyimpan jadwal'))
  } finally {
    savingSchedule.value = false
  }
}

async function handleDeleteSchedule(scheduleId: string) {
  deletingScheduleId.value = scheduleId
  try {
    await deleteCareSchedule({ scheduleId: scheduleId as never })
    if (scheduleForm.value.scheduleId === scheduleId) {
      resetScheduleForm()
    }
    toast.success('Jadwal dihapus')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus jadwal'))
  } finally {
    deletingScheduleId.value = null
  }
}

async function handleRemoveDevice(deviceId: string, name: string) {
  if (
    !window.confirm(
      `Hapus ${name} dari akun Anda? Perangkat akan menjadi tidak diklaim dan tanaman aktifnya akan diarsipkan.`,
    )
  ) {
    return
  }

  removingDeviceId.value = deviceId
  try {
    await removeDevice({ deviceId })
    if (activeDeviceId.value === deviceId) {
      setActiveDeviceId(null)
    }
    toast.success('Perangkat dihapus dari akun Anda')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus perangkat'))
  } finally {
    removingDeviceId.value = null
  }
}
</script>

<template>
  <div class="space-y-4" v-if="data">
    <section class="rounded-[1.75rem] bg-[#f3f3f3] p-2 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="panel in panelOptions"
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
          <span class="mt-1 text-[10px] font-bold uppercase tracking-[0.18em]">{{
            panel.label
          }}</span>
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

    <template v-else>
      <section v-if="activePanel === 'overview'" class="space-y-4">
        <article
          class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_36px_rgba(15,23,42,0.05)]"
        >
          <div class="relative min-h-[220px] bg-[#f3f3f3]">
            <img
              v-if="displayPlantImage"
              :src="displayPlantImage"
              :alt="data.plant.name"
              class="h-full w-full object-cover"
            />
            <div
              class="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent"
            ></div>
            <div
              class="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-black/35 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md"
            >
              <span class="material-symbols-outlined text-sm">eco</span>
              Kondisi {{ formatPlantHealthLabel(data.plant.health) }}
            </div>
            <div class="absolute bottom-4 left-4 right-4">
              <div class="rounded-[1.5rem] bg-white/16 p-4 backdrop-blur-md">
                <h1 class="font-headline text-3xl font-black tracking-tight text-white">
                  {{ data.plant.name }}
                </h1>
                <p class="mt-1 text-sm text-white/80">{{ data.plant.species }}</p>
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
                  <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">
                    Kondisi tanaman saat ini
                  </h2>
                </div>
              </div>

              <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <article
                  v-for="sensor in displaySensors"
                  :key="sensor._id"
                  class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div :class="['rounded-2xl p-3', accentMap[sensor.accent]]">
                      <span class="material-symbols-outlined text-[20px]">{{
                        iconMap[sensor.kind]
                      }}</span>
                    </div>
                    <div class="text-right">
                      <div
                        class="text-[11px] font-bold uppercase tracking-[0.18em] text-gm-primary"
                      >
                        {{ sensor.status }}
                      </div>
                      <div class="mt-1 text-xs text-gm-muted">{{ sensor.target }}</div>
                    </div>
                  </div>
                  <div class="mt-5">
                    <div class="text-sm font-medium text-gm-muted">{{ sensor.label }}</div>
                    <div class="mt-1 flex items-end gap-1">
                      <span class="font-headline text-4xl font-black tracking-tight text-gm-text">{{
                        sensor.value
                      }}</span>
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
                  <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">
                    Aksi cepat
                  </p>
                  <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">
                    Tindakan langsung
                  </h2>
                </div>
              </div>

              <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  class="rounded-[1.5rem] bg-gradient-to-r from-gm-primary to-gm-primary-soft px-4 py-4 text-left text-white"
                  @click="handleWater"
                >
                  <span class="material-symbols-outlined text-[22px]">water_drop</span>
                  <div class="mt-3 text-sm font-bold">Siram sekarang</div>
                </button>
                <button
                  type="button"
                  class="rounded-[1.5rem] bg-[#fff6da] px-4 py-4 text-left text-[#7a5a00]"
                  @click="handleLight(true)"
                >
                  <span class="material-symbols-outlined text-[22px]">light_mode</span>
                  <div class="mt-3 text-sm font-bold">Nyalakan lampu</div>
                </button>
                <button
                  type="button"
                  class="rounded-[1.5rem] bg-[#f3f3f3] px-4 py-4 text-left text-gm-text"
                  @click="handleLight(false)"
                >
                  <span class="material-symbols-outlined text-[22px]">dark_mode</span>
                  <div class="mt-3 text-sm font-bold">Matikan lampu</div>
                </button>
                <button
                  type="button"
                  class="rounded-[1.5rem] bg-[#e8f4ff] px-4 py-4 text-left text-[#006493]"
                  @click="openSelectPlant(data.device?.deviceId)"
                >
                  <span class="material-symbols-outlined text-[22px]">edit</span>
                  <div class="mt-3 text-sm font-bold">Ganti tanaman</div>
                </button>
              </div>
            </article>

            <article
              class="rounded-[2rem] bg-[#f3f3f3] p-5 shadow-[0_12px_32px_rgba(15,23,42,0.04)]"
            >
              <div class="flex items-start justify-between gap-4">
                <div>
                  <p class="text-xs font-bold uppercase tracking-[0.2em] text-[#006493]">
                    Cadangan air
                  </p>
                  <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">
                    {{ waterSensor?.value ?? 0 }}%
                  </h2>
                  <p class="mt-2 text-sm leading-relaxed text-gm-muted">
                    Perkiraan cukup untuk {{ data.reservoirDays }} hari ke depan
                  </p>
                </div>
                <div
                  class="relative h-28 w-16 overflow-hidden rounded-[1.25rem] bg-white shadow-inner"
                >
                  <div
                    class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-[#006493] to-[#00a4ed]"
                    :style="{ height: `${waterSensor?.value ?? 0}%` }"
                  ></div>
                  <div
                    class="absolute inset-0 flex items-center justify-center text-sm font-black text-gm-text mix-blend-overlay"
                  >
                    {{ waterSensor?.value ?? 0 }}%
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div class="space-y-4">
            <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div>
                <div>
                  <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">
                    Perangkat
                  </p>
                  <h2 class="mt-2 font-headline text-xl font-black tracking-tight text-gm-text">
                    {{ data.device?.name }}
                  </h2>
                </div>
              </div>
              <div class="mt-4 space-y-3 text-sm text-gm-muted">
                <div class="flex items-center justify-between gap-3">
                  <div class="min-w-0 truncate">{{ data.device?.deviceId }}</div>
                  <span
                    class="shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    :class="
                      data.device?.isOnline
                        ? 'bg-[#94f990]/35 text-[#005313]'
                        : 'bg-[#e8e8e8] text-gm-muted'
                    "
                  >
                      {{ data.device?.isOnline ? 'Terhubung' : 'Tidak terhubung' }}
                  </span>
                </div>
                <div v-if="data.device?.firmwareVersion">
                  Firmware {{ data.device.firmwareVersion }}
                </div>
              </div>
              <button
                type="button"
                class="mt-5 w-full rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-bold text-gm-text"
                @click="setPanel('devices')"
              >
                Kelola perangkat
              </button>
            </article>

            <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <div class="flex items-center justify-between gap-3">
                <div>
                  <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">
                    Peringatan
                  </p>
                  <h2 class="mt-2 font-headline text-xl font-black tracking-tight text-gm-text">
                    Ringkasan perhatian
                  </h2>
                </div>
              </div>
              <div v-if="data.alerts?.length" class="mt-4 space-y-3">
                <div
                  v-for="(alert, index) in data.alerts.slice(0, 3)"
                  :key="index"
                  class="rounded-[1.5rem] p-4 text-sm"
                  :class="
                    alert.type === 'critical'
                      ? 'bg-red-50 text-red-900'
                      : alert.type === 'warning'
                        ? 'bg-yellow-50 text-yellow-900'
                        : 'bg-[#cae6ff]/40 text-[#006493]'
                  "
                >
                  {{ alert.message }}
                </div>
              </div>
              <div v-else class="mt-4 rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted">
                Semua dalam kondisi stabil saat ini.
              </div>
            </article>
          </div>
        </section>
      </section>

      <section v-else-if="activePanel === 'care'" class="space-y-4">
        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Otomasi</p>
          <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">
                    Pengaturan perawatan
          </h1>
          <p class="mt-3 text-sm leading-relaxed text-gm-muted">
            Aktifkan atau matikan otomasi, jalankan aksi manual, dan kelola perawatan berulang dari
            satu tempat.
          </p>
        </article>

        <section class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div class="space-y-3">
              <div class="flex items-center justify-between rounded-[1.5rem] bg-[#f3f3f3] p-4">
                <div>
                  <div class="text-sm font-bold text-gm-text">Penyiraman otomatis</div>
                  <div class="mt-1 text-xs text-gm-muted">
                    Sistem membantu menjalankan penyiraman rutin sesuai pengaturan yang dipilih
                  </div>
                </div>
                <button
                  type="button"
                  class="relative flex h-7 w-12 items-center rounded-full px-1 transition-colors"
                  :class="data.device?.autoWatering ? 'bg-gm-primary' : 'bg-[#d7d7d7]'"
                  @click="handleToggleAutomation('watering', data.device?.autoWatering ?? false)"
                >
                  <span
                    class="h-5 w-5 rounded-full bg-white transition-transform"
                    :class="data.device?.autoWatering ? 'translate-x-5' : ''"
                  ></span>
                </button>
              </div>

              <div class="flex items-center justify-between rounded-[1.5rem] bg-[#f3f3f3] p-4">
                <div>
                  <div class="text-sm font-bold text-gm-text">Pencahayaan otomatis</div>
                  <div class="mt-1 text-xs text-gm-muted">
                    Sistem membantu menjaga pencahayaan tetap sesuai kebutuhan tanaman
                  </div>
                </div>
                <button
                  type="button"
                  class="relative flex h-7 w-12 items-center rounded-full px-1 transition-colors"
                  :class="data.device?.autoLighting ? 'bg-gm-primary' : 'bg-[#d7d7d7]'"
                  @click="handleToggleAutomation('lighting', data.device?.autoLighting ?? false)"
                >
                  <span
                    class="h-5 w-5 rounded-full bg-white transition-transform"
                    :class="data.device?.autoLighting ? 'translate-x-5' : ''"
                  ></span>
                </button>
              </div>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                class="rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-4 py-3 text-sm font-bold text-white"
                @click="handleWater"
              >
                Siram sekarang
              </button>
              <button
                type="button"
                class="rounded-full bg-[#fff6da] px-4 py-3 text-sm font-bold text-[#7a5a00]"
                @click="handleLight(!(data.device?.lightEnabled ?? false))"
              >
                {{ data.device?.lightEnabled ? 'Matikan lampu' : 'Nyalakan lampu' }}
              </button>
            </div>
          </article>

          <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div class="flex items-center justify-between gap-3">
              <div>
                <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Jadwal</p>
                <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">
                  Rutinitas perawatan
                </h2>
              </div>
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-2">
              <label class="md:col-span-2">
                <span class="mb-2 block text-sm font-semibold text-gm-text">Judul jadwal</span>
                <input
                  v-model="scheduleForm.title"
                  class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                  placeholder="Penyiraman pagi"
                />
              </label>
              <label>
                <span class="mb-2 block text-sm font-semibold text-gm-text">Ulangi setiap</span>
                <input
                  v-model="scheduleForm.cadenceValue"
                  type="number"
                  min="1"
                  class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                  placeholder="1"
                />
              </label>
              <label>
                <span class="mb-2 block text-sm font-semibold text-gm-text">Satuan</span>
                <select
                  v-model="scheduleForm.cadenceUnit"
                  class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                >
                  <option value="hours">Jam</option>
                  <option value="days">Hari</option>
                </select>
              </label>
              <label v-if="scheduleForm.cadenceUnit === 'days'" class="md:col-span-2">
                <span class="mb-2 block text-sm font-semibold text-gm-text"
                  >Waktu dalam sehari</span
                >
                <input
                  v-model="scheduleForm.timeOfDay"
                  type="time"
                  class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                />
              </label>
            </div>

            <div class="mt-4 rounded-[1.5rem] bg-[#f3f3f3] px-4 py-3 text-sm text-gm-muted">
              {{ schedulePreview }}
            </div>

            <div class="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="rounded-full bg-gm-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                :disabled="savingSchedule"
                @click="handleSaveSchedule"
              >
                {{
                  savingSchedule
                    ? 'Menyimpan...'
                    : scheduleForm.scheduleId
                      ? 'Perbarui rutinitas'
                      : 'Buat rutinitas'
                }}
              </button>
              <button
                v-if="scheduleForm.scheduleId"
                type="button"
                class="rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-bold text-gm-text"
                @click="resetScheduleForm"
              >
                Batal edit
              </button>
            </div>

            <div v-if="data.schedules?.length" class="mt-5 space-y-3">
              <article
                v-for="schedule in data.schedules"
                :key="schedule._id"
                class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
              >
                <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div class="text-sm font-bold text-gm-text">{{ schedule.title }}</div>
                    <div class="mt-1 text-sm text-gm-muted">{{ schedule.cadenceLabel }}</div>
                    <div class="mt-1 text-xs text-gm-muted">
                      Berikutnya {{ schedule.nextRunLabel }}
                    </div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="rounded-full bg-white px-4 py-2 text-xs font-bold text-gm-text"
                      @click="editSchedule(schedule)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="rounded-full bg-white px-4 py-2 text-xs font-bold text-gm-text"
                      @click="handleToggleSchedule(schedule._id, schedule.enabled)"
                    >
                      {{ schedule.enabled ? 'Jeda' : 'Lanjutkan' }}
                    </button>
                    <button
                      type="button"
                      class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50"
                      :disabled="deletingScheduleId === schedule._id"
                      @click="handleDeleteSchedule(schedule._id)"
                    >
                      {{ deletingScheduleId === schedule._id ? 'Menghapus...' : 'Hapus' }}
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <div v-else class="mt-5 rounded-[1.5rem] bg-[#f3f3f3] p-5 text-sm text-gm-muted">
              Belum ada rutinitas perawatan. Buat satu di atas.
            </div>
          </article>
        </section>
      </section>

      <section v-else-if="activePanel === 'devices'" class="space-y-4">
        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Armada</p>
          <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">
            Pod GrowMate Anda
          </h1>
          <p class="mt-3 text-sm leading-relaxed text-gm-muted">
            Kelola perangkat dan arsip perangkat Anda, tambah atau hapus, serta ganti tanamannya.
          </p>
          <div class="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white"
              @click="router.push({ path: '/claim-device', query: { manual: '1' } })"
            >
              Hubungkan perangkat lain
            </button>
          </div>
        </article>

        <div class="space-y-4">
          <article
            v-for="device in devices"
            :key="device.deviceId"
            class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
          >
            <div class="flex flex-col gap-4">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <h2 class="font-headline text-2xl font-black tracking-tight text-gm-text">
                    {{ device.name }}
                  </h2>
                  <p class="mt-1 text-sm text-gm-muted">{{ device.deviceId }}</p>
                </div>
                <div class="flex flex-col items-end gap-2">
                  <span
                    class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    :class="
                      device.deviceId === currentDeviceId
                        ? 'bg-gm-primary text-white'
                        : 'bg-[#f3f3f3] text-gm-muted'
                    "
                  >
                    {{ device.deviceId === currentDeviceId ? 'Aktif' : 'Siaga' }}
                  </span>
                  <span
                    class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                    :class="
                      device.isOnline
                        ? 'bg-[#94f990]/35 text-[#005313]'
                        : 'bg-[#e8e8e8] text-gm-muted'
                    "
                  >
                    {{ device.isOnline ? 'Terhubung' : 'Tidak terhubung' }}
                  </span>
                </div>
              </div>

              <div v-if="device.plant" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
                <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
                  Tanaman saat ini
                </div>
                <div class="mt-2 text-lg font-bold text-gm-text">{{ device.plant.name }}</div>
                <div class="mt-1 text-sm text-gm-muted">{{ device.plant.species }}</div>
              </div>
              <div v-else class="rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted">
                Perangkat ini sudah diklaim tetapi masih menunggu profil tanaman.
              </div>

              <div v-if="device.archivedPlants?.length" class="space-y-2">
                <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
                  Arsip terbaru
                </div>
                <div class="grid gap-2 sm:grid-cols-2">
                  <div
                    v-for="plant in device.archivedPlants"
                    :key="plant._id"
                    class="rounded-[1.25rem] bg-[#f3f3f3] p-3"
                  >
                    <div class="text-sm font-bold text-gm-text">{{ plant.name }}</div>
                    <div class="mt-1 text-xs text-gm-muted">
                      Diarsipkan {{ plant.archivedAtLabel }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  class="rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-bold text-gm-text"
                  @click="handleSelectDevice(device.deviceId)"
                >
                  Jadikan aktif
                </button>
                <button
                  type="button"
                  class="rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-4 py-3 text-sm font-bold text-white"
                  @click="openSelectPlant(device.deviceId)"
                >
                  {{ device.plant ? 'Ganti tanaman' : 'Pilih tanaman' }}
                </button>
                <button
                  type="button"
                  class="rounded-full bg-[#ffdbcf] px-4 py-3 text-sm font-bold text-[#795548] disabled:opacity-50"
                  :disabled="removingDeviceId === device.deviceId"
                  @click="handleRemoveDevice(device.deviceId, device.name)"
                >
                  {{ removingDeviceId === device.deviceId ? 'Menghapus...' : 'Hapus' }}
                </button>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section v-else class="space-y-4">
        <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Riwayat</p>
          <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">
            Arsip metrik
          </h1>
          <p class="mt-3 text-sm leading-relaxed text-gm-muted">
            Riwayat data metrik dan sensor, berfokus pada tren, timeline, dan tanaman yang
            diarsipkan.
          </p>
        </article>

        <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article
            v-for="metric in historyMetricCards"
            :key="metric.key"
            class="rounded-[1.75rem] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-gm-muted">{{ metric.label }}</p>
              <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-gm-primary"
                >Riwayat</span
              >
            </div>
            <div class="mt-3 flex items-end gap-1">
              <span class="font-headline text-3xl font-black tracking-tight text-gm-text">{{
                metric.latest ?? '--'
              }}</span>
              <span class="pb-1 text-xs font-bold text-gm-muted">{{ metric.unit }}</span>
            </div>
            <div class="mt-4 h-20 rounded-[1.25rem] bg-[#f3f3f3] p-2">
              <MetricLineChart
                :points="metric.points"
                :height="80"
                :stroke="metric.stroke"
                :fill="metric.fill"
              />
            </div>
          </article>
        </section>

        <section class="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" v-if="historyData">
          <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <div>
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Linimasa</p>
              <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">
                Aktivitas budidaya terbaru
              </h2>
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
                    <div v-if="event.detail" class="mt-1 text-sm text-gm-muted">
                      {{ event.detail }}
                    </div>
                  </div>
                  <div class="text-right text-[11px] text-gm-muted">
                    <div>{{ event.timestampLabel }}</div>
                    <div>{{ event.relativeTime }}</div>
                  </div>
                </div>
              </article>
            </div>

            <div v-else class="mt-5 rounded-[1.5rem] bg-[#f3f3f3] p-5 text-sm text-gm-muted">
              Riwayat akan muncul setelah pembaruan telemetri dan aksi perawatan pertama.
            </div>
          </article>

          <div class="space-y-4">
            <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">
                Tanaman saat ini
              </p>
              <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">
                {{ historyData.currentPlant?.name || 'Tidak ada tanaman aktif' }}
              </h2>
              <p v-if="historyData.currentPlant" class="mt-2 text-sm text-gm-muted">
                {{ historyData.currentPlant.species }}
              </p>

              <div v-if="historyData.imageHistory.length" class="mt-4 grid grid-cols-2 gap-2">
                <div
                  v-for="image in historyData.imageHistory.slice(0, 4)"
                  :key="image._id"
                  class="overflow-hidden rounded-[1.25rem] bg-[#f3f3f3]"
                >
                  <img
                    :src="image.image"
                    :alt="historyData.currentPlant?.name || 'Snapshot tanaman'"
                    class="h-24 w-full object-cover"
                  />
                  <div class="px-3 py-2 text-[11px] text-gm-muted">{{ image.capturedAtLabel }}</div>
                </div>
              </div>
            </article>

            <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
              <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Arsip</p>
              <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">
                Tanaman sebelumnya pada pod ini
              </h2>

              <div v-if="historyData.archivedPlants.length" class="mt-4 space-y-3">
                <article
                  v-for="plant in historyData.archivedPlants"
                  :key="plant._id"
                  class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
                >
                  <div class="text-sm font-bold text-gm-text">{{ plant.name }}</div>
                  <div class="mt-1 text-sm text-gm-muted">{{ plant.species }}</div>
                  <div class="mt-2 text-[11px] text-gm-muted">
                    Ditanam {{ plant.plantedAtLabel }} • Diarsipkan {{ plant.archivedAtLabel }}
                  </div>
                </article>
              </div>

              <div v-else class="mt-4 rounded-[1.5rem] bg-[#f3f3f3] p-5 text-sm text-gm-muted">
                Belum ada tanaman yang diarsipkan untuk perangkat ini.
              </div>
            </article>
          </div>
        </section>
      </section>
    </template>
  </div>

  <div
    v-else
    class="rounded-[2rem] bg-white p-6 text-sm text-gm-muted shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
  >
    Memuat dashboard...
  </div>
</template>
