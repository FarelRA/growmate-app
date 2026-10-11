import type { H3Event, EventHandlerRequest } from 'h3'

// Firmware-exact device protocol shared by /api/v1/* and /v1/* routes.
// Sources of truth:
// - pods: src/api_client.c (envelope), src/api_parse.c (response parsing),
//   docs/06-api.md + docs/08-server-changes.md
// - tech: src/api_client.py (envelope + parse_response), src/video_stream.py
//   (live ingest wire format), docs/06-api.md + docs/08-server-changes.md

export const DEVICE_SENSOR_KINDS = [
  'soil',
  'light',
  'water',
  'temperature',
  'air',
  'current',
] as const

export type DeviceSensorKind = (typeof DEVICE_SENSOR_KINDS)[number]

export const PODS_RAW_MAX = 4095
export const TECH_RAW_MAX = 32767
export const MAX_SNAPSHOT_COMMANDS_BYTES = 3072

// Rate-limit policy per docs/08-server-changes.md §7 (both families):
// sensors ≤ effective interval (burst ~3); camera ≤ 1 frame per 5 min.
// Limits key on the authenticated deviceId, never the IP.
const SENSOR_BURST = 3
const SENSOR_WINDOW_MS = 15_000
const CAMERA_MIN_GAP_MS = 5 * 60 * 1000

const sensorHits = new Map<string, number[]>()
const cameraHits = new Map<string, number>()

export function resetDeviceRateLimits() {
  sensorHits.clear()
  cameraHits.clear()
}

function retryAfterSec(ms: number): number {
  return Math.max(1, Math.ceil(ms / 1000))
}

