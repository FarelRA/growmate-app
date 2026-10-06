import type { WriteStream } from 'node:fs'
import { mkdir, stat, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { api } from '~~/convex/_generated/api'
import { useConvex } from '../convex'
import { RECORDINGS_BUCKET, uploadFile } from '../storage'

/** Segment spool dir; read lazily so test harnesses can set the env var per case. */
export function getSegmentDir(): string {
  return process.env.GROWMATE_SEGMENT_DIR ?? '/var/growmate/segments'
}

export function buildSegmentFileName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.h264`
}

export function segmentFilePath(deviceId: string, now = new Date()): string {
  return `${getSegmentDir()}/${deviceId}/${buildSegmentFileName(now)}`
}

export async function ensureSegmentDir(deviceId: string): Promise<string> {
  const dir = `${getSegmentDir()}/${deviceId}`
  await mkdir(dir, { recursive: true })
  return dir
}

const NAL_START_CODE = Buffer.from([0x00, 0x00, 0x00, 0x01])

/** Append one framed NAL unit (with start code) to the open segment file. */
export function appendNalUnit(writer: WriteStream | null, nalUnit: Buffer): void {
  if (!writer) return
  writer.write(Buffer.concat([NAL_START_CODE, nalUnit]))
}

/**
 * End the writer and wait for flush, giving up after `timeoutMs` so a stuck
 * filesystem never blocks rotation/disconnect.
 */
export async function closeFileWriter(
  writer: WriteStream | null,
  timeoutMs = 5_000,
): Promise<void> {
  if (!writer) return
  await Promise.race([
    new Promise<void>((resolve) => {
      writer.once('finish', () => resolve())
      writer.once('error', () => resolve())
      writer.end()
    }),
    new Promise<void>((resolve) => setTimeout(() => resolve(), timeoutMs)),
  ])
}

export interface SegmentUpload {
  deviceId: string
  filePath: string
  capturedAt: number
  deviceKey: string
}

/**
 * Upload a closed segment file to object storage, record it in Convex, and
 * delete the local spool file. Throws on failure — the caller logs.
 */
export async function uploadSegmentFile(upload: SegmentUpload): Promise<void> {
  const { deviceId, filePath, capturedAt, deviceKey } = upload
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
    deviceKey,
  })

  await unlink(filePath)
}

/** Best-effort local cleanup for segments orphaned by stale generations. */
export async function discardSegmentFile(filePath: string): Promise<void> {
  await unlink(filePath).catch(() => {})
}
