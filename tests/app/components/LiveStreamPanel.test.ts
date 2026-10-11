// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import type { VueWrapper } from '@vue/test-utils'
import { ref } from 'vue'

vi.mock('@/utils/auth', () => ({
  authState: { token: ref('jwt-1') },
  getAuthToken: vi.fn(),
}))

import { authState, getAuthToken } from '@/utils/auth'
import LiveStreamPanel from '../../../app/components/LiveStreamPanel.vue'

const mockGetAuthToken = getAuthToken as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  authState.token.value = 'jwt-1'
  mockGetAuthToken.mockReset()
  mockGetAuthToken.mockResolvedValue('jwt-1')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function imgSrc(wrapper: VueWrapper) {
  return wrapper.find('img').attributes('src') ?? ''
}

describe('LiveStreamPanel', () => {
  it('renders panel heading', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'test' } })
    expect(wrapper.text()).toContain('Siaran langsung')
    wrapper.unmount()
  })

  it('renders an img with the MJPEG live src including device id and token', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'cam-1' } })
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    const url = new URL(imgSrc(wrapper), 'http://localhost')
    expect(url.pathname).toBe('/api/v1/video/live/cam-1')
    expect(url.searchParams.get('token')).toBe('jwt-1')
    expect(url.searchParams.get('t')).toBeNull()
    wrapper.unmount()
  })

  it('shows connecting text initially', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    expect(wrapper.text()).toContain('Menghubungkan ke kamera')
    wrapper.unmount()
  })

  it('does not use WebSocket, VideoDecoder, or canvas', () => {
    const wsSpy = vi.fn()
    vi.stubGlobal('WebSocket', wsSpy)
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    expect(wsSpy).not.toHaveBeenCalled()
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(true)
    wrapper.unmount()
  })

  it('shows LIVE badge and timer after the first frame loads', async () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    await wrapper.find('img').trigger('load')
    expect(wrapper.text()).toContain('LIVE')
    expect(wrapper.text()).toMatch(/\d{2}:\d{2}/)
    wrapper.unmount()
  })

  it('advances the elapsed timer while streaming', async () => {
    vi.useFakeTimers()
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    await wrapper.find('img').trigger('load')
    expect(wrapper.text()).toContain('00:00')
    await vi.advanceTimersByTimeAsync(65000)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('01:05')
    wrapper.unmount()
  })

  it('shows error state with retry button when the stream fails', async () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    await wrapper.find('img').trigger('error')
    expect(wrapper.text()).toContain('Koneksi kamera gagal')
    expect(wrapper.text()).toContain('Coba Lagi')
    wrapper.unmount()
  })

  it('retry refreshes the token and busts the img cache', async () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    await wrapper.find('img').trigger('error')
    const before = imgSrc(wrapper)
    expect(new URL(before, 'http://localhost').searchParams.get('t')).toBeNull()

    const retryBtn = wrapper.findAll('button').filter((b) => b.text() === 'Coba Lagi')
    expect(retryBtn).toHaveLength(1)
    await retryBtn[0]!.trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(mockGetAuthToken).toHaveBeenCalledWith({ forceRefreshToken: true })
    const after = imgSrc(wrapper)
    expect(after).not.toBe(before)
    expect(new URL(after, 'http://localhost').searchParams.get('t')).toBe('1')
    wrapper.unmount()
  })

  it('requests fullscreen on the stream image', async () => {
    const requestFullscreen = vi.fn()
    const proto = Element.prototype as unknown as Record<string, unknown>
    const original = proto.requestFullscreen
    proto.requestFullscreen = requestFullscreen
    try {
      const wrapper = mount(LiveStreamPanel, {
        props: { deviceId: 'dev-1' },
        attachTo: document.body,
      })
      try {
        await wrapper.find('img').trigger('load')
        const btn = wrapper.findAll('button').filter((b) => b.text().includes('fullscreen'))
        expect(btn).toHaveLength(1)
        await btn[0]!.trigger('click')
        expect(requestFullscreen).toHaveBeenCalled()
      } finally {
        wrapper.unmount()
      }
    } finally {
      if (original === undefined) delete proto.requestFullscreen
      else proto.requestFullscreen = original
    }
  })

  it('clears the timer on unmount without crashing', async () => {
    vi.useFakeTimers()
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    await wrapper.find('img').trigger('load')
    expect(() => wrapper.unmount()).not.toThrow()
    await vi.advanceTimersByTimeAsync(5000)
  })
})
