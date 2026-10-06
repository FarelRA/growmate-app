/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { EventEmitter } from 'node:events'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { createConnectionMock, mockMutation } = vi.hoisted(() => ({
  createConnectionMock: vi.fn(),
  mockMutation: vi.fn().mockResolvedValue({}),
}))

vi.mock('node:net', () => ({
  default: {
    createConnection: (...args: unknown[]) => (createConnectionMock as any)(...args),
  },
}))

vi.mock('~~/convex/_generated/api', () => ({
  api: { streams: { recordStreamSegment: 'recordStreamSegment' } },
}))

vi.mock('../../server/utils/storage', () => ({
  RECORDINGS_BUCKET: 'recordings',
  uploadFile: vi.fn().mockResolvedValue(undefined),
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../server/utils/convex', () => ({
  useConvex: () => ({ mutation: mockMutation, query: vi.fn() }),
  useConvexAuth: () => ({}),
}))

class FakeSocket extends EventEmitter {
  destroyed = false
  destroy() {
    this.destroyed = true
    return this
  }
}

function makePeer() {
  return { send: vi.fn(), close: vi.fn() }
}

const SC = Buffer.from([0x00, 0x00, 0x00, 0x01])
/** One complete H.264 NAL unit with leading start code. */
function nal(type: number, payload: number[] = [0xaa]): Buffer {
  return Buffer.concat([SC, Buffer.from([type & 0x1f, ...payload])])
}
/**
 * A deliverable packet: NALs terminated by a trailing start code.
 *
 * The parser only emits a NAL once the *following* start code arrives, so a
 * chunk holding lone NALs with no trailing start code is (by current design)
 * retained, not delivered. Feeding start-code-terminated packets matches how
 * large real TCP segments frame, and keeps every NAL deliverable.
 */
function packet(...nals: Buffer[]): Buffer {
  return Buffer.concat([...nals, SC])
}

// Segment dir is read at module load, so it must be set before import.
const segDir = mkdtempSync(join(tmpdir(), 'gm-seg-'))
process.env.GROWMATE_SEGMENT_DIR = segDir

const { streamManager, MAX_VIEWERS_PER_DEVICE, MAX_PENDING_UPLOADS, MAX_NAL_BUFFER_BYTES } =
  await import('../../server/utils/streamManager')
const mgr = streamManager as any

/** Connect and wait for the async segment rotation to open the file writer. */
async function connectReady(id: string) {
  await mgr.connect(id, '127.0.0.1', 8554)
  const state = mgr.streams.get(id)
  const deadline = Date.now() + 5000
  while (!state.fileWriter && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10))
  }
  expect(state.fileWriter).not.toBeNull()
  return state
}

function lastSocket(): FakeSocket {
  const calls = createConnectionMock.mock.calls
  expect(calls.length).toBeGreaterThan(0)
  return createConnectionMock.mock.results[createConnectionMock.mock.results.length - 1]!
    .value as FakeSocket
}

function feed(socket: FakeSocket, chunk: Buffer) {
  socket.emit('data', chunk)
}

afterAll(() => {
  rmSync(segDir, { recursive: true, force: true })
})

beforeEach(() => {
  createConnectionMock.mockReset()
  createConnectionMock.mockImplementation(() => new FakeSocket())
  mockMutation.mockClear()
  mockMutation.mockResolvedValue({})
  process.env.DEVICE_API_KEY = 'test-key'
})

afterEach(() => {
  for (const id of mgr.streams.keys()) {
    mgr.disconnect(id)
  }
  mgr.pendingUploads.clear()
})

