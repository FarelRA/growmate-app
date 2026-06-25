import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { api } from '~~/convex/_generated/api'
import { useConvex } from './convex'
import { RECORDINGS_BUCKET, uploadFile } from './storage'

const SEGMENT_DIR = process.env.GROWMATE_SEGMENT_DIR ?? '/var/growmate/segments'
const SEGMENT_INTERVAL_MS = 60_000
const RECONNECT_DELAY_MS = 5_000

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
}
class StreamManager {
  private streams = new Map<string, StreamState>()
  private viewers = new Map<string, Set<PeerLike>>()
  private peerDeviceMap = new WeakMap<object, string>()
  private pendingUploads = new Set<Promise<void>>()

  async connect(deviceId: string, host: string, port: number): Promise<void> {
    const existing = this.streams.get(deviceId)
    if (existing) this.disconnect(deviceId)

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
    }

    this.streams.set(deviceId, state)
    this.connectSocket(state)
  }

  private connectSocket(state: StreamState): void {
    const { deviceId, host, port } = state
    const socket = net.createConnection(port, host, () => {
      if (state.reconnectTimer) {
        clearTimeout(state.reconnectTimer)
        state.reconnectTimer = null
      }
    })

    state.tcpSocket = socket

    this.rotateSegment(state)

    state.segmentTimer = setInterval(() => {
      this.rotateSegment(state)
    }, SEGMENT_INTERVAL_MS)

    let nalBuffer = Buffer.alloc(0)

    socket.on('data', (chunk: Buffer) => {
      nalBuffer = Buffer.concat([nalBuffer, chunk])

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
        const nalType = nalUnit.at(0)! & 0x1F
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
      this.disconnect(deviceId, true)

      state.reconnectTimer = setTimeout(() => {
        if (this.streams.has(deviceId)) {
          this.connectSocket(state)
        }
      }, RECONNECT_DELAY_MS)
    })

    socket.on('error', () => {
      socket.destroy()
    })
  }

  private processNalUnit(state: StreamState, nalUnit: Buffer, nalType: number, timestamp: number) {
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

  private rotateSegment(state: StreamState): void {
    if (state.fileWriter && state.currentFilePath) {
      state.fileWriter.end()
      const promise = this.uploadSegment(state.deviceId, state.currentFilePath, state.segmentStartTime)
      this.pendingUploads.add(promise)
      promise.finally(() => this.pendingUploads.delete(promise))
    }

    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const fileName = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.h264`
    const dir = `${SEGMENT_DIR}/${state.deviceId}`
    fs.mkdirSync(dir, { recursive: true })
    state.currentFilePath = `${dir}/${fileName}`
    state.fileWriter = fs.createWriteStream(state.currentFilePath)
    state.segmentStartTime = Date.now()
  }

  private async uploadSegment(deviceId: string, filePath: string, capturedAt: number): Promise<void> {
    try {
      const stats = fs.statSync(filePath)
      const fileName = path.basename(filePath)
      const s3Path = `${deviceId}/stream/${fileName}`

      const buffer = fs.readFileSync(filePath)
      await uploadFile(RECORDINGS_BUCKET, s3Path, buffer, 'video/h264')

      const convex = useConvex()
      await convex.mutation(api.streams.recordStreamSegment, {
        deviceId,
        fileName,
        path: s3Path,
        size: stats.size,
        durationMs: Date.now() - capturedAt,
        capturedAt,
      })

      fs.unlinkSync(filePath)
    } catch (err) {
      console.error(`[StreamManager] Failed to upload segment for ${deviceId}:`, err)
    }
  }

  disconnect(deviceId: string, keepState = false): void {
    const state = this.streams.get(deviceId)
    if (!state) return

    if (state.segmentTimer) clearInterval(state.segmentTimer)
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer)

    if (state.fileWriter && state.currentFilePath) {
      state.fileWriter.end()
      const promise = this.uploadSegment(deviceId, state.currentFilePath, state.segmentStartTime)
      this.pendingUploads.add(promise)
      promise.finally(() => this.pendingUploads.delete(promise))
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
