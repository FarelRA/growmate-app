import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '~~/convex/_generated/api'
import { getErrorMessage } from '~~/shared/utils/errors'
import type { Id } from '@/utils/convex-types'

export type ScheduleCadenceUnit = 'hours' | 'days'

export interface ScheduleFormState {
  scheduleId: string | null
  title: string
  cadenceValue: number
  cadenceUnit: ScheduleCadenceUnit
  timeOfDay: string
}

export interface EditableSchedule {
  _id: string
  title: string
  cadenceValue: number
  cadenceUnit: string
  timeOfDayMinutes?: number | null
}

/**
 * Owns the care-schedule form, preview, and schedule mutation handlers.
 * Manual care actions (water/light/fertilize/pesticide) stay in
 * `useDashboard`; everything schedule-shaped lives here.
 */
export function useSchedules(currentDeviceId: Ref<string | undefined>) {
  const { mutate: toggleSchedule } = useConvexMutation(api.care.toggleCareSchedule)
  const { mutate: saveCareSchedule } = useConvexMutation(api.care.saveCareSchedule)
  const { mutate: deleteCareSchedule } = useConvexMutation(api.care.deleteCareSchedule)

  const scheduleForm = ref<ScheduleFormState>({
    scheduleId: null,
    title: '',
    cadenceValue: 1,
    cadenceUnit: 'days',
    timeOfDay: '08:00',
  })
  const savingSchedule = ref(false)
  const deletingScheduleId = ref<string | null>(null)

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

  function resetScheduleForm() {
    scheduleForm.value = {
      scheduleId: null,
      title: '',
      cadenceValue: 1,
      cadenceUnit: 'days',
      timeOfDay: '08:00',
    }
  }

  function editSchedule(schedule: EditableSchedule) {
    scheduleForm.value = {
      scheduleId: schedule._id,
      title: schedule.title,
      cadenceValue: schedule.cadenceValue,
      cadenceUnit: schedule.cadenceUnit as ScheduleCadenceUnit,
      timeOfDay: formatTimeInput(schedule.timeOfDayMinutes),
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

  return {
    scheduleForm,
    savingSchedule,
    deletingScheduleId,
    schedulePreview,
    resetScheduleForm,
    editSchedule,
    handleToggleSchedule,
    handleSaveSchedule,
    handleDeleteSchedule,
    formatTimeInput,
    parseTimeInput,
    formatClockLabel,
  }
}
