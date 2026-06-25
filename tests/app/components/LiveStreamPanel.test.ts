// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import LiveStreamPanel from '../../../app/components/LiveStreamPanel.vue'

function createMockWs() {
  const ws: {
    _url?: string
    binaryType: string
    readyState: number
    onopen: ((e: Event) => void) | null
    onclose: ((e: CloseEvent) => void) | null
    onerror: ((e: Event) => void) | null
    onmessage: ((e: MessageEvent) => void) | null
    close: ReturnType<typeof vi.fn>
    send: ReturnType<typeof vi.fn>
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
    dispatchEvent: ReturnType<typeof vi.fn>
  } = {
    binaryType: '',
    readyState: 0,
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
    close: vi.fn(),
    send: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }
  return ws
}

function createMockDecoder() {
  let state = 'unconfigured'
  return {
    get state() { return state },
    set state(v: string) { state = v },
    configure: vi.fn(() => { state = 'configured' }),
    decode: vi.fn(),
    close: vi.fn(),
    flush: vi.fn(),
  }
}

let mockWs: ReturnType<typeof createMockWs>
let mockDecoder: ReturnType<typeof createMockDecoder>
let decoderCtor: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockWs = createMockWs()
  mockDecoder = createMockDecoder()

  vi.stubGlobal('WebSocket', function(this: void, url: string | URL) {
    mockWs._url = String(url)
    return mockWs
  } as unknown as typeof WebSocket)

  decoderCtor = vi.fn()
  class VideoDecoderMock {
    configure!: ReturnType<typeof vi.fn>
    decode!: ReturnType<typeof vi.fn>
    close!: ReturnType<typeof vi.fn>
    flush!: ReturnType<typeof vi.fn>
    get state() { return mockDecoder.state }
    set state(v: string) { mockDecoder.state = v }
    constructor(init: VideoDecoderInit) {
      decoderCtor(init)
      this.configure = mockDecoder.configure
      this.decode = mockDecoder.decode
      this.close = mockDecoder.close
      this.flush = mockDecoder.flush
    }
  }
  vi.stubGlobal('VideoDecoder', VideoDecoderMock as unknown as typeof VideoDecoder)

  vi.stubGlobal('EncodedVideoChunk', class {
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
  })

  HTMLCanvasElement.prototype.getContext = vi.fn(() => {
    const canvas = document.createElement('canvas')
    return {
      canvas,
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LiveStreamPanel', () => {
  it('renders panel heading', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'test' } })
    expect(wrapper.text()).toContain('Siaran langsung')
  })

  it('shows unsupported message when WebCodecs unavailable', () => {
    vi.stubGlobal('VideoDecoder', undefined)
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'test' } })
    expect(wrapper.text()).toContain('Browser tidak mendukung pemutaran video langsung')
  })

  it('shows connecting state initially', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    expect(wrapper.text()).toContain('Menghubungkan ke kamera')
  })

  it('renders canvas element', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev-1' } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('connects WebSocket with correct URL', () => {
    vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:3000' })
    mount(LiveStreamPanel, { props: { deviceId: 'test-device' } })
    expect(mockWs._url).toBe('ws://localhost:3000/api/v2/stream/test-device/live')
  })

  it('uses wss for https origins', () => {
    vi.stubGlobal('location', { protocol: 'https:', host: 'growmate.bond' })
    mount(LiveStreamPanel, { props: { deviceId: 'secure-dev' } })
    expect(mockWs._url).toBe('wss://growmate.bond/api/v2/stream/secure-dev/live')
  })

  it('sets binary type to arraybuffer', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    expect(mockWs.binaryType).toBe('arraybuffer')
  })

  it('creates VideoDecoder instance', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    expect(decoderCtor).toHaveBeenCalled()
  })

  it('configures decoder when SPS NAL unit arrives via WebSocket', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    // SPS NAL: nalType 7, profile=High(0x64), constraints=0, level=3.1(0x1F)
    const sps = new Uint8Array([0x67, 0x64, 0x00, 0x1F, 0xE8, 0x14, 0x0A])
    const msg = createWsMessage(sps)
    mockWs.onmessage!(msg as unknown as MessageEvent)
    expect(mockDecoder.configure).toHaveBeenCalled()
    const callArg = mockDecoder.configure.mock.calls[0][0]
    expect(callArg.codec).toBe('avc1.64001f')
  })

  it('decodes IDR frames when keyframe flag is set', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    // First send SPS
    const sps = new Uint8Array([0x67, 0x64, 0x00, 0x1F, 0xE8, 0x14, 0x0A])
    mockWs.onmessage!(createWsMessage(sps) as unknown as MessageEvent)
    // Then send IDR frame
    const idr = new Uint8Array([0x65, 0x88, 0x84, 0x00, 0x01])
    mockWs.onmessage!(createWsMessage(idr, true) as unknown as MessageEvent)
    expect(mockDecoder.decode).toHaveBeenCalled()
    const chunk = mockDecoder.decode.mock.calls[0][0]
    expect(chunk.type).toBe('key')
  })

  it('decodes non-IDR frames as delta', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    const sps = new Uint8Array([0x67, 0x64, 0x00, 0x1F, 0xE8, 0x14, 0x0A])
    mockWs.onmessage!(createWsMessage(sps) as unknown as MessageEvent)
    const slice = new Uint8Array([0x41, 0x88, 0x84])
    mockWs.onmessage!(createWsMessage(slice, false) as unknown as MessageEvent)
    const chunk = mockDecoder.decode.mock.calls[0][0]
    expect(chunk.type).toBe('delta')
  })

  it('shows error state when WebSocket errors', async () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    mockWs.onerror!(new Event('error'))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Koneksi WebSocket gagal')
  })

  it('shows retry button on error', async () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    mockWs.onerror!(new Event('error'))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('Coba Lagi')
  })

  it('starts timer when WebSocket opens', () => {
    vi.useFakeTimers()
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    mockWs.onopen!(new Event('open'))
    vi.advanceTimersByTime(1000)
    vi.useRealTimers()
  })

  it('closes WebSocket on unmount', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    wrapper.unmount()
    expect(mockWs.close).toHaveBeenCalled()
  })

  it('closes decoder on unmount', () => {
    const wrapper = mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    wrapper.unmount()
    expect(mockDecoder.close).toHaveBeenCalled()
  })

  it('handles empty ArrayBuffer message gracefully', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    const emptyMsg = new MessageEvent('message', { data: new ArrayBuffer(0) })
    mockWs.onmessage!(emptyMsg)
    // No crash means it works
  })

  it('handles short ArrayBuffer (< 7 bytes) gracefully', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    const shortMsg = new MessageEvent('message', { data: new ArrayBuffer(3) })
    mockWs.onmessage!(shortMsg)
  })

  it('skips PPS NAL units without decoding', () => {
    mount(LiveStreamPanel, { props: { deviceId: 'dev' } })
    const pps = new Uint8Array([0x68, 0xEB, 0xEC, 0xB0])
    mockWs.onmessage!(createWsMessage(pps) as unknown as MessageEvent)
    expect(mockDecoder.decode).not.toHaveBeenCalled()
  })
})

function createWsMessage(nalUnit: Uint8Array, isKeyframe = false): MessageEvent {
  const flags = isKeyframe ? 0x01 : 0x00
  const tsBuf = new Uint8Array(6)
  const header = new Uint8Array([flags, ...tsBuf])
  const data = new Uint8Array(header.length + nalUnit.length)
  data.set(header)
  data.set(nalUnit, header.length)
  return new MessageEvent('message', { data: data.buffer as ArrayBuffer })
}
