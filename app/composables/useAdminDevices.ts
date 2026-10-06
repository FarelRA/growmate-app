import { ref } from 'vue'
import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '~~/convex/_generated/api'
import { getErrorMessage } from '~~/shared/utils/errors'
import type { AdminDeviceListItem, Id } from '@/utils/convex-types'
import {
  DEFAULT_FERTILIZING_COOLDOWN,
  DEFAULT_FERTILIZING_DURATION,
  DEFAULT_FERTILIZING_THRESHOLD,
  DEFAULT_LIGHTING_HYSTERESIS,
  DEFAULT_LIGHTING_THRESHOLD,
  DEFAULT_PESTICIDE_COOLDOWN,
  DEFAULT_PESTICIDE_DURATION,
  DEFAULT_PESTICIDE_THRESHOLD,
  DEFAULT_TANK_CAPACITY,
  DEFAULT_WATERING_COOLDOWN,
  DEFAULT_WATERING_DURATION,
  DEFAULT_WATERING_THRESHOLD,
} from '~~/convex/types'

// convex/types.ts has no battery fallback constant (read-only check).
const DEFAULT_BATTERY_CAPACITY_AH = 5

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
    wateringThreshold: DEFAULT_WATERING_THRESHOLD,
    wateringDuration: DEFAULT_WATERING_DURATION,
    wateringCooldown: DEFAULT_WATERING_COOLDOWN,
    lightingThreshold: DEFAULT_LIGHTING_THRESHOLD,
    lightingHysteresis: DEFAULT_LIGHTING_HYSTERESIS,
    version: 'v1' as 'v1' | 'v2',
    autoFertilizing: false,
    autoPesticide: false,
    fertilizingThreshold: DEFAULT_FERTILIZING_THRESHOLD,
    fertilizingDuration: DEFAULT_FERTILIZING_DURATION,
    fertilizingCooldown: DEFAULT_FERTILIZING_COOLDOWN,
    pesticideThreshold: DEFAULT_PESTICIDE_THRESHOLD,
    pesticideDuration: DEFAULT_PESTICIDE_DURATION,
    pesticideCooldown: DEFAULT_PESTICIDE_COOLDOWN,
    tankCapacity: DEFAULT_TANK_CAPACITY,
    batteryCapacityAh: DEFAULT_BATTERY_CAPACITY_AH,
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
      wateringThreshold: DEFAULT_WATERING_THRESHOLD,
      wateringDuration: DEFAULT_WATERING_DURATION,
      wateringCooldown: DEFAULT_WATERING_COOLDOWN,
      lightingThreshold: DEFAULT_LIGHTING_THRESHOLD,
      lightingHysteresis: DEFAULT_LIGHTING_HYSTERESIS,
      version: 'v1',
      autoFertilizing: false,
      autoPesticide: false,
      fertilizingThreshold: DEFAULT_FERTILIZING_THRESHOLD,
      fertilizingDuration: DEFAULT_FERTILIZING_DURATION,
      fertilizingCooldown: DEFAULT_FERTILIZING_COOLDOWN,
      pesticideThreshold: DEFAULT_PESTICIDE_THRESHOLD,
      pesticideDuration: DEFAULT_PESTICIDE_DURATION,
      pesticideCooldown: DEFAULT_PESTICIDE_COOLDOWN,
      tankCapacity: DEFAULT_TANK_CAPACITY,
      batteryCapacityAh: DEFAULT_BATTERY_CAPACITY_AH,
      hasModem: false,
      hasSolarPanel: false,
    }
  }

  function editDevice(device: AdminDeviceListItem) {
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
      fertilizingThreshold: device.fertilizingThreshold ?? DEFAULT_FERTILIZING_THRESHOLD,
      fertilizingDuration: device.fertilizingDuration ?? DEFAULT_FERTILIZING_DURATION,
      fertilizingCooldown: device.fertilizingCooldown ?? DEFAULT_FERTILIZING_COOLDOWN,
      pesticideThreshold: device.pesticideThreshold ?? DEFAULT_PESTICIDE_THRESHOLD,
      pesticideDuration: device.pesticideDuration ?? DEFAULT_PESTICIDE_DURATION,
      pesticideCooldown: device.pesticideCooldown ?? DEFAULT_PESTICIDE_COOLDOWN,
      tankCapacity: device.tankCapacity ?? DEFAULT_TANK_CAPACITY,
      batteryCapacityAh: device.batteryCapacityAh ?? DEFAULT_BATTERY_CAPACITY_AH,
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
