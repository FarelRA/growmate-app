import { ref } from 'vue'

const activeDeviceId = ref<string | null>(null)
let activeDeviceInitialized = false
let storageListener: ((event: StorageEvent) => void) | null = null

function storageKey() {
  const convexUrl = useRuntimeConfig().public.convexUrl
  if (!convexUrl) {
    throw new Error('NUXT_PUBLIC_CONVEX_URL is not configured')
  }
  return `__growmateActiveDevice_${encodeURIComponent(convexUrl)}`
}

function readStoredDeviceId() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(storageKey())
}

export function initActiveDeviceState() {
  if (import.meta.server || activeDeviceInitialized) {
    return
  }

  activeDeviceId.value = readStoredDeviceId()

  storageListener = (event: StorageEvent) => {
    if (event.key === storageKey()) {
      activeDeviceId.value = event.newValue
    }
  }
  window.addEventListener('storage', storageListener)

  activeDeviceInitialized = true
}

export function cleanupActiveDeviceState() {
  if (storageListener) {
    window.removeEventListener('storage', storageListener)
    storageListener = null
  }
  activeDeviceInitialized = false
}

export { activeDeviceId }

export function setActiveDeviceId(deviceId: string | null) {
  activeDeviceId.value = deviceId

  if (typeof window === 'undefined') return

  if (deviceId) {
    window.localStorage.setItem(storageKey(), deviceId)
  } else {
    window.localStorage.removeItem(storageKey())
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
