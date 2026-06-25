// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PastRecordingViewer from '../../../app/components/PastRecordingViewer.vue'

function makeRecording(overrides = {}) {
  return {
    _id: 'rec-123',
    path: 'dev-1/stream/20260624_143000.h264',
    fileName: '20260624_143000.h264',
    size: 1024,
    durationMs: 60000,
    capturedAt: Date.now(),
    downloadUrl: 'https://s3.example.com/recording.h264',
    ...overrides,
  }
}

function makeH264Bytes(): ArrayBuffer {
  const sps = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x64, 0x00, 0x1F, 0xE8, 0x14, 0x0A])
  const pps = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x68, 0xEB, 0xEC, 0xB0])
  const idr = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x65, 0x88, 0x84, 0x00, 0x01])
  const nonIdr = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x41, 0x88, 0x84])
  const total = new Uint8Array(sps.length + pps.length + idr.length + nonIdr.length)
  let off = 0
  total.set(sps, off); off += sps.length
  total.set(pps, off); off += pps.length
  total.set(idr, off); off += idr.length
  total.set(nonIdr, off)
  return total.buffer as ArrayBuffer
}

let mockDecoderConfigure: ReturnType<typeof vi.fn>
let mockDecoderDecode: ReturnType<typeof vi.fn>
let mockDecoderClose: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockDecoderConfigure = vi.fn()
  mockDecoderDecode = vi.fn()
  mockDecoderClose = vi.fn()

  class MockDecoder {
    state = 'unconfigured'
    configure: ReturnType<typeof vi.fn>
    decode: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    flush: ReturnType<typeof vi.fn>
    constructor(_init: VideoDecoderInit) {
      this.configure = vi.fn(() => { this.state = 'configured'; mockDecoderConfigure() })
      this.decode = mockDecoderDecode
      this.close = mockDecoderClose
      this.flush = vi.fn()
    }
  }
  vi.stubGlobal('VideoDecoder', MockDecoder as unknown as typeof VideoDecoder)

  class MockChunk {
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
  }
  vi.stubGlobal('EncodedVideoChunk', MockChunk as unknown as typeof EncodedVideoChunk)

  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    canvas: document.createElement('canvas'),
    drawImage: vi.fn(),
  }) as unknown as CanvasRenderingContext2D)

  globalThis.fetch = vi.fn()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function waitForTick() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await new Promise(resolve => setTimeout(resolve, 0))
}

describe('PastRecordingViewer', () => {
  it('shows loading state initially', () => {
    vi.mocked(fetch).mockResolvedValue(new Response(makeH264Bytes()))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    expect(wrapper.text()).toContain('Memuat rekaman')
  })

  it('shows error when fetch fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(wrapper.text()).toContain('Gagal memuat rekaman')
  })

  it('shows error when fetch returns non-ok status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(wrapper.text()).toContain('Gagal memuat rekaman')
  })

  it('shows error for empty video file', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(new ArrayBuffer(0)))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(wrapper.text()).toContain('File video kosong')
  })

  it('shows error when no video frames found', async () => {
    const sps = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x67, 0x64, 0x00, 0x1F])
    const pps = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x68, 0xEB, 0xEC, 0xB0])
    const total = new Uint8Array(sps.length + pps.length)
    total.set(sps); total.set(pps, sps.length)
    vi.mocked(fetch).mockResolvedValue(new Response(total.buffer as ArrayBuffer))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(wrapper.text()).toContain('Tidak ada frame video yang ditemukan')
  })

  it('loads and shows time display', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(makeH264Bytes()))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(wrapper.text()).toContain('01:00')
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('decodes first frame on load', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(makeH264Bytes()))
    mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(mockDecoderDecode).toHaveBeenCalledOnce()
  })

  it('configures decoder with SPS codec', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(makeH264Bytes()))
    mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(mockDecoderConfigure).toHaveBeenCalledOnce()
  })

  it('renders play/pause button after loading', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(makeH264Bytes()))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThanOrEqual(2)
  })

  it('emits close event', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(makeH264Bytes()))
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    const buttons = wrapper.findAll('button')
    const closeBtn = buttons[buttons.length - 1]
    await closeBtn.trigger('click')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('shows error when VideoDecoder is not supported', async () => {
    delete (window as any).VideoDecoder
    delete (window as any).EncodedVideoChunk
    const wrapper = mount(PastRecordingViewer, {
      props: { recording: makeRecording() },
    })
    await waitForTick()
    expect(wrapper.text()).toContain('Browser tidak mendukung pemutaran video')
  })
})
