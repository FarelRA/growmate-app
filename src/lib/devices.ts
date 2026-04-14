import { ref } from 'vue'

const storageKey = `__growmateActiveDevice_${encodeURIComponent(import.meta.env.VITE_CONVEX_URL)}`

function readStoredDeviceId() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(storageKey)
}

export const activeDeviceId = ref<string | null>(readStoredDeviceId())

export function setActiveDeviceId(deviceId: string | null) {
  activeDeviceId.value = deviceId

  if (typeof window === 'undefined') return

  if (deviceId) {
    window.localStorage.setItem(storageKey, deviceId)
  } else {
    window.localStorage.removeItem(storageKey)
  }
}

export function syncActiveDevice(devices: Array<{ deviceId: string }>) {
  if (devices.length === 0) {
    setActiveDeviceId(null)
    return null
  }

  const existing = activeDeviceId.value
  if (existing && devices.some((device) => device.deviceId === existing)) {
    return existing
  }

  const fallback = devices[0]?.deviceId ?? null
  setActiveDeviceId(fallback)
  return fallback
}
