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

describe('race fixes', () => {
  describe('LiveStreamPanel img re-render guard', () => {
    let mountedWrappers: Array<{ unmount: () => void }> = []
    let prevToken: string | null = null

    beforeEach(() => {
      mountedWrappers = []
      prevToken = authState.token.value
      authState.token.value = 'jwt-1'
    })

    afterEach(() => {
      for (const w of mountedWrappers) {
        try {
          w.unmount()
        } catch { /* ignore */ }
      }
      mountedWrappers = []
      authState.token.value = prevToken
    })

    it('streaming=false shows start button with no img; click emits requestStart', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-idle', streaming: false } })
      mountedWrappers.push(wrapper)
      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.text()).toContain('Mulai siaran langsung')
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('requestStart')).toHaveLength(1)
      expect(wrapper.text()).toContain('Menunggu perangkat...')
    })

    it('streaming=true shows stop button; click emits requestStop', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-live', streaming: true } })
      mountedWrappers.push(wrapper)
      const stopBtn = wrapper.findAll('button').filter((b) => b.text().includes('Hentikan siaran'))
      expect(stopBtn).toHaveLength(1)
      await stopBtn[0]!.trigger('click')
      expect(wrapper.emitted('requestStop')).toHaveLength(1)
    })

    it('changing deviceId prop updates the img src', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-race', streaming: true } })
      mountedWrappers.push(wrapper)
      expect(wrapper.find('img').attributes('src')).toContain('/api/v1/video/live/dev-race')
      await wrapper.setProps({ deviceId: 'dev-race-2' })
      expect(wrapper.find('img').attributes('src')).toContain('/api/v1/video/live/dev-race-2')
    })

    it('streaming false→true resets waiting state and shows the viewer', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-reset', streaming: false } })
      mountedWrappers.push(wrapper)
      await wrapper.find('button').trigger('click')
      expect(wrapper.text()).toContain('Menunggu perangkat...')
      await wrapper.setProps({ streaming: true })
      await wrapper.vm.$nextTick()
      expect(wrapper.text()).not.toContain('Menunggu perangkat...')
      expect(wrapper.find('img').exists()).toBe(true)
      expect(wrapper.text()).toContain('Menghubungkan ke kamera')
    })

    it('load/error handlers do not crash on rapid remount', async () => {
      for (let i = 0; i < 3; i++) {
        const wrapper = mount(LiveStreamPanel, { props: { deviceId: `dev-${i}`, streaming: true } })
        mountedWrappers.push(wrapper)
        await wrapper.find('img').trigger('load')
        await wrapper.vm.$nextTick()
        expect(wrapper.text()).toContain('LIVE')
        await wrapper.find('img').trigger('error')
        await wrapper.vm.$nextTick()
        expect(wrapper.text()).toContain('Koneksi kamera gagal')
        wrapper.unmount()
      }
    })

    it('unmounts mid-connect without crashing', async () => {
      const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-flaky', streaming: true } })
      mountedWrappers.push(wrapper)
      await wrapper.setProps({ deviceId: 'dev-flaky-2' })
      expect(() => wrapper.unmount()).not.toThrow()
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
