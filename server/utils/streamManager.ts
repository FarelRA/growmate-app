import net from 'node:net'
import fs from 'node:fs'
import { mkdir, stat, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { api } from '~~/convex/_generated/api'
import { useConvex } from './convex'
import { RECORDINGS_BUCKET, uploadFile } from './storage'

const SEGMENT_DIR = process.env.GROWMATE_SEGMENT_DIR ?? '/var/growmate/segments'
const SEGMENT_INTERVAL_MS = 60_000
const RECONNECT_DELAY_MS = 5_000

export const MAX_VIEWERS_PER_DEVICE = 20
export const MAX_PENDING_UPLOADS = 32
export const MAX_NAL_BUFFER_BYTES = 2 * 1024 * 1024

export const RECONNECT_BASE_DELAY_MS = RECONNECT_DELAY_MS
export const RECONNECT_MAX_DELAY_MS = 60_000
export const MAX_RECONNECT_ATTEMPTS = 10
export const RECONNECT_JITTER_MS = 1_000

export function getReconnectDelay(attempt: number): number {
  const safeAttempt = Math.max(0, Math.floor(attempt))
  const exponential = RECONNECT_BASE_DELAY_MS * 2 ** safeAttempt
  const capped = Math.min(exponential, RECONNECT_MAX_DELAY_MS)
  const jitter = Math.random() * RECONNECT_JITTER_MS
  return capped + jitter
}

/**
 * Server-side device key for Convex mutations (same trust domain — this code
 * only runs on the server). Fail-closed: a missing key is a misconfiguration
 * and must throw instead of allowing unauthenticated writes.
 */
function readDeviceKey(): string {
  const key = process.env.DEVICE_API_KEY
  if (!key) {
    throw new Error('DEVICE_API_KEY is not configured')
  }
  return key
}

interface PeerLike {
  send(data: unknown): void
  close(code?: number, reason?: string): void
}

interface StreamState {
  deviceId: string
  tcpSocket: net.Socket | null
  fileWriter: fs.WriteStream | null
  currentFilePath: string | null
  segmentTimer: NodeJS.Timeout | null
  reconnectTimer: NodeJS.Timeout | null
  spsPpsCache: Buffer[]
  host: string
  port: number
  frameCount: number
  segmentStartTime: number
  generation: number
  reconnectAttempts: number
}
class StreamManager {
  private streams = new Map<string, StreamState>()
  private viewers = new Map<string, Set<PeerLike>>()
  private peerDeviceMap = new WeakMap<object, string>()
  private pendingUploads = new Set<Promise<void>>()
  private deviceGenerations = new Map<string, number>()

  private isCurrent(state: StreamState): boolean {
    return (
      this.streams.get(state.deviceId) === state &&
      this.deviceGenerations.get(state.deviceId) === state.generation
    )
  }

  async connect(deviceId: string, host: string, port: number): Promise<void> {
    // Fail closed up front: without a server device key, segment uploads
    // can't authenticate to Convex — refuse the stream now, not 60s later.
    readDeviceKey()

    const existing = this.streams.get(deviceId)
    if (existing) this.disconnect(deviceId)

    const generation = (this.deviceGenerations.get(deviceId) ?? 0) + 1
    this.deviceGenerations.set(deviceId, generation)

    const state: StreamState = {
      deviceId,
      tcpSocket: null,
      fileWriter: null,
      currentFilePath: null,
      segmentTimer: null,
      reconnectTimer: null,
      spsPpsCache: [],
      host,
      port,
      frameCount: 0,
      segmentStartTime: Date.now(),
      generation,
      reconnectAttempts: 0,
    }

    this.streams.set(deviceId, state)
    this.connectSocket(state)
    await this.rotateSegment(state)
  }

  private connectSocket(state: StreamState): void {
    const { deviceId, host, port } = state
    const generation = state.generation
    const socket = net.createConnection(port, host, () => {
      if (!this.isCurrent(state)) {
        socket.destroy()
        return
      }
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer)
        state.reconnectTimer = null
      }
      state.reconnectAttempts = 0
    })

    state.tcpSocket = socket

    if (state.segmentTimer) {
      clearInterval(state.segmentTimer)
      state.segmentTimer = null
    }
    state.segmentTimer = setInterval(() => {
      if (!this.isCurrent(state)) return
      void this.rotateSegment(state).catch((err) => {
        console.error(`[StreamManager] Failed to rotate segment for ${deviceId}:`, err)
      })
    }, SEGMENT_INTERVAL_MS)

    let nalBuffer = Buffer.alloc(0)

    socket.on('data', (chunk: Buffer) => {
      if (!this.isCurrent(state)) return
      nalBuffer = Buffer.concat([nalBuffer, chunk])

      if (nalBuffer.length > MAX_NAL_BUFFER_BYTES) {
        console.warn(
          `[StreamManager] NAL buffer overflow for ${deviceId} (${nalBuffer.length} bytes); resetting buffer`,
        )
        nalBuffer = Buffer.alloc(0)
        return
      }

      const startCodes = [Buffer.from([0x00, 0x00, 0x00, 0x01]), Buffer.from([0x00, 0x00, 0x01])]
      const findStart = (buf: Buffer, offset: number): { pos: number; len: number } | null => {
        for (const sc of startCodes) {
          const pos = buf.indexOf(sc, offset)
          if (pos !== -1) return { pos, len: sc.length }
        }
        return null
      }

      const first = findStart(nalBuffer, 0)
      if (!first) return
      let nalStart = first.pos + first.len
      let searchFrom = nalStart

      while (searchFrom < nalBuffer.length) {
        const next = findStart(nalBuffer, searchFrom)
        if (!next) break

        if (next.pos === nalStart) {
          searchFrom = next.pos + next.len
          nalStart = searchFrom
          continue
        }

        const nalUnit = nalBuffer.subarray(nalStart, next.pos)
        if (nalUnit.length === 0) {
          searchFrom = next.pos + next.len
          nalStart = searchFrom
          continue
        }
        const firstByte = nalUnit.at(0)
        if (firstByte === undefined) {
          searchFrom = next.pos + next.len
          nalStart = searchFrom
          continue
        }
        const nalType = firstByte & 0x1F
        const timestamp = state.frameCount * (1_000_000 / 15)

        this.processNalUnit(state, nalUnit, nalType, timestamp)

        searchFrom = next.pos + next.len
        nalStart = searchFrom
      }

      if (nalStart > 0) {
        nalBuffer = nalBuffer.subarray(nalStart)
      }
    })

    socket.on('close', () => {
      if (this.deviceGenerations.get(deviceId) !== generation) return
      if (this.streams.get(deviceId) !== state) return

      this.disconnect(deviceId, true)

      if (this.streams.get(deviceId) !== state) return
      if (this.deviceGenerations.get(deviceId) !== generation) return

      if (state.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error(
          `[StreamManager] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for ${deviceId}; giving up`,
        )
        return
      }

      const delay = getReconnectDelay(state.reconnectAttempts)
      state.reconnectAttempts += 1

      state.reconnectTimer = setTimeout(() => {
        if (this.deviceGenerations.get(deviceId) !== generation) return
        if (this.streams.get(deviceId) !== state) return
        if (this.streams.has(deviceId)) {
          this.connectSocket(state)
          void this.rotateSegment(state).catch((err) => {
            console.error(`[StreamManager] Failed to rotate segment for ${deviceId}:`, err)
          })
        }
      }, delay)
    })

    socket.on('error', () => {
      socket.destroy()
    })
  }

  private processNalUnit(state: StreamState, nalUnit: Buffer, nalType: number, timestamp: number) {
    if (!this.isCurrent(state)) return
    const isVclNal = nalType === 1 || nalType === 5
    if (isVclNal) {
      state.frameCount++
    }

    if (nalType === 7 || nalType === 8) {
      state.spsPpsCache.push(Buffer.from(nalUnit))
      if (state.spsPpsCache.length > 2) {
        state.spsPpsCache = state.spsPpsCache.slice(-2)
      }
    }

    if (state.fileWriter) {
      const startCode = Buffer.from([0x00, 0x00, 0x00, 0x01])
      state.fileWriter.write(Buffer.concat([startCode, nalUnit]))
    }

    const isKeyframe = nalType === 5
    const message = this.encodeWsMessage(nalUnit, isKeyframe, timestamp)
    const deviceViewers = this.viewers.get(state.deviceId)
    if (deviceViewers) {
      for (const peer of deviceViewers) {
        try {
          peer.send(message)
        } catch {
          deviceViewers.delete(peer)
        }
      }
    }
  }

  private encodeWsMessage(nalUnit: Buffer, isKeyframe: boolean, timestamp: number): Buffer {
    const flags = isKeyframe ? 0x01 : 0x00
    const tsBuf = Buffer.alloc(6)
    tsBuf.writeUIntBE(timestamp, 0, 6)
    return Buffer.concat([Buffer.from([flags]), tsBuf, nalUnit])
  }

  addViewer(deviceId: string, peer: PeerLike): void {
    const state = this.streams.get(deviceId)
    if (!state) {
      peer.close(4004, 'Stream not found')
      return
    }

    let deviceViewers = this.viewers.get(deviceId)
    if (!deviceViewers) {
      deviceViewers = new Set()
      this.viewers.set(deviceId, deviceViewers)
    }
    if (!deviceViewers.has(peer) && deviceViewers.size >= MAX_VIEWERS_PER_DEVICE) {
      const oldest = deviceViewers.values().next().value as PeerLike | undefined
      if (oldest) {
        try {
          oldest.close(4003, 'Viewer limit reached')
        } catch { /* empty */ }
        deviceViewers.delete(oldest)
        this.peerDeviceMap.delete(oldest)
      }
    }
    deviceViewers.add(peer)
    this.peerDeviceMap.set(peer, deviceId)

    for (const nal of state.spsPpsCache) {
      const msg = this.encodeWsMessage(nal, false, 0)
      peer.send(msg)
    }
  }

  removeViewer(peer: PeerLike): void {
    const deviceId = this.peerDeviceMap.get(peer)
    if (!deviceId) return
    this.peerDeviceMap.delete(peer)
    const deviceViewers = this.viewers.get(deviceId)
    if (deviceViewers) {
      deviceViewers.delete(peer)
    }
  }

  isConnected(deviceId: string): boolean {
    const state = this.streams.get(deviceId)
    return !!state && state.tcpSocket !== null && !state.tcpSocket.destroyed
  }

  private trackUpload(promise: Promise<void>): void {
    if (this.pendingUploads.size >= MAX_PENDING_UPLOADS) {
      console.warn(
        `[StreamManager] Pending uploads cap (${MAX_PENDING_UPLOADS}) reached; dropping upload tracking`,
      )
      promise.catch((err) => {
        console.error('[StreamManager] Untracked segment upload failed:', err)
      })
      return
    }
    this.pendingUploads.add(promise)
    promise.finally(() => this.pendingUploads.delete(promise))
  }

  private async closeWriter(state: StreamState): Promise<void> {
    const writer = state.fileWriter
    state.fileWriter = null
    if (!writer) return
    await Promise.race([
      new Promise<void>((resolve) => {
        writer.once('finish', () => resolve())
        writer.once('error', () => resolve())
        writer.end()
      }),
      new Promise<void>((resolve) => setTimeout(() => resolve(), 5_000)),
    ])
  }

  private async rotateSegment(state: StreamState): Promise<void> {
    if (!this.isCurrent(state)) return
    const generation = state.generation
    if (state.fileWriter && state.currentFilePath) {
      const filePath = state.currentFilePath
      const segmentStart = state.segmentStartTime
      await this.closeWriter(state)
      if (!this.isCurrent(state)) return
      if (this.deviceGenerations.get(state.deviceId) !== generation) return
      state.currentFilePath = null
      this.trackUpload(this.uploadSegment(state.deviceId, filePath, segmentStart, generation))
    }

    if (!this.isCurrent(state)) return
    if (this.deviceGenerations.get(state.deviceId) !== generation) return

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fileName = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.h264`
    const dir = `${SEGMENT_DIR}/${state.deviceId}`
    await mkdir(dir, { recursive: true })
    if (!this.isCurrent(state)) return
    if (this.deviceGenerations.get(state.deviceId) !== generation) return
    state.currentFilePath = `${dir}/${fileName}`
    state.fileWriter = fs.createWriteStream(state.currentFilePath)
    state.segmentStartTime = Date.now()
  }

  private async uploadSegment(deviceId: string, filePath: string, capturedAt: number, generation?: number): Promise<void> {
    try {
      if (generation !== undefined && this.deviceGenerations.get(deviceId) !== generation) {
        await unlink(filePath).catch(() => {})
        return
      }
      if (generation !== undefined) {
        const current = this.streams.get(deviceId)
        if (current && current.generation !== generation) {
          await unlink(filePath).catch(() => {})
          return
        }
      }
      const stats = await stat(filePath)
      const fileName = path.basename(filePath)
      const s3Path = `${deviceId}/stream/${fileName}`

      const buffer = await readFile(filePath)
      await uploadFile(RECORDINGS_BUCKET, s3Path, buffer, 'video/h264', { publicRead: false })

      const convex = useConvex()
      await convex.mutation(api.streams.recordStreamSegment, {
        deviceId,
        fileName,
        path: s3Path,
        size: stats.size,
        durationMs: Date.now() - capturedAt,
        capturedAt,
        deviceKey: readDeviceKey(),
      })

      await unlink(filePath)
    } catch (err) {
      console.error(`[StreamManager] Failed to upload segment for ${deviceId}:`, err)
    }
  }

  disconnect(deviceId: string, keepState = false): void {
    const state = this.streams.get(deviceId)
    if (!state) return

    if (state.segmentTimer) {
      clearInterval(state.segmentTimer)
      state.segmentTimer = null
    }
    if (state.reconnectTimer) {
      clearTimeout(state.reconnectTimer)
      state.reconnectTimer = null
    }

    if (state.fileWriter && state.currentFilePath) {
      const filePath = state.currentFilePath
      const segmentStart = state.segmentStartTime
      state.currentFilePath = null
      const promise = (async () => {
        await this.closeWriter(state)
        await this.uploadSegment(deviceId, filePath, segmentStart)
      })()
      this.trackUpload(promise)
    }

    const deviceViewers = this.viewers.get(deviceId)
    if (deviceViewers) {
      for (const peer of deviceViewers) {
        try { peer.close(4001, 'Stream ended') } catch { /* empty */ }
      }
      this.viewers.delete(deviceId)
    }

    if (state.tcpSocket) {
      state.tcpSocket.destroy()
      state.tcpSocket = null
    }

    if (!keepState) {
      this.streams.delete(deviceId)
    }
  }

  async flush(timeoutMs = 30_000): Promise<void> {
    const promises = Array.from(this.pendingUploads)
    if (promises.length === 0) return
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Upload flush timeout')), timeoutMs),
    )
    await Promise.race([Promise.allSettled(promises), timeout])
  }
}

export const streamManager = new StreamManager()
