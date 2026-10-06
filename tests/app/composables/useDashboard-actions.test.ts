// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

const { toastSuccess, toastError, mutationCalls, queryCalls } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  mutationCalls: [] as Array<{ fn: unknown; mutate: ReturnType<typeof vi.fn> }>,
  queryCalls: [] as Array<{ fn: unknown; data: Ref<unknown> }>,
}))

vi.mock('@convex-vue/core', () => ({
  useConvexMutation: (fn: unknown) => {
    const mutate = vi.fn()
    mutationCalls.push({ fn, mutate })
    return { mutate }
  },
  useConvexQuery: (fn: unknown) => {
    const data = ref(null)
    queryCalls.push({ fn, data })
    return { data }
  },
}))

vi.mock('vue-sonner', () => ({
  toast: { success: toastSuccess, error: toastError },
}))

vi.mock('@/utils/images', () => ({
  getImageUrl: (path?: string | null) => path ?? null,
}))

vi.stubGlobal('useRoute', () => ({ query: {} }))
vi.stubGlobal('useRouter', () => ({ replace: vi.fn() }))

import { api } from '~~/convex/_generated/api'
import { getFunctionName } from 'convex/server'
import { useDashboard } from '../../../app/composables/useDashboard'
import { activeDeviceId } from '../../../app/composables/useActiveDevice'

function fnName(fn: unknown) {
  // The generated `api` object is a Proxy: every property access returns a
  // fresh object, so identity comparison never matches. The module:function
  // path string is the stable identity.
  return getFunctionName(fn as never)
}

function mutateFor(fn: unknown) {
  const entry = mutationCalls.find((call) => fnName(call.fn) === fnName(fn))
  if (!entry) throw new Error('mutation was not registered')
  return entry.mutate
}

function dashboardData() {
  const entry = queryCalls.find((call) => fnName(call.fn) === fnName(api.devices.dashboard))
  if (!entry) throw new Error('dashboard query was not registered')
  return entry.data as Ref<{ device: { deviceId: string } } | null>
}

beforeEach(() => {
  mutationCalls.length = 0
  queryCalls.length = 0
  toastSuccess.mockClear()
  toastError.mockClear()
  activeDeviceId.value = null
})

describe('useDashboard dose actions', () => {
  it.each([
    { name: 'handleWater', mutation: api.care.triggerWatering, successToast: 'Siklus penyiraman dimulai' },
    { name: 'handleFertilize', mutation: api.care.triggerFertilizing, successToast: 'Siklus pemupukan dimulai' },
    { name: 'handlePesticide', mutation: api.care.triggerPesticide, successToast: 'Siklus pestisida dimulai' },
  ] as const)('$name guards without a device and triggers the right mutation', async ({ name, mutation, successToast }) => {
    const dashboard = useDashboard()

    await dashboard[name]()
    expect(mutateFor(mutation)).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Pilih perangkat terlebih dahulu')

    activeDeviceId.value = 'GM-001'
    mutateFor(mutation).mockResolvedValue({})
    await dashboard[name]()
    expect(mutateFor(mutation)).toHaveBeenCalledTimes(1)
    expect(mutateFor(mutation).mock.calls[0]?.[0]).toEqual({ deviceId: 'GM-001' })
    expect(toastSuccess).toHaveBeenCalledWith(successToast)
  })

  it('handleLight guards without a device and forwards the enabled flag', async () => {
    const dashboard = useDashboard()

    await dashboard.handleLight(true)
    expect(mutateFor(api.care.triggerLighting)).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Pilih perangkat terlebih dahulu')

    activeDeviceId.value = 'GM-001'
    mutateFor(api.care.triggerLighting).mockResolvedValue({})

    await dashboard.handleLight(true)
    expect(mutateFor(api.care.triggerLighting)).toHaveBeenLastCalledWith({
      deviceId: 'GM-001',
      enabled: true,
    })
    expect(toastSuccess).toHaveBeenLastCalledWith('Lampu tumbuh dinyalakan')

    await dashboard.handleLight(false)
    expect(mutateFor(api.care.triggerLighting)).toHaveBeenLastCalledWith({
      deviceId: 'GM-001',
      enabled: false,
    })
    expect(toastSuccess).toHaveBeenLastCalledWith('Lampu tumbuh dimatikan')
  })

  it('dose handlers surface mutation failures with the same fallback message', async () => {
    activeDeviceId.value = 'GM-001'
    const dashboard = useDashboard()
    mutateFor(api.care.triggerWatering).mockRejectedValue(new Error('offline'))
    await dashboard.handleWater()
    expect(toastError).toHaveBeenCalledTimes(1)
  })
})

describe('useDashboard automation toggle table', () => {
  it('guards without dashboard device data', async () => {
    const { handleToggleAutomation } = useDashboard()
    await handleToggleAutomation('watering', false)
    expect(mutateFor(api.devices.updateDeviceAutomation)).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith('Pilih perangkat terlebih dahulu')
  })

  it.each([
    {
      type: 'watering',
      field: 'autoWatering',
      onToast: 'Penyiraman otomatis dinyalakan',
      offToast: 'Penyiraman otomatis dimatikan',
    },
    {
      type: 'lighting',
      field: 'autoLighting',
      onToast: 'Pencahayaan otomatis dinyalakan',
      offToast: 'Pencahayaan otomatis dimatikan',
    },
    {
      type: 'fertilizing',
      field: 'autoFertilizing',
      onToast: 'Pemupukan otomatis dinyalakan',
      offToast: 'Pemupukan otomatis dimatikan',
    },
    {
      type: 'pesticide',
      field: 'autoPesticide',
      onToast: 'Pestisida otomatis dinyalakan',
      offToast: 'Pestisida otomatis dimatikan',
    },
  ] as const)('routes $type to $field with matching toasts', async ({ type, field, onToast, offToast }) => {
    const { handleToggleAutomation } = useDashboard()
    dashboardData().value = { device: { deviceId: 'GM-007' } }
    mutateFor(api.devices.updateDeviceAutomation).mockResolvedValue({})

    await handleToggleAutomation(type, false)
    expect(mutateFor(api.devices.updateDeviceAutomation)).toHaveBeenLastCalledWith({
      deviceId: 'GM-007',
      [field]: true,
    })
    expect(toastSuccess).toHaveBeenLastCalledWith(onToast)

    await handleToggleAutomation(type, true)
    expect(mutateFor(api.devices.updateDeviceAutomation)).toHaveBeenLastCalledWith({
      deviceId: 'GM-007',
      [field]: false,
    })
    expect(toastSuccess).toHaveBeenLastCalledWith(offToast)
  })
})
