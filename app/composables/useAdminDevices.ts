import { ref } from 'vue'
import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Id } from '@/lib/convex-types'

export type AdminTab = 'overview' | 'devices' | 'support' | 'products' | 'plants' | 'blog' | 'accounts'

export function useAdminDevices(activeTab: Ref<AdminTab>) {
  const { mutate: saveDevice } = useConvexMutation(api.admin.adminSaveDevice)
  const { mutate: deleteDevice } = useConvexMutation(api.admin.adminDeleteDevice)

  const savingDevice = ref(false)
  const deletingDeviceId = ref<string | null>(null)

  const deviceForm = ref({
    existingDeviceId: null as string | null,
    deviceId: '',
    name: '',
    firmwareVersion: '',
    autoWatering: false,
    autoLighting: false,
    wateringThreshold: 35,
    wateringDuration: 8,
    wateringCooldown: 21600,
    lightingThreshold: 30,
    lightingHysteresis: 8,
    version: 'v1' as 'v1' | 'v2',
    autoFertilizing: false,
    autoPesticide: false,
    fertilizingThreshold: 35,
    fertilizingDuration: 10,
    fertilizingCooldown: 432000,
    pesticideThreshold: 0,
    pesticideDuration: 10,
    pesticideCooldown: 604800,
    tankCapacity: 10,
    batteryCapacityAh: 5,
    hasModem: false,
    hasSolarPanel: false,
  })

  function resetDeviceForm() {
    deviceForm.value = {
      existingDeviceId: null,
      deviceId: '',
      name: '',
      firmwareVersion: '',
      autoWatering: false,
      autoLighting: false,
      wateringThreshold: 35,
      wateringDuration: 8,
      wateringCooldown: 21600,
      lightingThreshold: 30,
      lightingHysteresis: 8,
      version: 'v1',
      autoFertilizing: false,
      autoPesticide: false,
      fertilizingThreshold: 35,
      fertilizingDuration: 10,
      fertilizingCooldown: 432000,
      pesticideThreshold: 0,
      pesticideDuration: 10,
      pesticideCooldown: 604800,
      tankCapacity: 10,
      batteryCapacityAh: 5,
      hasModem: false,
      hasSolarPanel: false,
    }
  }

  function editDevice(device: {
    _id: string
    deviceId: string
    name: string
    firmwareVersion: string
    autoWatering: boolean
    autoLighting: boolean
    wateringThreshold: number
    wateringDuration: number
    wateringCooldown: number
    lightingThreshold: number
    lightingHysteresis: number
    version?: 'v1' | 'v2'
    autoFertilizing?: boolean
    autoPesticide?: boolean
    fertilizingThreshold?: number
    fertilizingDuration?: number
    fertilizingCooldown?: number
    pesticideThreshold?: number
    pesticideDuration?: number
    pesticideCooldown?: number
    tankCapacity?: number
    batteryCapacityAh?: number
    hasModem?: boolean
    hasSolarPanel?: boolean
  }) {
    deviceForm.value = {
      existingDeviceId: device._id,
      deviceId: device.deviceId,
      name: device.name,
      firmwareVersion: device.firmwareVersion,
      autoWatering: device.autoWatering,
      autoLighting: device.autoLighting,
      wateringThreshold: device.wateringThreshold,
      wateringDuration: device.wateringDuration,
      wateringCooldown: device.wateringCooldown,
      lightingThreshold: device.lightingThreshold,
      lightingHysteresis: device.lightingHysteresis,
      version: device.version ?? 'v1',
      autoFertilizing: device.autoFertilizing ?? false,
      autoPesticide: device.autoPesticide ?? false,
      fertilizingThreshold: device.fertilizingThreshold ?? 35,
      fertilizingDuration: device.fertilizingDuration ?? 10,
      fertilizingCooldown: device.fertilizingCooldown ?? 432000,
      pesticideThreshold: device.pesticideThreshold ?? 0,
      pesticideDuration: device.pesticideDuration ?? 10,
      pesticideCooldown: device.pesticideCooldown ?? 604800,
      tankCapacity: device.tankCapacity ?? 10,
      batteryCapacityAh: device.batteryCapacityAh ?? 5,
      hasModem: device.hasModem ?? false,
      hasSolarPanel: device.hasSolarPanel ?? false,
    }
    activeTab.value = 'devices'
  }

  async function handleSaveDevice() {
    savingDevice.value = true
    try {
      await saveDevice({
        deviceId: deviceForm.value.deviceId,
        name: deviceForm.value.name,
        firmwareVersion: deviceForm.value.firmwareVersion || undefined,
        autoWatering: deviceForm.value.autoWatering,
        autoLighting: deviceForm.value.autoLighting,
        wateringThreshold: Number(deviceForm.value.wateringThreshold),
        wateringDuration: Number(deviceForm.value.wateringDuration),
        wateringCooldown: Number(deviceForm.value.wateringCooldown),
        lightingThreshold: Number(deviceForm.value.lightingThreshold),
        lightingHysteresis: Number(deviceForm.value.lightingHysteresis),
        version: deviceForm.value.version,
        autoFertilizing: deviceForm.value.autoFertilizing,
        autoPesticide: deviceForm.value.autoPesticide,
        fertilizingThreshold: Number(deviceForm.value.fertilizingThreshold),
        fertilizingDuration: Number(deviceForm.value.fertilizingDuration),
        fertilizingCooldown: Number(deviceForm.value.fertilizingCooldown),
        pesticideThreshold: Number(deviceForm.value.pesticideThreshold),
        pesticideDuration: Number(deviceForm.value.pesticideDuration),
        pesticideCooldown: Number(deviceForm.value.pesticideCooldown),
        tankCapacity: Number(deviceForm.value.tankCapacity),
        batteryCapacityAh: Number(deviceForm.value.batteryCapacityAh),
        hasModem: deviceForm.value.hasModem,
        hasSolarPanel: deviceForm.value.hasSolarPanel,
        ...(deviceForm.value.existingDeviceId ? { existingDeviceId: deviceForm.value.existingDeviceId as Id<'devices'> } : {}),
      })
      toast.success(deviceForm.value.existingDeviceId ? 'Perangkat diperbarui' : 'Perangkat ditambahkan')
      resetDeviceForm()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan perangkat'))
    } finally {
      savingDevice.value = false
    }
  }

  async function handleDeleteDevice(deviceId: string) {
    deletingDeviceId.value = deviceId
    try {
      await deleteDevice({ deviceId: deviceId as Id<'devices'> })
      toast.success('Perangkat dihapus')
      if (deviceForm.value.existingDeviceId === deviceId) resetDeviceForm()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menghapus perangkat'))
    } finally {
      deletingDeviceId.value = null
    }
  }

  return {
    deviceForm,
    savingDevice,
    deletingDeviceId,
    resetDeviceForm,
    editDevice,
    handleSaveDevice,
    handleDeleteDevice,
  }
}
