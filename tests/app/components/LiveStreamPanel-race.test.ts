// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    auth: { signIn: 'auth:signIn', signOut: 'auth:signOut' },
    users: { checkSetupStatus: 'users:checkSetupStatus' },
  },
}))

const { mockAction, mockQuery } = vi.hoisted(() => ({
  mockAction: vi.fn(),
  mockQuery: vi.fn(),
}))

vi.mock('convex/browser', () => {
  function ConvexHttpClientMock(this: unknown) {
    // biome-ignore lint: test mock assigns methods dynamically
    const self = this as Record<string, unknown>
    self.setAuth = vi.fn()
    self.clearAuth = vi.fn()
    self.query = mockQuery
    self.action = mockAction
    return this
  }
  return { ConvexHttpClient: ConvexHttpClientMock }
})

import LiveStreamPanel from '../../../app/components/LiveStreamPanel.vue'
import { useRecordings } from '../../../app/composables/useRecordings'
import {
  initAuthState,
  cleanupAuthState,
  authState,
  getAuthToken,
  __resetSharedConvexClientForTests,
} from '../../../app/utils/auth'

// ---------- LiveStreamPanel mocks (mirrors LiveStreamPanel.test.ts) ----------
function createMockWs(url?: string) {
  return {
    _url: url,
    binaryType: '',
    readyState: 0,
    onopen: null as ((e: Event) => void) | null,
    onclose: null as ((e: CloseEvent) => void) | null,
    onerror: null as ((e: Event) => void) | null,
    onmessage: null as ((e: MessageEvent) => void) | null,
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
}

function createMockDecoderState() {
  let state = 'unconfigured'
  return {
    get state() {
      return state
    },
    set state(v: string) {
      state = v
    },
    configure: vi.fn(() => {
      state = 'configured'
    }),
    decode: vi.fn(),
    close: vi.fn(),
    flush: vi.fn(),
  }
}

function createWsMessage(nalUnit: Uint8Array, isKeyframe = false): MessageEvent {
  const flags = isKeyframe ? 0x01 : 0x00
  const tsBuf = new Uint8Array(6)
  const header = new Uint8Array([flags, ...tsBuf])
  const data = new Uint8Array(header.length + nalUnit.length)
  data.set(header)
  data.set(nalUnit, header.length)
  return new MessageEvent('message', { data: data.buffer as ArrayBuffer })
}

describe('race fixes', () => {
  describe('LiveStreamPanel re-render guard', () => {
    let wsInstances: ReturnType<typeof createMockWs>[] = []
    let wsCtor: ReturnType<typeof vi.fn>
    let mockDecoder: ReturnType<typeof createMockDecoderState>
    let decoderCtor: ReturnType<typeof vi.fn>
    let mountedWrappers: Array<{ unmount: () => void }> = []

    beforeEach(() => {
      wsInstances = []
      mountedWrappers = []
      mockDecoder = createMockDecoderState()
      cleanupAuthState()
      localStorage.clear()
      wsCtor = vi.fn(function (this: unknown, url: string | URL) {
        const ws = createMockWs(String(url))
        wsInstances.push(ws)
        return ws
      } as unknown as (...args: unknown[]) => unknown) as unknown as ReturnType<typeof vi.fn>
      vi.stubGlobal('WebSocket', wsCtor as unknown as typeof WebSocket)

      decoderCtor = vi.fn()
      class VideoDecoderMock {
        configure!: ReturnType<typeof vi.fn>
        decode!: ReturnType<typeof vi.fn>
        close!: ReturnType<typeof vi.fn>
        flush!: ReturnType<typeof vi.fn>
        get state() {
          return mockDecoder.state
        }
        set state(v: string) {
          mockDecoder.state = v
        }
        constructor(init: VideoDecoderInit) {
          decoderCtor(init)
          this.configure = mockDecoder.configure
          this.decode = mockDecoder.decode
          this.close = mockDecoder.close
          this.flush = mockDecoder.flush
        }
      }
      vi.stubGlobal('VideoDecoder', VideoDecoderMock as unknown as typeof VideoDecoder)
      vi.stubGlobal(
        'EncodedVideoChunk',
        class {
          type: string
          timestamp: number
          duration: number
          data: Uint8Array
          constructor(init: EncodedVideoChunkInit) {
            this.type = init.type
            this.timestamp = init.timestamp
            this.duration = init.duration ?? 0
            this.data = init.data as Uint8Array
          }
        },
      )
      HTMLCanvasElement.prototype.getContext = vi.fn(() => {
        const canvas = document.createElement('canvas')
        return { canvas, drawImage: vi.fn() } as unknown as CanvasRenderingContext2D
      })
      vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:3000' })
    })

    afterEach(() => {
      for (const w of mountedWrappers) {
        try {
          w.unmount()
        } catch { /* ignore */ }
      }
      mountedWrappers = []
      vi.unstubAllGlobals()
    })

    it('re-render after stream starts does not open a second socket', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-race' } })
      mountedWrappers.push(wrapper)
      expect(wsCtor).toHaveBeenCalledTimes(1)

      // Simulate stream start: onopen flips streamActive -> template re-renders
      // (-> :ref re-fires). Without the guard this leaks a second WebSocket.
      wsInstances[0]!.onopen!(new Event('open'))
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()
      await wrapper.vm.$forceUpdate()
      await wrapper.vm.$nextTick()

      expect(wsCtor).toHaveBeenCalledTimes(1)
      expect(wsInstances[0]!.close).not.toHaveBeenCalled()
    })

    it('caches PPS and includes it in the avcC description (SPS+PPS order)', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-pps' } })
      mountedWrappers.push(wrapper)
      const ws = wsInstances[0]!
      const sps = new Uint8Array([0x67, 0x64, 0x00, 0x1f, 0xe8, 0x14, 0x0a])
      const pps = new Uint8Array([0x68, 0xeb, 0xec, 0xb0])
      // PPS arrives before SPS (separate-PPS stream ordering).
      ws.onmessage!(createWsMessage(pps) as unknown as MessageEvent)
      expect(mockDecoder.configure).not.toHaveBeenCalled()
      ws.onmessage!(createWsMessage(sps) as unknown as MessageEvent)
      expect(mockDecoder.configure).toHaveBeenCalledTimes(1)
      const desc = mockDecoder.configure.mock.calls[0][0].description as Uint8Array
      // avcC must embed the PPS bytes; SPS-only descriptions decode to black screen.
      expect(Array.from(desc.slice(-pps.length))).toEqual(Array.from(pps))
    })

    it('reconfigures with PPS when PPS arrives after SPS', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-pps2' } })
      mountedWrappers.push(wrapper)
      const ws = wsInstances[0]!
      const sps = new Uint8Array([0x67, 0x64, 0x00, 0x1f, 0xe8, 0x14, 0x0a])
      const pps = new Uint8Array([0x68, 0xeb, 0xec, 0xb0])
      ws.onmessage!(createWsMessage(sps) as unknown as MessageEvent)
      expect(mockDecoder.configure).toHaveBeenCalledTimes(1)
      ws.onmessage!(createWsMessage(pps) as unknown as MessageEvent)
      expect(mockDecoder.configure).toHaveBeenCalledTimes(2)
      const desc = mockDecoder.configure.mock.calls[1][0].description as Uint8Array
      expect(Array.from(desc.slice(-pps.length))).toEqual(Array.from(pps))
    })
  })

  describe('useRecordings stale-response guard', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
      fetchMock.mockReset()
      vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    function deferred<T>() {
      let resolve!: (v: T) => void
      let reject!: (e: unknown) => void
      const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
      })
      return { promise, resolve, reject }
    }

    it('ignores a stale device response that resolves after a fast device switch', async () => {
      const deviceId = ref<string | undefined>('DEV-A')
      const isV2 = ref(true)
      const first = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>()
      const second = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>()

      fetchMock.mockImplementation((url: unknown) => {
        if (String(url).includes('DEV-A')) return first.promise
        return second.promise
      })

      const { recordings } = useRecordings(deviceId, isV2)
      await nextTick()
      await nextTick()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      // Fast switch before the first response lands.
      deviceId.value = 'DEV-B'
      await nextTick()
      await nextTick()
      expect(fetchMock).toHaveBeenCalledTimes(2)

      // Latest resolves first, stale resolves last — stale must be ignored.
      second.resolve({
        ok: true,
        status: 200,
        json: async () => ({ recordings: [{ _id: 'B' }] }),
      })
      await new Promise((r) => setTimeout(r, 0))
      await nextTick()
      expect(recordings.value).toEqual([{ _id: 'B' }])

      first.resolve({
        ok: true,
        status: 200,
        json: async () => ({ recordings: [{ _id: 'A' }] }),
      })
      await new Promise((r) => setTimeout(r, 0))
      await nextTick()
      expect(recordings.value).toEqual([{ _id: 'B' }])
    })
  })

  describe('auth refresh single-flight', () => {
    beforeEach(() => {
      vi.stubGlobal('useRuntimeConfig', () => ({
        public: { convexUrl: 'https://test.convex.cloud' },
      }))
      cleanupAuthState()
      __resetSharedConvexClientForTests()
      localStorage.clear()
      mockAction.mockReset()
      mockQuery.mockReset()
    })

    afterEach(() => {
      cleanupAuthState()
      localStorage.clear()
      vi.unstubAllGlobals()
    })

    it('concurrent force-refresh callers share one signIn call', async () => {
      localStorage.setItem('__convexAuthJWT_https%3A%2F%2Ftest.convex.cloud', 'old-jwt')
      localStorage.setItem('__convexAuthRefreshToken_https%3A%2F%2Ftest.convex.cloud', 'refresh-token')
      cleanupAuthState()
      initAuthState()
      // Delayed refresh so all callers overlap in-flight.
      mockAction.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve({ tokens: { token: 'new-jwt', refreshToken: 'new-refresh' } }), 20)
          }),
      )

      const [t1, t2, t3] = await Promise.all([
        getAuthToken({ forceRefreshToken: true }),
        getAuthToken({ forceRefreshToken: true }),
        getAuthToken({ forceRefreshToken: true }),
      ])

      expect(mockAction).toHaveBeenCalledTimes(1)
      expect(mockAction).toHaveBeenCalledWith('auth:signIn', { refreshToken: 'refresh-token' })
      expect(t1).toBe('new-jwt')
      expect(t2).toBe('new-jwt')
      expect(t3).toBe('new-jwt')
      expect(authState.token.value).toBe('new-jwt')
    })
  })
})
