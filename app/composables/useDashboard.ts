import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '~~/convex/_generated/api'
import { getImageUrl } from '@/utils/images'
import { getErrorMessage } from '~~/shared/utils/errors'
import { useDeviceSelection } from '@/composables/useDeviceSelection'
import { useSchedules } from '@/composables/useSchedules'
import { useRecordings } from '@/composables/useRecordings'
import { authState } from '@/utils/auth'
import { DEFAULT_TANK_CAPACITY, DEFAULT_TANK_MIN_LEVEL } from '~~/convex/types'
import { useDevicePanels } from '@/composables/dashboard/devicePanels'
import { useDoseActions } from '@/composables/dashboard/doseActions'

export type { DashboardPanel } from '@/composables/dashboard/devicePanels'

// convex/types.ts has no battery/solar fallback constants (read-only check),
// so the missing literals live next to their usage.
const DEFAULT_BATTERY_SOC = 50
const DEFAULT_BATTERY_CURRENT = 0
const DEFAULT_BATTERY_CAPACITY_AH = 5
const DEFAULT_SOLAR_PANEL_WATTS = 0

/**
 * Dashboard facade: panel routing, device data subscriptions, derived
 * display state, and manual care actions. Selection/sync lives in
 * `useDeviceSelection`, schedule state/handlers in `useSchedules`, V2
 * recordings loading in `useRecordings`, panel routing in
 * `dashboard/devicePanels`, and dose/automation tables in
 * `dashboard/doseActions`.
 */