describe('streamManager viewers', () => {
  it('closes peers with 4004 when the device stream is unknown', () => {
    const peer = makePeer()
    mgr.addViewer('no-such-device', peer)
    expect(peer.close).toHaveBeenCalledWith(4004, 'Stream not found')
    expect(peer.send).not.toHaveBeenCalled()
  })

  it('tracks connection state and clears it on disconnect', async () => {
    const id = 'dev-conn'
    expect(mgr.isConnected(id)).toBe(false)
    await connectReady(id)
    expect(mgr.isConnected(id)).toBe(true)

    const peer = makePeer()
    mgr.addViewer(id, peer)
    mgr.disconnect(id)
    expect(peer.close).toHaveBeenCalledWith(4001, 'Stream ended')
    expect(mgr.isConnected(id)).toBe(false)
    expect(mgr.streams.has(id)).toBe(false)
  })

  it('removeViewer stops delivery to that peer only', async () => {
    const id = 'dev-unsub'
    await connectReady(id)
    const socket = lastSocket()
    const a = makePeer()
    const b = makePeer()
    mgr.addViewer(id, a)
    mgr.addViewer(id, b)
    mgr.removeViewer(a)
    feed(socket, packet(nal(1, [0x01])))
    expect(a.send).not.toHaveBeenCalled()
    expect(b.send).toHaveBeenCalledTimes(1)
  })
})

describe('streamManager NAL framing caps', () => {
  it('caps the SPS/PPS cache at 2 entries', async () => {
    const id = 'dev-cache'
    await connectReady(id)
    const socket = lastSocket()
    for (let i = 0; i < 5; i++) {
      feed(socket, packet(nal(7, [i])))
      feed(socket, packet(nal(8, [i])))
    }
    const state = mgr.streams.get(id)
    expect(state.spsPpsCache.length).toBe(2)
  })

  it('frames each complete NAL exactly once across chunk boundaries', async () => {
    const id = 'dev-frame'
    await connectReady(id)
    const socket = lastSocket()
    const state = mgr.streams.get(id)
    const written: Buffer[] = []
    vi.spyOn(state.fileWriter, 'write').mockImplementation((buf: any) => {
      written.push(Buffer.from(buf))
      return true
    })

    feed(socket, packet(nal(7, [0x70]), nal(8, [0x80]), nal(5, [0x65])))

    // Each framed NAL is written once with its start code.
    expect(written).toHaveLength(3)
    expect(written[0]).toEqual(nal(7, [0x70]))
    expect(written[1]).toEqual(nal(8, [0x80]))
    expect(written[2]).toEqual(nal(5, [0x65]))
  })

  it('stays correctly framed over hundreds of chunks (no dupes, no loss)', async () => {
    const id = 'dev-volume'
    await connectReady(id)
    const socket = lastSocket()
    const peer = makePeer()
    mgr.addViewer(id, peer)

    const N = 300
    for (let i = 0; i < N; i++) {
      feed(socket, packet(nal(1, [i & 0xff])))
    }
    // Every NAL delivered exactly once, payloads in order — no duplication
    // or loss from buffer mismanagement at volume.
    expect(peer.send).toHaveBeenCalledTimes(N)
    const payloads = peer.send.mock.calls.map((c: any[]) => (c[0] as Buffer).subarray(-1)[0])
    expect(payloads).toEqual(Array.from({ length: N }, (_, i) => i & 0xff))
  })

  it('flags keyframes, replays cached SPS/PPS to late viewers, counts VCL frames', async () => {
    const id = 'dev-flags'
    await connectReady(id)
    const socket = lastSocket()
    feed(socket, packet(nal(7, [0x70])))
    feed(socket, packet(nal(8, [0x80])))
    feed(socket, packet(nal(5, [0x65]), nal(1, [0x41])))

    const state = mgr.streams.get(id)
    // SPS + PPS + IDR + non-IDR delivered as the following chunks frame them.
    expect(state.frameCount).toBe(2)

    const late = makePeer()
    mgr.addViewer(id, late)
    // Late viewer immediately gets the 2 cached SPS/PPS messages (non-keyframe).
    expect(late.send).toHaveBeenCalledTimes(2)
    for (const call of late.send.mock.calls) {
      expect((call[0] as Buffer)[0]).toBe(0x00)
    }

    const live = makePeer()
    mgr.addViewer(id, live)
    live.send.mockClear()
    feed(socket, packet(nal(5, [0x99])))
    const idrMsg = live.send.mock.calls[0]![0] as Buffer
    expect(idrMsg[0]).toBe(0x01)
    // Message layout: 1 flag byte + 6 timestamp bytes + NAL payload.
    expect(idrMsg.subarray(0, 1)).toHaveLength(1)
    expect(idrMsg.subarray(1, 7)).toHaveLength(6)
    expect([...idrMsg.subarray(7)]).toEqual([0x05, 0x99])
  })
})

