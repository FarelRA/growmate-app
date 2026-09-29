import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import { getErrorMessage } from '~~/shared/utils/errors'

export interface DeviceRecording {
  _id: string
  fileName: string
  path: string
  size: number
  durationMs?: number
  capturedAt: number
  capturedAtLabel: string
}

/**
 * Loads V2 camera recordings for the active device.
 *
 * The fetch runs when BOTH the device id and the V2 version flag are
 * resolved, regardless of which arrives first (fixes the first-paint race
 * where recordings never loaded because the version resolved after the
 * device id). Failures are surfaced on `recordingsError` instead of being
 * swallowed into an empty list, and `retryRecordings` re-attempts the load.
 */
export function useRecordings(deviceId: Ref<string | undefined>, isV2: Ref<boolean>) {
  const recordings = ref<DeviceRecording[]>([])
  const recordingsError = ref<string | null>(null)
  const recordingsLoading = ref(false)
  const recordingsRetryCount = ref(0)

  async function fetchRecordings(id: string) {
    recordingsLoading.value = true
    recordingsError.value = null
    try {
      const resp = await fetch(`/api/v2/recordings/${encodeURIComponent(id)}`)
      if (!resp.ok) {
        throw new Error(`Gagal memuat rekaman (HTTP ${resp.status})`)
      }
      const json = await resp.json()
      recordings.value = json.recordings ?? []
    } catch (error: unknown) {
      recordingsError.value = getErrorMessage(error, 'Gagal memuat rekaman')
    } finally {
      recordingsLoading.value = false
    }
  }

  async function retryRecordings() {
    const id = deviceId.value
    if (!id || !isV2.value || recordingsLoading.value) return
    recordingsRetryCount.value += 1
    await fetchRecordings(id)
  }

  watch(
    [deviceId, isV2],
    ([id, v2]) => {
      if (id && v2) {
        void fetchRecordings(id)
      } else {
        recordings.value = []
        recordingsError.value = null
      }
    },
    { immediate: true },
  )

  return {
    recordings,
    recordingsError,
    recordingsLoading,
    recordingsRetryCount,
    fetchRecordings,
    retryRecordings,
  }
}
