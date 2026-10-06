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

export type DashboardPanel = 'overview' | 'care' | 'devices' | 'history' | 'stream'

/**
 * Dashboard facade: panel routing, device data subscriptions, derived
 * display state, and manual care actions. Selection/sync lives in
 * `useDeviceSelection`, schedule state/handlers in `useSchedules`, and V2
 * recordings loading in `useRecordings`.
 */
export function useDashboard() {
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
    return value === 'overview' || value === 'care' || value === 'devices' || value === 'history' || value === 'stream'
  }

  const { devices, currentDeviceId, handleSelectDevice, handleDeviceUnregistered } =
    useDeviceSelection()

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

  const { data } = useConvexQuery(
    api.devices.dashboard,
    computed(() => ({ deviceId: currentDeviceId.value })),
  )

  const { data: plantLibrary } = useConvexQuery(api.plants.plantLibrary, {})

  const { data: historyData } = useConvexQuery(
    api.devices.deviceHistory,
    computed(() => ({ deviceId: currentDeviceId.value, paginationOpts: { numItems: 20, cursor: null } })),
  )

  const isV2 = computed(() => data.value?.device?.version === 'v2')

  const {
    recordings,
    recordingsError,
    recordingsLoading,
    recordingsRetryCount,
    fetchRecordings,
    retryRecordings,
  } = useRecordings(currentDeviceId, isV2)

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

  const streamUrl = computed(() => {
    if (!isV2.value) return null
    const baseUrl = `/api/v2/stream/${currentDeviceId.value}/live`
    const token = authState.token.value
    return token ? `${baseUrl}?token=${encodeURIComponent(token)}` : baseUrl
  })

  const streamActive = ref(false)
  const isLiveLoading = ref(false)

  const batterySoC = computed(() => data.value?.device?.batterySoC ?? 50)
  const batteryCurrent = computed(() => data.value?.device?.batteryCurrent ?? 0)
  const batteryCapacityAh = computed(() => data.value?.device?.batteryCapacityAh ?? 5)
  const tankSwitchOpen = computed(() => data.value?.device?.reportedTankSwitchOpen ?? false)
  const drawerSwitchOpen = computed(() => data.value?.device?.reportedDrawerSwitchOpen ?? false)
  const hasModem = computed(() => data.value?.device?.hasModem ?? false)
  const hasSolarPanel = computed(() => data.value?.device?.hasSolarPanel ?? false)
  const solarPanelWatts = computed(() => data.value?.device?.solarPanelWatts ?? 0)
  const tankCapacity = computed(() => data.value?.device?.tankCapacity ?? 10)
  const tankMinLevel = computed(() => data.value?.device?.tankMinLevel ?? 10)

  const batteryIcon = computed(() => {
    const soc = batterySoC.value
    if (soc > 75) return 'battery_full'
    if (soc > 50) return 'battery_5_bar'
    if (soc > 25) return 'battery_3_bar'
    return 'battery_0_bar'
  })

  const timeToEmpty = computed(() => {
    if (batteryCurrent.value >= 0) return 'Tidak discharging'
    const hours = (batterySoC.value / 100 * batteryCapacityAh.value * 1000) / -batteryCurrent.value
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

  const fallbackSensors = computed(() => [
    { kind: 'soil', label: 'Kelembapan Tanah', unit: '%', accent: 'earth' },
    { kind: 'light', label: 'Intensitas Cahaya', unit: '%', accent: 'sun' },
    { kind: 'temperature', label: 'Suhu', unit: 'C', accent: 'warm' },
    { kind: 'air', label: 'Kelembapan Udara', unit: '%', accent: 'air' },
    { kind: 'water', label: isV2.value ? 'Level Tangki Pupuk' : 'Level Air', unit: '%', accent: 'water' },
  ] as const)

  const { mutate: triggerWater } = useConvexMutation(api.care.triggerWatering)
  const { mutate: triggerLighting } = useConvexMutation(api.care.triggerLighting)
  const { mutate: triggerFertilizing } = useConvexMutation(api.care.triggerFertilizing)
  const { mutate: triggerPesticide } = useConvexMutation(api.care.triggerPesticide)
  const { mutate: updateAutomation } = useConvexMutation(api.devices.updateDeviceAutomation)
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
      const points = (metricHistory as Record<string, Array<{ value: number; measuredAt: number }>>)[metric.key] ?? []
      const latest = points[points.length - 1]?.value
      return { ...metric, points, latest }
    })
  })

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

  type DoseKind = 'water' | 'light' | 'fertilize' | 'pesticide'

  const doseConfig: Record<
    DoseKind,
    {
      run: (args: { deviceId: string; enabled: boolean }) => Promise<unknown>
      success: (enabled: boolean) => string
      failure: string
    }
  > = {
    water: {
      run: (args) => triggerWater({ deviceId: args.deviceId }),
      success: () => 'Siklus penyiraman dimulai',
      failure: 'Gagal memicu penyiraman',
    },
    light: {
      run: (args) => triggerLighting({ deviceId: args.deviceId, enabled: args.enabled }),
      success: (enabled) => (enabled ? 'Lampu tumbuh dinyalakan' : 'Lampu tumbuh dimatikan'),
      failure: 'Gagal mengubah pencahayaan',
    },
    fertilize: {
      run: (args) => triggerFertilizing({ deviceId: args.deviceId }),
      success: () => 'Siklus pemupukan dimulai',
      failure: 'Gagal memicu pemupukan',
    },
    pesticide: {
      run: (args) => triggerPesticide({ deviceId: args.deviceId }),
      success: () => 'Siklus pestisida dimulai',
      failure: 'Gagal memicu pestisida',
    },
  }

  async function handleDose(kind: DoseKind, enabled = false) {
    if (!currentDeviceId.value) {
      toast.error('Pilih perangkat terlebih dahulu')
      return
    }
    const config = doseConfig[kind]
    try {
      await config.run({ deviceId: currentDeviceId.value, enabled })
      toast.success(config.success(enabled))
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, config.failure))
    }
  }

  async function handleWater() {
    await handleDose('water')
  }

  async function handleLight(enabled: boolean) {
    await handleDose('light', enabled)
  }

  async function handleFertilize() {
    await handleDose('fertilize')
  }

  async function handlePesticide() {
    await handleDose('pesticide')
  }

  type AutomationType = 'watering' | 'lighting' | 'fertilizing' | 'pesticide'

  const automationConfig: Record<
    AutomationType,
    {
      field: 'autoWatering' | 'autoLighting' | 'autoFertilizing' | 'autoPesticide'
      onToast: string
      offToast: string
    }
  > = {
    watering: {
      field: 'autoWatering',
      onToast: 'Penyiraman otomatis dinyalakan',
      offToast: 'Penyiraman otomatis dimatikan',
    },
    lighting: {
      field: 'autoLighting',
      onToast: 'Pencahayaan otomatis dinyalakan',
      offToast: 'Pencahayaan otomatis dimatikan',
    },
    fertilizing: {
      field: 'autoFertilizing',
      onToast: 'Pemupukan otomatis dinyalakan',
      offToast: 'Pemupukan otomatis dimatikan',
    },
    pesticide: {
      field: 'autoPesticide',
      onToast: 'Pestisida otomatis dinyalakan',
      offToast: 'Pestisida otomatis dimatikan',
    },
  }

  async function handleToggleAutomation(type: AutomationType, enabled: boolean) {
    if (!data.value?.device) {
      toast.error('Pilih perangkat terlebih dahulu')
      return
    }
    try {
      const config = automationConfig[type]
      await updateAutomation({
        deviceId: data.value.device.deviceId,
        [config.field]: !enabled,
      } as Parameters<typeof updateAutomation>[0])
      toast.success(enabled ? config.offToast : config.onToast)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal memperbarui otomasi'))
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
    panelOptions, iconMap, accentMap,
    devices, data, plantLibrary, historyData,
    activePanel, currentDeviceId,
    waterSensor, displayPlantImage, displaySensors,
    schedulePreview, historyMetricCards,
    scheduleForm, savingSchedule, deletingScheduleId, removingDeviceId,

    // methods
    setPanel, handleSelectDevice, openSelectPlant,
    handleWater, handleLight, handleFertilize, handlePesticide, handleToggleAutomation,
    handleToggleSchedule, handleSaveSchedule, handleDeleteSchedule,
    handleRemoveDevice,
    resetScheduleForm, editSchedule,
    formatPlantHealthLabel,

    // V2
    isV2, streamUrl, recordings, recordingsError, recordingsLoading, recordingsRetryCount,
    streamActive, isLiveLoading, fetchRecordings, retryRecordings,
    batterySoC, batteryCurrent, batteryCapacityAh, batteryIcon,
    timeToEmpty, timeToFull,
    tankSwitchOpen, drawerSwitchOpen,
    hasModem, hasSolarPanel, solarPanelWatts,
    tankCapacity, tankMinLevel,
  }
}