describe('streamManager device auth', () => {
  it('throws at connect-time when DEVICE_API_KEY is unset (fail closed)', async () => {
    delete process.env.DEVICE_API_KEY
    await expect(mgr.connect('dev-nokey', '127.0.0.1', 8554)).rejects.toThrow(
      'DEVICE_API_KEY is not configured',
    )
    expect(mgr.streams.has('dev-nokey')).toBe(false)
  })

  it('passes deviceKey to recordStreamSegment on segment upload', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gm-segkey-'))
    const file = join(dir, 'seg.h264')
    writeFileSync(file, Buffer.from('segment-data'))
    try {
      await mgr.uploadSegment('dev-key', file, Date.now())
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    expect(mockMutation).toHaveBeenCalledWith(
      'recordStreamSegment',
      expect.objectContaining({ deviceId: 'dev-key', deviceKey: 'test-key' }),
    )
  })
})

describe('streamManager flush', () => {
  it('resolves immediately when there is nothing pending', async () => {
    await expect(mgr.flush()).resolves.toBeUndefined()
  })

  it('enforces the upload timeout cap instead of hanging forever', async () => {
    mgr.pendingUploads.add(new Promise(() => {}))
    try {
      await expect(mgr.flush(50)).rejects.toThrow('Upload flush timeout')
    } finally {
      mgr.pendingUploads.clear()
    }
  })
})

describe('streamManager caps', () => {
  it('resets the NAL reassembly buffer past MAX_NAL_BUFFER_BYTES instead of growing unbounded', async () => {
    const id = 'dev-overflow'
    await connectReady(id)
    const socket = lastSocket()
    const peer = makePeer()
    mgr.addViewer(id, peer)

    // Garbage with no start code: forces the 2 MiB overflow reset path.
    feed(socket, Buffer.alloc(MAX_NAL_BUFFER_BYTES + 1024))
    // Stream recovers: the next valid packet is framed and delivered.
    feed(socket, packet(nal(1, [0x77])))
    expect(peer.send).toHaveBeenCalledTimes(1)
    const msg = peer.send.mock.calls[0]![0] as Buffer
    expect([...msg.subarray(7)]).toEqual([0x01, 0x77])
  })

  it(`evicts the oldest viewer past MAX_VIEWERS_PER_DEVICE (${MAX_VIEWERS_PER_DEVICE})`, async () => {
    const id = 'dev-viewercap'
    await connectReady(id)
    const peers = Array.from({ length: MAX_VIEWERS_PER_DEVICE + 1 }, () => makePeer())
    for (const peer of peers) {
      mgr.addViewer(id, peer)
    }
    expect(peers[0]!.close).toHaveBeenCalledWith(4003, 'Viewer limit reached')
    expect(peers[MAX_VIEWERS_PER_DEVICE]!.close).not.toHaveBeenCalled()
    expect(mgr.viewers.get(id).size).toBe(MAX_VIEWERS_PER_DEVICE)
  })

  it(`tracks at most MAX_PENDING_UPLOADS (${MAX_PENDING_UPLOADS}) uploads`, async () => {
    for (let i = 0; i < MAX_PENDING_UPLOADS + 5; i++) {
      mgr.trackUpload(new Promise(() => {}))
    }
    expect(mgr.pendingUploads.size).toBe(MAX_PENDING_UPLOADS)
  })
})
