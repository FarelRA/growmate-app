/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  streamManager,
  MAX_VIEWERS_PER_DEVICE,
  MAX_PENDING_UPLOADS,
  MAX_NAL_BUFFER_BYTES,
} from '~~/server/utils/streamManager'

vi.mock('~~/convex/_generated/api', () => ({
  api: { streams: { recordStreamSegment: 'recordStreamSegment' } },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({ mutation: vi.fn() }),
}))

vi.mock('~~/server/utils/storage', () => ({
  RECORDINGS_BUCKET: 'recordings',
  uploadFile: vi.fn(),
}))

function fakePeer() {
  return { send: vi.fn(), close: vi.fn() }
}

beforeEach(() => {
  const mgr = streamManager as any
  mgr.streams.delete('dev-cap')
  mgr.viewers.delete('dev-cap')
  mgr.pendingUploads.clear()
})

afterEach(() => {
  const mgr = streamManager as any
  mgr.streams.delete('dev-cap')
  mgr.viewers.delete('dev-cap')
  mgr.pendingUploads.clear()
  vi.restoreAllMocks()
})

describe('streamManager caps', () => {
  it('exposes the required cap constants', () => {
    expect(MAX_VIEWERS_PER_DEVICE).toBe(20)
    expect(MAX_PENDING_UPLOADS).toBe(32)
    expect(MAX_NAL_BUFFER_BYTES).toBe(2 * 1024 * 1024)
  })

  it('closes streams that do not exist for new viewers', () => {
    const peer = fakePeer()
    streamManager.addViewer('missing-device', peer)
    expect(peer.close).toHaveBeenCalledWith(4004, 'Stream not found')
  })

  it('caps viewers per device at 20, evicting the oldest', () => {
    const mgr = streamManager as any
    mgr.streams.set('dev-cap', { deviceId: 'dev-cap', spsPpsCache: [] })

    const peers = Array.from({ length: 25 }, () => fakePeer())
    for (const peer of peers) streamManager.addViewer('dev-cap', peer)

    const viewers: Set<any> = mgr.viewers.get('dev-cap')
    expect(viewers.size).toBe(MAX_VIEWERS_PER_DEVICE)
    expect(viewers.has(peers[0])).toBe(false)
    expect(peers[0].close).toHaveBeenCalled()
    for (let i = 5; i < 25; i++) {
      expect(viewers.has(peers[i])).toBe(true)
    }
  })

  it('drops and warns when pending uploads reach the cap', () => {
    const mgr = streamManager as any
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (let i = 0; i < MAX_PENDING_UPLOADS; i++) {
      mgr.pendingUploads.add(new Promise<void>(() => {}))
    }
    mgr.trackUpload.call(streamManager, Promise.resolve())
    expect(mgr.pendingUploads.size).toBe(MAX_PENDING_UPLOADS)
    expect(warn).toHaveBeenCalled()
  })

  it('clears the per-device interval on disconnect', () => {
    const mgr = streamManager as any
    vi.useFakeTimers()
    try {
      mgr.streams.set('dev-cap', {
        deviceId: 'dev-cap',
        tcpSocket: null,
        fileWriter: null,
        currentFilePath: null,
        segmentTimer: setInterval(() => {}, 1000),
        reconnectTimer: setTimeout(() => {}, 1000),
        spsPpsCache: [],
      })
      const state = mgr.streams.get('dev-cap')
      streamManager.disconnect('dev-cap')
      expect(state.segmentTimer).toBeNull()
      expect(state.reconnectTimer).toBeNull()
      expect(mgr.streams.has('dev-cap')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})