export function useDashboard() {
  const { devices, currentDeviceId, handleSelectDevice, handleDeviceUnregistered } =
    useDeviceSelection()

  const { panelOptions, iconMap, accentMap, activePanel, setPanel, openSelectPlant } =
    useDevicePanels(currentDeviceId)

  const { data } = useConvexQuery(
    api.devices.dashboard,
    computed(() => ({ deviceId: currentDeviceId.value })),
  )

  const { data: plantLibrary } = useConvexQuery(api.plants.plantLibrary, {})

  const { data: historyData } = useConvexQuery(
    api.devices.deviceHistory,
    computed(() => ({
      deviceId: currentDeviceId.value,
      paginationOpts: { numItems: 20, cursor: null },
    })),
  )

  const isV2 = computed(() => data.value?.device?.version === 'v2')

  // Recordings stay subscribed-off here: HistoryPanel owns the single live
  // recordings fetch (paginated ?limit=, grown by "Muat lagi"), and this
  // facade never renders the list itself (dashboard.vue does not consume
  // these keys). Leaving the eager default-50 fetch on would double every
  // v2 recordings request. The keys remain so the facade shape is stable.
  const {
    recordings,
    recordingsError,
    recordingsLoading,
    recordingsRetryCount,
    fetchRecordings,
    retryRecordings,
  } = useRecordings(currentDeviceId, isV2, { enabled: false })

  const {
    scheduleForm,
    savingSchedule,
    deletingScheduleId,
    schedulePreview,
    resetScheduleForm,
    editSchedule,
    handleToggleSchedule,
    handleSaveSchedule,
    handleDeleteSchedule,
  } = useSchedules(currentDeviceId)

  const deviceRef = computed(() => data.value?.device as { deviceId: string } | null | undefined)

  const {
    handleWater,
    handleLight,
    handleFertilize,
    handlePesticide,
    handleStartStream,
    handleStopStream,
    handleToggleAutomation,
  } = useDoseActions(currentDeviceId, deviceRef)

  const isStreaming = computed(() => data.value?.device?.lastStreaming ?? false)

  const streamUrl = computed(() => {
    if (!isV2.value) return null
    const baseUrl = `/api/v1/video/live/${currentDeviceId.value}`
    const token = authState.token.value
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
  })

  const streamActive = ref(false)
  const isLiveLoading = ref(false)

  const batterySoC = computed(() => data.value?.device?.batterySoC ?? DEFAULT_BATTERY_SOC)
  const batteryCurrent = computed(
    () => data.value?.device?.batteryCurrent ?? DEFAULT_BATTERY_CURRENT,
  )
  const batteryCapacityAh = computed(
    () => data.value?.device?.batteryCapacityAh ?? DEFAULT_BATTERY_CAPACITY_AH,
  )
  const tankSwitchOpen = computed(() => data.value?.device?.reportedTankSwitchOpen ?? false)
  const drawerSwitchOpen = computed(() => data.value?.device?.reportedDrawerSwitchOpen ?? false)
  const hasModem = computed(() => data.value?.device?.hasModem ?? false)
  const hasSolarPanel = computed(() => data.value?.device?.hasSolarPanel ?? false)
  const solarPanelWatts = computed(
    () => data.value?.device?.solarPanelWatts ?? DEFAULT_SOLAR_PANEL_WATTS,
  )
  const tankCapacity = computed(() => data.value?.device?.tankCapacity ?? DEFAULT_TANK_CAPACITY)
  const tankMinLevel = computed(() => data.value?.device?.tankMinLevel ?? DEFAULT_TANK_MIN_LEVEL)

  const batteryIcon = computed(() => {
    const soc = batterySoC.value
    if (soc > 75) return 'battery_full'
    if (soc > 50) return 'battery_5_bar'
    if (soc > 25) return 'battery_3_bar'
    return 'battery_0_bar'
  })

  const timeToEmpty = computed(() => {
    if (batteryCurrent.value >= 0) return 'Tidak discharging'
    const hours =
      ((batterySoC.value / 100) * batteryCapacityAh.value * 1000) / -batteryCurrent.value
    return `~${Math.round(hours * 60)} menit tersisa`
  })

  const timeToFull = computed(() => {
    if (batteryCurrent.value <= 0) return 'Tidak charging'
    const remainingAh = (1 - batterySoC.value / 100) * batteryCapacityAh.value
    const hours = (remainingAh * 1000) / batteryCurrent.value
    return `~${Math.round(hours * 60)} menit hingga penuh`
  })

  const emptySensorHistory = [
    { value: 0, measuredAt: 0 },
    { value: 0, measuredAt: 1 },
  ]

  const fallbackSensors = computed(
    () =>
      [
        { kind: 'soil', label: 'Kelembapan Tanah', unit: '%', accent: 'earth' },
        { kind: 'light', label: 'Intensitas Cahaya', unit: '%', accent: 'sun' },
        { kind: 'temperature', label: 'Suhu', unit: '°C', accent: 'warm' },
        { kind: 'air', label: 'Kelembapan Udara', unit: '%', accent: 'air' },
        {
          kind: 'water',
          label: isV2.value ? 'Level Tangki Pupuk' : 'Level Air',
          unit: '%',
          accent: 'water',
        },
      ] as const,
  )

  const { mutate: removeDevice } = useConvexMutation(api.devices.removeDevice)

  const removingDeviceId = ref<string | null>(null)

  const waterSensor = computed(
    () => data.value?.sensors.find((sensor: { kind: string }) => sensor.kind === 'water') ?? null,
  )

  const displayPlantImage = computed(() => {
    const plant = data.value?.plant
    if (!plant) return null
    if (plant.imageUrl) return getImageUrl(plant.imageUrl)
    const preset = plantLibrary.value?.find(
      (preset: { name: string; species: string }) =>
        preset.name === plant.name || preset.species === plant.species,
    )
    return preset?.imageUrl ? getImageUrl(preset.imageUrl) : null
  })

  const displaySensors = computed(() => {
    const sensors = data.value?.sensors ?? []
    if (sensors.length > 0) return sensors

    return fallbackSensors.value.map((sensor) => ({
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

  const historyMetricCards = computed(() => {
    const metricHistory = historyData.value?.metricHistory
    if (!metricHistory) return []

    return [
      {
        key: 'soil',
        label: 'Tanah',
        unit: '%',
        stroke: '#7a5649',
        fill: 'rgba(122, 86, 73, 0.12)',
      },
      {
        key: 'light',
        label: 'Cahaya',
        unit: '%',
        stroke: '#006e1c',
        fill: 'rgba(0, 110, 28, 0.12)',
      },
      {
        key: 'temperature',
        label: 'Suhu',
        unit: '°C',
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
      const points =
        (metricHistory as Record<string, Array<{ value: number; measuredAt: number }>>)[
          metric.key
        ] ?? []
      const latest = points[points.length - 1]?.value
      return { ...metric, points, latest }
    })
  })

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

  watch(
    data,
    (value) => {
      if (!value || scheduleForm.value.timeOfDay) return
      resetScheduleForm()
    },
    { immediate: true },
  )

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
      handleDeviceUnregistered(deviceId)
      toast.success('Perangkat dihapus dari akun Anda')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menghapus perangkat'))
    } finally {
      removingDeviceId.value = null
    }
  }

  return {
    // state
    panelOptions,
    iconMap,
    accentMap,
    devices,
    data,
    plantLibrary,
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

    // methods
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
    formatPlantHealthLabel,

    // V2
    isV2,
    streamUrl,
    recordings,
    recordingsError,
    recordingsLoading,
    recordingsRetryCount,
    streamActive,
    isLiveLoading,
    fetchRecordings,
    retryRecordings,
    batterySoC,
    batteryCurrent,
    batteryCapacityAh,
    batteryIcon,
    timeToEmpty,
    timeToFull,
    tankSwitchOpen,
    drawerSwitchOpen,
    hasModem,
    hasSolarPanel,
    solarPanelWatts,
    tankCapacity,
    tankMinLevel,
  }
}
