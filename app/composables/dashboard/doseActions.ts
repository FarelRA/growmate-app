import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '~~/convex/_generated/api'
import { getErrorMessage } from '~~/shared/utils/errors'

export type DoseKind = 'water' | 'light' | 'fertilize' | 'pesticide'

export type AutomationType = 'watering' | 'lighting' | 'fertilizing' | 'pesticide'

export const automationConfig: Record<
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

/**
 * Manual care dose actions and automation toggles. Both handlers are
 * table-driven: `doseConfig` routes each dose kind to its mutation and
 * toast copy, `automationConfig` routes each automation type to its
 * device field and toast copy.
 */
export function useDoseActions(
  currentDeviceId: Ref<string | undefined>,
  deviceRef: Ref<{ deviceId: string } | null | undefined>,
) {
  const { mutate: triggerWater } = useConvexMutation(api.care.triggerWatering)
  const { mutate: triggerLighting } = useConvexMutation(api.care.triggerLighting)
  const { mutate: triggerFertilizing } = useConvexMutation(api.care.triggerFertilizing)
  const { mutate: triggerPesticide } = useConvexMutation(api.care.triggerPesticide)
  const { mutate: updateAutomation } = useConvexMutation(api.devices.updateDeviceAutomation)

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

  async function handleToggleAutomation(type: AutomationType, enabled: boolean) {
    if (!deviceRef.value) {
      toast.error('Pilih perangkat terlebih dahulu')
      return
    }
    try {
      const config = automationConfig[type]
      await updateAutomation({
        deviceId: deviceRef.value.deviceId,
        [config.field]: !enabled,
      } as Parameters<typeof updateAutomation>[0])
      toast.success(enabled ? config.offToast : config.onToast)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal memperbarui otomasi'))
    }
  }

  return {
    handleDose,
    handleWater,
    handleLight,
    handleFertilize,
    handlePesticide,
    handleToggleAutomation,
  }
}
