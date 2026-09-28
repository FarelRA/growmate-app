// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useRecordings } from '../../../app/composables/useRecordings'

describe('useRecordings', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function okPayload(recordings: unknown[] = []) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ recordings }),
    }
  }

  it('fetches when device id arrives after the version flag (arrival order independent)', async () => {
    const deviceId = ref<string | undefined>(undefined)
    const isV2 = ref(true)
    fetchMock.mockResolvedValue(okPayload([{ _id: 'r1' }]))

    useRecordings(deviceId, isV2)
    expect(fetchMock).not.toHaveBeenCalled()

    deviceId.value = 'GM-001'
    await nextTick()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('GM-001')
  })

  it('fetches when the version flag flips after the device id (first-paint race)', async () => {
    const deviceId = ref<string | undefined>('GM-002')
    const isV2 = ref(false)
    fetchMock.mockResolvedValue(okPayload([]))

    useRecordings(deviceId, isV2)
    await nextTick()
    expect(fetchMock).not.toHaveBeenCalled()

    isV2.value = true
    await nextTick()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain('GM-002')
  })

  it('does not fetch for non-v2 devices', async () => {
    const deviceId = ref<string | undefined>('GM-003')
    const isV2 = ref(false)

    useRecordings(deviceId, isV2)
    await nextTick()

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('surfaces fetch failures on recordingsError instead of swallowing them', async () => {
    const deviceId = ref<string | undefined>('GM-004')
    const isV2 = ref(true)
    fetchMock.mockRejectedValue(new Error('network down'))

    const { recordings, recordingsError, recordingsLoading } = useRecordings(deviceId, isV2)
    await nextTick()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(recordings.value).toEqual([])
    expect(recordingsError.value).toContain('network down')
    expect(recordingsLoading.value).toBe(false)
  })

  it('surfaces non-OK HTTP responses on recordingsError', async () => {
    const deviceId = ref<string | undefined>('GM-005')
    const isV2 = ref(true)
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

    const { recordingsError } = useRecordings(deviceId, isV2)
    await nextTick()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(recordingsError.value).toContain('500')
  })

  it('retryRecordings re-attempts the load and clears the error on success', async () => {
    const deviceId = ref<string | undefined>('GM-006')
    const isV2 = ref(true)
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    fetchMock.mockResolvedValueOnce(okPayload([{ _id: 'r9' }]))

    const { recordings, recordingsError, recordingsRetryCount, retryRecordings } = useRecordings(
      deviceId,
      isV2,
    )
    await nextTick()
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(recordingsError.value).toBeTruthy()

    await retryRecordings()

    expect(recordingsRetryCount.value).toBe(1)
    expect(recordingsError.value).toBeNull()
    expect(recordings.value).toHaveLength(1)
  })
})