/** 429 when the device posts sensors faster than burst allowance. */
export function checkSensorRateLimit(event: H3Event<EventHandlerRequest>, deviceId: string) {
  const now = Date.now()
  const hits = (sensorHits.get(deviceId) ?? []).filter((t) => now - t < SENSOR_WINDOW_MS)
  if (hits.length >= SENSOR_BURST) {
    const waitMs = SENSOR_WINDOW_MS - (now - hits[0]!)
    const retryAfter = retryAfterSec(waitMs)
    setHeader(event, 'Retry-After', String(retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limited: retry after ${retryAfter}s`,
    })
  }
  hits.push(now)
  sensorHits.set(deviceId, hits)
}

/** 429 when the device posts camera frames faster than 1 per 5 min. */
export function checkCameraRateLimit(event: H3Event<EventHandlerRequest>, deviceId: string) {
  const now = Date.now()
  const last = cameraHits.get(deviceId) ?? 0
  if (now - last < CAMERA_MIN_GAP_MS) {
    const retryAfter = retryAfterSec(CAMERA_MIN_GAP_MS - (now - last))
    setHeader(event, 'Retry-After', String(retryAfter))
    throw createError({
      statusCode: 429,
      statusMessage: `Rate limited: retry after ${retryAfter}s`,
    })
  }
  cameraHits.set(deviceId, now)
}

export interface DeviceSensorEntry {
  kind: string
  unit: string
  raw?: unknown
  value?: unknown
}

export interface DeviceEnvelope {
  deviceId: string
  hardwareId?: string
  firmwareVersion?: string
  variant?: string
  snapshotId?: string
  ageMs?: number
  appliedConfigRev?: number
  sensors: DeviceSensorEntry[]
  acceptedCommandIds: string[]
  currentState?: Record<string, unknown>
  health?: Record<string, unknown>
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function bad(message: string): never {
  throw createError({ statusCode: 400, statusMessage: message })
}

/**
 * Validate the firmware sensor envelope. Accepts the exact shapes both
 * firmwares send: raw-only analog entries (no `value`), native DHT floats
 * (no `raw`), the tech `current` kind, tech `variant`, and empty `sensors[]`
 * (server must accept, never 400). Legacy value-bearing entries keep the
 * previous range checks so existing app clients are unaffected.
 */
export function validateDeviceEnvelope(body: unknown): DeviceEnvelope {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    bad('envelope must be object')
  }
  const env = body as Record<string, unknown>

  const deviceId = env.deviceId
  if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    bad('deviceId is required')
  }

  const variant = env.variant
  if (variant !== undefined && typeof variant !== 'string') {
    bad('variant must be string')
  }
  const rawMax = variant !== undefined ? TECH_RAW_MAX : PODS_RAW_MAX

  const sensors = env.sensors
  if (sensors !== undefined && !Array.isArray(sensors)) {
    bad('sensors must be array')
  }
  const list: DeviceSensorEntry[] = (sensors ?? []) as DeviceSensorEntry[]
  if (list.length > 8) {
    bad('Too many sensors (max 8)')
  }
  for (const entry of list) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      bad('Each sensor must be object')
    }
    if (!(DEVICE_SENSOR_KINDS as readonly string[]).includes(entry.kind)) {
      bad(`Unknown sensor kind: ${String(entry.kind)}`)
    }
    if (typeof entry.unit !== 'string' || entry.unit.length === 0) {
      bad('Each sensor must have unit')
    }
    const hasRaw = entry.raw !== undefined
    const hasValue = entry.value !== undefined
    const analog =
      entry.kind === 'soil' || entry.kind === 'light' || entry.kind === 'water' || entry.kind === 'current'
    if (analog) {
      // RAW-ONLY analog entries (no percent math on device, 06-api).
      if (!hasRaw) bad(`${entry.kind}: MISSING raw (must be RAW-only)`)
      if (!isInt(entry.raw) || (entry.raw as number) < 0 || (entry.raw as number) > rawMax) {
        bad(`Raw value for ${entry.kind} must be between 0-${rawMax}`)
      }
    } else {
      // temperature / air: native DHT floats, no `raw`.
      if (!hasValue) bad(`${entry.kind}: MISSING value (DHT is native floats)`)
      if (!isFiniteNumber(entry.value)) {
        bad(`Sensor value for ${entry.kind} must be number`)
      }
    }
  }

  const accepted = env.acceptedCommandIds ?? []
  if (!Array.isArray(accepted) || accepted.some((id) => typeof id !== 'string')) {
    bad('acceptedCommandIds must be string[]')
  }

  if (env.ageMs !== undefined && (!isFiniteNumber(env.ageMs) || (env.ageMs as number) < 0)) {
    bad('ageMs must be >= 0')
  }
  if (env.appliedConfigRev !== undefined && (!isInt(env.appliedConfigRev) || (env.appliedConfigRev as number) < 0)) {
    bad('appliedConfigRev must be >= 0')
  }
  if (env.snapshotId !== undefined && typeof env.snapshotId !== 'string') {
    bad('snapshotId must be string')
  }
  if (env.hardwareId !== undefined && typeof env.hardwareId !== 'string') {
    bad('hardwareId must be string')
  }
  if (env.firmwareVersion !== undefined && typeof env.firmwareVersion !== 'string') {
    bad('firmwareVersion must be string')
  }
  if (env.currentState !== undefined && (typeof env.currentState !== 'object' || env.currentState === null || Array.isArray(env.currentState))) {
    bad('currentState must be object')
  }
  if (env.health !== undefined && (typeof env.health !== 'object' || env.health === null || Array.isArray(env.health))) {
    bad('health must be object')
  }

  return {
    deviceId: (deviceId as string).trim(),
    hardwareId: typeof env.hardwareId === 'string' ? env.hardwareId : undefined,
    firmwareVersion: typeof env.firmwareVersion === 'string' ? env.firmwareVersion : undefined,
    variant: typeof variant === 'string' ? variant : undefined,
    snapshotId: typeof env.snapshotId === 'string' ? env.snapshotId : undefined,
    ageMs: isFiniteNumber(env.ageMs) ? (env.ageMs as number) : undefined,
    appliedConfigRev: isInt(env.appliedConfigRev) ? (env.appliedConfigRev as number) : undefined,
    sensors: list,
    acceptedCommandIds: accepted as string[],
    currentState: (env.currentState as Record<string, unknown>) ?? undefined,
    health: (env.health as Record<string, unknown>) ?? undefined,
  }
}

/** Clamp absurd ageMs (> interval×3, floor 45s) per 08-server-changes §4. */
export function clampAgeMs(ageMs: number, effectiveIntervalSec: number): number {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0
  const cap = Math.max(45_000, effectiveIntervalSec * 3 * 1000)
  return Math.min(ageMs, cap)
}

/** Keep sensor responses under the ~3KB device buffer limit. */
export function fitResponseBytes<T extends { commands: unknown[] }>(body: T): T {
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') <= MAX_SNAPSHOT_COMMANDS_BYTES) {
    return body
  }
  return { ...body, commands: (body.commands as unknown[]).slice(0, 1) }
}
