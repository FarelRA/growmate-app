/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const netState = vi.hoisted(() => ({ sockets: [] as any[] }))
const fsState = vi.hoisted(() => ({ writers: [] as any[] }))

vi.mock('node:net', async (importOriginal) => {
  const orig: any = await importOriginal()
  const { EventEmitter } = await import('node:events')
  const createConnection = (...args: any[]) => {
    const s: any = new EventEmitter()
    s.destroyed = false
    s.destroy = function () {
      ;(this as any).destroyed = true
      return this
    }
    netState.sockets.push(s)
    const cb = args.find((a) => typeof a === 'function')
    if (cb) queueMicrotask(() => { if (!s.destroyed) cb() })
    return s
  }
  return {
    ...orig,
    createConnection,
    default: { ...(orig.default ?? orig), createConnection },
  }
})

vi.mock('node:fs', async (importOriginal) => {
  const orig: any = await importOriginal()
  const { EventEmitter } = await import('node:events')
  const createWriteStream = (...args: any[]) => {
    const emitter: any = new EventEmitter()
    emitter.write = (..._a: any[]) => true
    emitter.end = function () {
      queueMicrotask(() => emitter.emit('finish'))
      return emitter
    }
    emitter.path = args[0]
    fsState.writers.push(emitter)
    return emitter
  }
  return {
    ...orig,
    createWriteStream,
    default: { ...(orig.default ?? orig), createWriteStream },
  }
})

vi.mock('~~/convex/_generated/api', () => ({
  api: { streams: { recordStreamSegment: 'recordStreamSegment' } },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({ mutation: vi.fn().mockResolvedValue({}) }),
}))

