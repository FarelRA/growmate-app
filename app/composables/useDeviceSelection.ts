import { computed, watch } from 'vue'
import { useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '~~/convex/_generated/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/composables/useActiveDevice'

/**
 * Single-writer owner of the active-device selection.
 *
 * All `setActiveDeviceId` writes for the dashboard flow go through this
 * composable: initial sync from the device list, explicit user selection,
 * and clearing the selection when the active device is removed. Callers
 * must not write `activeDeviceId` directly.
 */
export function useDeviceSelection() {
  const { data: devices } = useConvexQuery(api.devices.userDevices, {})

  watch(
    devices,
    (deviceList) => {
      if (!deviceList) return
      syncActiveDevice(deviceList)
    },
    { immediate: true },
  )

  const currentDeviceId = computed(
    () => activeDeviceId.value || devices.value?.[0]?.deviceId || undefined,
  )

  function handleSelectDevice(deviceId: string) {
    setActiveDeviceId(deviceId)
    toast.success('Perangkat aktif diperbarui')
  }

  function handleDeviceUnregistered(deviceId: string) {
    if (activeDeviceId.value === deviceId) {
      setActiveDeviceId(null)
    }
  }

  return {
    devices,
    currentDeviceId,
    handleSelectDevice,
    handleDeviceUnregistered,
  }
}
