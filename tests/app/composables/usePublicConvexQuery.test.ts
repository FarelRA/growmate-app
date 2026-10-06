import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runSharedConvexQuery } from '@/utils/auth'
import { usePublicConvexQuery } from '../../../app/composables/usePublicConvexQuery'

vi.mock('@/utils/auth', () => ({
  runSharedConvexQuery: vi.fn(),
}))

const mockQuery = runSharedConvexQuery as unknown as ReturnType<typeof vi.fn>

describe('usePublicConvexQuery SSR timeout', () => {
  let capturedHandler: (() => Promise<unknown>) | undefined

  beforeEach(() => {
    capturedHandler = undefined
    mockQuery.mockReset()
    vi.stubGlobal(
      'useAsyncData',
      vi.fn((_key: string, handler: () => Promise<unknown>) => {
        capturedHandler = handler
        return { data: null }
      }),
    )
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('returns the query result when the backend is fast', async () => {
    mockQuery.mockResolvedValue([{ _id: 'p1' }])
    usePublicConvexQuery('k', 'api.plants.plantLibrary' as never, {})
    const result = await capturedHandler!()
    expect(result).toEqual([{ _id: 'p1' }])
  })

  it('fails soft to null when the backend hangs past the timeout', async () => {
    mockQuery.mockImplementation(() => new Promise(() => {}))
    usePublicConvexQuery('k', 'api.plants.plantLibrary' as never, {})
    const pending = capturedHandler!()
    await vi.advanceTimersByTimeAsync(8000)
    await expect(pending).resolves.toBeNull()
  })

  it('honors a custom timeout', async () => {
    mockQuery.mockImplementation(() => new Promise(() => {}))
    usePublicConvexQuery('k', 'api.plants.plantLibrary' as never, {}, { timeoutMs: 1000 })
    const pending = capturedHandler!()
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toBeNull()
  })
})
