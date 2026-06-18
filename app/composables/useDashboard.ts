import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'
import type { Id } from '@/lib/convex-types'

export type DashboardPanel = 'overview' | 'care' | 'devices' | 'history'
type ScheduleCadenceUnit = 'hours' | 'days'

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
    return value === 'overview' || value === 'care' || value === 'devices' || value === 'history'
  }

  const { data: devices } = useConvexQuery(api.devices.userDevices, {})

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
    api.devices.dashboard,
    computed(() => ({ deviceId: currentDeviceId.value })),
  )

  const { data: plantLibrary } = useConvexQuery(api.plants.plantLibrary, {})

  const { data: historyData } = useConvexQuery(
    api.devices.deviceHistory,
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

  const { mutate: triggerWater } = useConvexMutation(api.care.triggerWatering)
  const { mutate: triggerLighting } = useConvexMutation(api.care.triggerLighting)
  const { mutate: updateAutomation } = useConvexMutation(api.devices.updateDeviceAutomation)
  const { mutate: toggleSchedule } = useConvexMutation(api.care.toggleCareSchedule)
  const { mutate: saveCareSchedule } = useConvexMutation(api.care.saveCareSchedule)
  const { mutate: deleteCareSchedule } = useConvexMutation(api.care.deleteCareSchedule)
  const { mutate: removeDevice } = useConvexMutation(api.devices.removeDevice)

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
    () => data.value?.sensors.find((sensor: { kind: string }) => sensor.kind === 'water') ?? null,
  )

  const displayPlantImage = computed(() => {
    const plant = data.value?.plant
    if (!plant) return null
    if (plant.image) return plant.image
    return (
      plantLibrary.value?.find(
        (preset: { name: string; species: string }) =>
          preset.name === plant.name || preset.species === plant.species,
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
      const points = (metricHistory as Record<string, Array<{ value: number; measuredAt: number }>>)[metric.key] ?? []
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
    const parts = value.split(':').map((part) => Number(part))
    const hours = parts[0] ?? NaN
    const minutes = parts[1] ?? NaN
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

  function editSchedule(schedule: { _id: string; title: string; cadenceValue: number; cadenceUnit: string; timeOfDayMinutes: number | null }) {
    scheduleForm.value = {
      scheduleId: schedule._id,
      title: schedule.title,
      cadenceValue: schedule.cadenceValue,
      cadenceUnit: schedule.cadenceUnit as ScheduleCadenceUnit,
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
      await toggleSchedule({ scheduleId: scheduleId as Id<'careSchedules'>, enabled: !enabled })
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
          ? (scheduleForm.value.scheduleId as Id<'careSchedules'>)
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
      await deleteCareSchedule({ scheduleId: scheduleId as Id<'careSchedules'> })
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
    handleWater, handleLight, handleToggleAutomation,
    handleToggleSchedule, handleSaveSchedule, handleDeleteSchedule,
    handleRemoveDevice,
    resetScheduleForm, editSchedule,
    formatPlantHealthLabel,
  }
}
