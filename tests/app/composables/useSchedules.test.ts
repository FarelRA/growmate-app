// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

const { mockMutate } = vi.hoisted(() => ({ mockMutate: vi.fn() }))

vi.mock('@convex-vue/core', () => ({
  useConvexMutation: () => ({ mutate: mockMutate }),
  useConvexQuery: () => ({ data: ref(null) }),
}))

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useSchedules } from '../../../app/composables/useSchedules'

describe('useSchedules', () => {
  beforeEach(() => {
    mockMutate.mockReset()
    mockMutate.mockResolvedValue({})
  })

  it('builds an hourly preview', () => {
    const { scheduleForm, schedulePreview } = useSchedules(ref('GM-001'))
    scheduleForm.value = { scheduleId: null, title: 'x', cadenceValue: 3, cadenceUnit: 'hours', timeOfDay: '08:00' }
    expect(schedulePreview.value).toContain('3 jam')
  })

  it('builds a daily preview with clock label', () => {
    const { scheduleForm, schedulePreview } = useSchedules(ref('GM-001'))
    scheduleForm.value = { scheduleId: null, title: 'x', cadenceValue: 1, cadenceUnit: 'days', timeOfDay: '08:00' }
    expect(schedulePreview.value).toContain('08:00')
  })

  it('editSchedule fills the form and resetScheduleForm clears it', () => {
    const { scheduleForm, editSchedule, resetScheduleForm } = useSchedules(ref('GM-001'))
    editSchedule({ _id: 's1', title: 'Pagi', cadenceValue: 2, cadenceUnit: 'days', timeOfDayMinutes: 480 })
    expect(scheduleForm.value.scheduleId).toBe('s1')
    expect(scheduleForm.value.timeOfDay).toBe('08:00')

    resetScheduleForm()
    expect(scheduleForm.value.scheduleId).toBeNull()
    expect(scheduleForm.value.title).toBe('')
  })

  it('handleSaveSchedule refuses without a device', async () => {
    const { toast } = await import('vue-sonner')
    const { handleSaveSchedule } = useSchedules(ref(undefined))
    await handleSaveSchedule()
    expect(mockMutate).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalled()
  })

  it('handleSaveSchedule persists and resets the form', async () => {
    const { scheduleForm, handleSaveSchedule } = useSchedules(ref('GM-007'))
    scheduleForm.value.title = 'Rutin'
    await handleSaveSchedule()
    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate.mock.calls[0]?.[0]).toMatchObject({ deviceId: 'GM-007', title: 'Rutin' })
    expect(scheduleForm.value.title).toBe('')
  })

  it('handleDeleteSchedule resets the form when deleting the edited schedule', async () => {
    const { scheduleForm, editSchedule, handleDeleteSchedule } = useSchedules(ref('GM-001'))
    editSchedule({ _id: 's9', title: 'Pagi', cadenceValue: 1, cadenceUnit: 'days', timeOfDayMinutes: 480 })
    await handleDeleteSchedule('s9')
    expect(scheduleForm.value.scheduleId).toBeNull()
  })
})
