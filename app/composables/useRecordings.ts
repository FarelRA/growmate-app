import { ref, watch } from 'vue'
import type { Ref } from 'vue'
import { getAuthToken } from '@/utils/auth'
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
 *
 * Pass `{ enabled: false }` to keep the (identical) return shape without
 * subscribing: `useDashboard` does this because it never renders recordings
 * itself — `HistoryPanel` owns the only live recordings fetch (paginated
 * `?limit=`), so an eager fetch here would double every recordings request.
 */
export function useRecordings(
  deviceId: Ref<string | undefined>,
  isV2: Ref<boolean>,
  opts?: { enabled?: boolean | Ref<boolean> },
) {
  const recordings = ref<DeviceRecording[]>([])
  const recordingsError = ref<string | null>(null)
  const recordingsLoading = ref(false)
  const recordingsRetryCount = ref(0)
  let latestRequestId = 0

  async function fetchRecordings(id: string) {
    const requestId = ++latestRequestId
    recordingsLoading.value = true
    recordingsError.value = null
    try {
      const token = await getAuthToken()
      if (requestId !== latestRequestId) return
      const resp = await fetch(`/api/v2/recordings/${encodeURIComponent(id)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (requestId !== latestRequestId) return
      if (!resp.ok) {
        throw new Error(`Gagal memuat rekaman (HTTP ${resp.status})`)
      }
      const json = await resp.json()
      if (requestId !== latestRequestId) return
      recordings.value = json.recordings ?? []
    } catch (error: unknown) {
      if (requestId !== latestRequestId) return
      recordingsError.value = getErrorMessage(error, 'Gagal memuat rekaman')
    } finally {
      if (requestId === latestRequestId) {
        recordingsLoading.value = false
      }
    }
  }

  async function retryRecordings() {
    const id = deviceId.value
    if (!id || !isV2.value || recordingsLoading.value) return
    recordingsRetryCount.value += 1
    await fetchRecordings(id)
  }

  function isEnabled() {
    return opts?.enabled === undefined
      ? true
      : typeof opts.enabled === 'boolean'
        ? opts.enabled
        : opts.enabled.value
  }

  watch(
    [deviceId, isV2, () => isEnabled()],
    ([id, v2, enabled]) => {
      if (id && v2 && enabled) {
        void fetchRecordings(id)
      } else {
        latestRequestId += 1
        recordings.value = []
        recordingsError.value = null
        recordingsLoading.value = false
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
