// Tech live-video relay (src/video_stream.py wire format + docs 06-api/08 §10).
// The device dials out with a chunked
// `POST multipart/x-mixed-replace; boundary=frame` carrying one part per
// frame (`--frame` boundaries, per-part `X-Frame-Seq`, closing `--frame--`).
// Browsers render the fan-out URL in a plain <img> tag.

export const VIDEO_BOUNDARY = 'frame'
export const VIDEO_MAX_SESSION_SEC = 600

interface LatestFrame {
  jpg: Buffer
  seq: number
  videoId: string
  at: number
}

const latestByDevice = new Map<string, LatestFrame>()
const viewersByDevice = new Map<string, Set<(frame: LatestFrame) => void>>()
const countersByDevice = new Map<string, { frames: number; bytes: number }>()

export function resetVideoLiveState() {
  latestByDevice.clear()
  viewersByDevice.clear()
  countersByDevice.clear()
}

/** Scan a byte stream for complete JPEGs (SOI FFD8 … EOI FFD9). */
export function extractJpegs(chunk: Buffer): Buffer[] {
  const out: Buffer[] = []
  let start = 0
  while (true) {
    const s = chunk.indexOf(Buffer.from([0xff, 0xd8]), start)
    if (s < 0) break
    const e = chunk.indexOf(Buffer.from([0xff, 0xd9]), s + 2)
    if (e < 0) break
    out.push(chunk.subarray(s, e + 2))
    start = e + 2
  }
  return out
}

function parsePartSeq(part: Buffer, fallback: number): number {
  const headEnd = part.indexOf(Buffer.from([0xff, 0xd8]))
  const head = headEnd >= 0 ? part.subarray(0, headEnd).toString('latin1') : ''
  const match = head.match(/X-Frame-Seq:\s*(\d+)/i)
  if (match?.[1]) {
    const seq = Number.parseInt(match[1], 10)
    if (Number.isInteger(seq) && seq >= 0) return seq
  }
  return fallback
}

export function ingestVideoBytes(
  deviceId: string,
  videoId: string,
  chunk: Buffer,
  baseSeq: number,
): { frames: number; nextSeq: number } {
  // Split on part boundaries when present; otherwise scan the raw chunk.
  const parts = chunk.toString('latin1').includes(`--${VIDEO_BOUNDARY}`)
    ? chunk.toString('latin1').split(`--${VIDEO_BOUNDARY}`).map((s) => Buffer.from(s, 'latin1'))
    : [chunk]
  let seq = baseSeq
  let frames = 0
  for (const part of parts) {
    for (const jpg of extractJpegs(part)) {
      const frameSeq = parsePartSeq(part, seq)
      const frame: LatestFrame = { jpg: Buffer.from(jpg), seq: frameSeq, videoId, at: Date.now() }
      latestByDevice.set(deviceId, frame)
      const counter = countersByDevice.get(deviceId) ?? { frames: 0, bytes: 0 }
      counter.frames += 1
      counter.bytes += jpg.length
      countersByDevice.set(deviceId, counter)
      const viewers = viewersByDevice.get(deviceId)
      if (viewers) {
        for (const push of viewers) {
          try {
            push(frame)
          } catch {
            // A slow viewer must never break ingest.
          }
        }
      }
      seq = frameSeq + 1
      frames += 1
    }
  }
  return { frames, nextSeq: seq }
}

export function getLatestFrame(deviceId: string): LatestFrame | null {
  return latestByDevice.get(deviceId) ?? null
}

export function getStreamCounters(deviceId: string): { frames: number; bytes: number } {
  return countersByDevice.get(deviceId) ?? { frames: 0, bytes: 0 }
}

export function subscribeFrames(deviceId: string, push: (frame: LatestFrame) => void): () => void {
  let set = viewersByDevice.get(deviceId)
  if (!set) {
    set = new Set()
    viewersByDevice.set(deviceId, set)
  }
  set.add(push)
  return () => {
    set!.delete(push)
  }
}