vi.mock('~~/server/utils/storage', () => ({
  RECORDINGS_BUCKET: 'recordings',
  uploadFile: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  stat: vi.fn().mockResolvedValue({ size: 10 }),
  readFile: vi.fn().mockResolvedValue(Buffer.alloc(10)),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

import {
  streamManager,
  getReconnectDelay,
  RECONNECT_BASE_DELAY_MS,
  RECONNECT_MAX_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
  MAX_VIEWERS_PER_DEVICE,
  MAX_PENDING_UPLOADS,
  MAX_NAL_BUFFER_BYTES,
} from '~~/server/utils/streamManager'
import { uploadFile } from '~~/server/utils/storage'

function fakePeer() {
  return { send: vi.fn(), close: vi.fn() }
}

function resetDevice(deviceId: string) {
  const mgr = streamManager as any
  try { streamManager.disconnect(deviceId) } catch { /* empty */ }
  mgr.streams.delete(deviceId)
  mgr.viewers.delete(deviceId)
}

beforeEach(() => {
  process.env.DEVICE_API_KEY = 'test-key'
  netState.sockets.length = 0
  fsState.writers.length = 0
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.mocked(uploadFile).mockClear()
})

afterEach(() => {
  vi.mocked(uploadFile).mockClear()
  vi.useRealTimers()
  const mgr = streamManager as any
  for (const id of Array.from(mgr.streams.keys()) as string[]) {
    try { streamManager.disconnect(id) } catch { /* empty */ }
  }
  mgr.pendingUploads.clear()
  mgr.viewers.clear()
  vi.restoreAllMocks()
})

describe('streamManager stale generations', () => {
  it('keeps caps + fail-closed behavior untouched', async () => {
    expect(MAX_VIEWERS_PER_DEVICE).toBe(20)
    expect(MAX_PENDING_UPLOADS).toBe(32)
    expect(MAX_NAL_BUFFER_BYTES).toBe(2 * 1024 * 1024)
    const saved = process.env.DEVICE_API_KEY
    delete process.env.DEVICE_API_KEY
    await expect(streamManager.connect('dev-fail-closed', '127.0.0.1', 1)).rejects.toThrow(
      'DEVICE_API_KEY is not configured',
    )
    process.env.DEVICE_API_KEY = saved
  })

  it('TCP flap during rotation kills nothing new (stale close ignored)', async () => {
    vi.useFakeTimers()
    const deviceId = 'dev-stale-flap'
    resetDevice(deviceId)

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const mgr = streamManager as any
    const state1 = mgr.streams.get(deviceId)
    expect(state1).toBeDefined()
    const gen1 = state1.generation
    const socket1 = netState.sockets[0]
    expect(socket1).toBeDefined()

    // Rotate: second connect swaps the map entry.
    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const state2 = mgr.streams.get(deviceId)
    const socket2 = netState.sockets[1]
    expect(state2).toBeDefined()
    expect(state1).not.toBe(state2)
    expect(state2.generation).toBe(gen1 + 1)
    const writer2 = state2.fileWriter
    expect(writer2).not.toBeNull()

    // Viewer attaches to the NEW generation.
    const peer = fakePeer()
    streamManager.addViewer(deviceId, peer)
    expect(peer.close).not.toHaveBeenCalled()

    const socketsBefore = netState.sockets.length
    vi.mocked(uploadFile).mockClear()

    // Old-socket TCP flap: must be ignored entirely. Advance past the base
    // reconnect delay (5s) but stay below the 60s segment interval so a
    // legitimate interval rotation can't mask a stale kill.
    socket1.emit('close')
    await vi.advanceTimersByTimeAsync(30_000)

    expect(mgr.streams.get(deviceId)).toBe(state2)
    expect(state2.fileWriter).toBe(writer2)
    expect(state2.reconnectTimer).toBeNull()
    expect(state1.reconnectTimer).toBeNull()
    expect(peer.close).not.toHaveBeenCalledWith(4001, 'Stream ended')
    expect(netState.sockets.length).toBe(socketsBefore)
    expect(vi.mocked(uploadFile)).not.toHaveBeenCalled()
    expect(socket2.destroyed).toBe(false)
  })

  it('stale data from an old socket drives no file/rotate/upload or broadcast', async () => {
    vi.useFakeTimers()
    const deviceId = 'dev-stale-data'
    resetDevice(deviceId)

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const mgr = streamManager as any
    const state1 = mgr.streams.get(deviceId)
    const socket1 = netState.sockets[0]

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const state2 = mgr.streams.get(deviceId)
    expect(state1).not.toBe(state2)

    const peer = fakePeer()
    streamManager.addViewer(deviceId, peer)
    peer.send.mockClear()
    const framesBefore = state2.frameCount

    const sc4 = Buffer.from([0x00, 0x00, 0x00, 0x01])
    const idr = Buffer.concat([sc4, Buffer.from([0x65, 0x11, 0x22]), sc4])
    socket1.emit('data', idr)
    await vi.advanceTimersByTimeAsync(0)

    expect(state2.frameCount).toBe(framesBefore)
    expect(peer.send).not.toHaveBeenCalled()
  })

  it('stale rotateSegment is a no-op (no detached file)', async () => {
    vi.useFakeTimers()
    const deviceId = 'dev-stale-rotate'
    resetDevice(deviceId)

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const mgr = streamManager as any
    const stale = mgr.streams.get(deviceId)

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const current = mgr.streams.get(deviceId)
    expect(stale).not.toBe(current)

    const writesBefore = fsState.writers.length
    await (mgr.rotateSegment as any).call(streamManager, stale)
    expect(fsState.writers.length).toBe(writesBefore)
    expect(mgr.streams.get(deviceId)).toBe(current)
  })

  it('reconnect uses exponential backoff with jitter and a max retry cap', async () => {
    // Deterministic schedule: jitter = 0.
    expect(RECONNECT_BASE_DELAY_MS).toBe(5_000)
    expect(RECONNECT_MAX_DELAY_MS).toBe(60_000)
    expect(getReconnectDelay(0)).toBe(5_000)
    expect(getReconnectDelay(1)).toBe(10_000)
    expect(getReconnectDelay(2)).toBe(20_000)
    expect(getReconnectDelay(3)).toBe(40_000)
    expect(getReconnectDelay(4)).toBe(60_000)
    expect(getReconnectDelay(5)).toBe(60_000)

    vi.mocked(Math.random).mockReturnValue(0.5)
    expect(getReconnectDelay(0)).toBe(5_500)
    expect(getReconnectDelay(1)).toBe(10_500)
    vi.mocked(Math.random).mockReturnValue(0)

    // Live schedule: the close path waits getReconnectDelay(attempts).
    // Note: a successful connect resets attempts to 0, so every fresh flap
    // waits the base delay; exponential growth is driven by attempts, which
    // we set explicitly below to prove the mapping end to end.
    vi.useFakeTimers()
    const deviceId = 'dev-backoff'
    resetDevice(deviceId)

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    expect(netState.sockets.length).toBe(1)

    const mgrLive = streamManager as any
    // Fresh flap -> base delay.
    {
      const sock = netState.sockets[netState.sockets.length - 1]
      const n = netState.sockets.length
      sock.emit('close')
      await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS - 1)
      expect(netState.sockets.length).toBe(n)
      await vi.advanceTimersByTimeAsync(1)
      expect(netState.sockets.length).toBe(n + 1)
      await vi.advanceTimersByTimeAsync(0)
    }
    // Attempt 1 -> 10s, attempt 2 -> 20s (proves exponential mapping live).
    for (const attempt of [1, 2]) {
      const expected = getReconnectDelay(attempt)
      mgrLive.streams.get(deviceId).reconnectAttempts = attempt
      const sock = netState.sockets[netState.sockets.length - 1]
      const n = netState.sockets.length
      sock.emit('close')
      await vi.advanceTimersByTimeAsync(expected - 1)
      expect(netState.sockets.length).toBe(n)
      await vi.advanceTimersByTimeAsync(1)
      expect(netState.sockets.length).toBe(n + 1)
      await vi.advanceTimersByTimeAsync(0)
    }
    expect(MAX_RECONNECT_ATTEMPTS).toBeGreaterThan(3)
  })

  it('gives up after max reconnect attempts', async () => {
    vi.useFakeTimers()
    const deviceId = 'dev-backoff-max'
    resetDevice(deviceId)

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const mgr = streamManager as any
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Exhausted budget: close is still cleaned up but no timer is armed.
    mgr.streams.get(deviceId).reconnectAttempts = MAX_RECONNECT_ATTEMPTS
    const sock = netState.sockets[netState.sockets.length - 1]
    const n = netState.sockets.length
    sock.emit('close')
    await vi.advanceTimersByTimeAsync(RECONNECT_MAX_DELAY_MS * 2)
    expect(netState.sockets.length).toBe(n)
    expect(err).toHaveBeenCalled()
  })

  it('skips malformed NAL units without throwing', async () => {
    vi.useFakeTimers()
    const deviceId = 'dev-stale-nal'
    resetDevice(deviceId)

    await streamManager.connect(deviceId, '127.0.0.1', 1935)
    await vi.advanceTimersByTimeAsync(0)
    const mgr = streamManager as any
    const state = mgr.streams.get(deviceId)
    const socket = netState.sockets[netState.sockets.length - 1]

    const peer = fakePeer()
    streamManager.addViewer(deviceId, peer)
    peer.send.mockClear()
    const framesBefore = state.frameCount

    const sc4 = Buffer.from([0x00, 0x00, 0x00, 0x01])
    // Back-to-back start codes => zero-length unit (malformed).
    expect(() => socket.emit('data', Buffer.concat([sc4, sc4]))).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)
    // Lone start code with no payload => nothing to decode.
    expect(() => socket.emit('data', Buffer.from(sc4))).not.toThrow()
    await vi.advanceTimersByTimeAsync(0)

    expect(state.frameCount).toBe(framesBefore)
    expect(peer.send).not.toHaveBeenCalled()

    // Sanity: a well-formed IDR still flows through.
    const idr = Buffer.concat([sc4, Buffer.from([0x65, 0xaa, 0xbb]), sc4])
    socket.emit('data', idr)
    await vi.advanceTimersByTimeAsync(0)
    expect(state.frameCount).toBe(framesBefore + 1)
    expect(peer.send).toHaveBeenCalled()
  })
})
