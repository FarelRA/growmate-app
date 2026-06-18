import { getAuthUserId } from '@convex-dev/auth/server'
import type { QueryCtx, MutationCtx } from './_generated/server'

export async function getCurrentUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx)
  if (!userId) {
    return null
  }

  return await ctx.db.get(userId)
}

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUser(ctx)
  if (!user) {
    throw new Error('Authentication required')
  }
  return user
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx)
  if (user.role !== 'admin') {
    throw new Error('Admin access required')
  }
  return user
}

// ============================================
// SENSOR COMPUTATION HELPERS
// ============================================

export type SensorKind = 'soil' | 'light' | 'temperature' | 'air' | 'water'
export type SensorStatus = 'low' | 'optimal' | 'high'
export type SensorRange = { min: number; max: number }
export type PlantSensorProfile = Record<SensorKind, SensorRange>

export const defaultPlantSensorProfile: PlantSensorProfile = {
  soil: { min: 30, max: 80 },
  light: { min: 30, max: 80 },
  temperature: { min: 18, max: 28 },
  air: { min: 40, max: 70 },
  water: { min: 20, max: 90 },
}

export function normalizePlantSensorProfile(
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): PlantSensorProfile {
  function normalizeRange(kind: SensorKind): SensorRange {
    const base = defaultPlantSensorProfile[kind]
    const rawMin = profile?.[kind]?.min ?? base.min
    const rawMax = profile?.[kind]?.max ?? base.max
    return {
      min: Math.min(rawMin, rawMax),
      max: Math.max(rawMin, rawMax),
    }
  }

  return {
    soil: normalizeRange('soil'),
    light: normalizeRange('light'),
    temperature: normalizeRange('temperature'),
    air: normalizeRange('air'),
    water: normalizeRange('water'),
  }
}

export function getSensorRange(
  kind: SensorKind,
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): SensorRange {
  return normalizePlantSensorProfile(profile)[kind]
}

/**
 * Get sensor status from raw value
 */
export function getSensorStatus(
  kind: SensorKind,
  value: number,
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): SensorStatus {
  const range = getSensorRange(kind, profile)
  if (value < range.min) return 'low'
  if (value > range.max) return 'high'
  return 'optimal'
}

/**
 * Get sensor target message from status
 */
export function getSensorTarget(
  kind: SensorKind,
  value: number,
  status: SensorStatus,
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): string {
  const range = getSensorRange(kind, profile)
  if (status === 'optimal') {
    switch (kind) {
      case 'soil':
        return `✓ Ideal ${range.min}-${range.max}%`
      case 'light':
        return `✓ Ideal ${range.min}-${range.max}%`
      case 'temperature':
        return `✓ Ideal ${range.min}-${range.max}C`
      case 'air':
        return `✓ Ideal ${range.min}-${range.max}%`
      case 'water':
        return `✓ Ideal ${range.min}-${range.max}%`
    }
  }

  if (status === 'low') {
    switch (kind) {
      case 'soil':
        return `↑ Target min ${range.min}%`
      case 'light':
        return `↑ Target min ${range.min}%`
      case 'temperature':
        return `↑ Target min ${range.min}C`
      case 'air':
        return `↑ Target min ${range.min}%`
      case 'water':
        return `↑ Isi ulang ke atas ${range.min}%`
    }
  }

  // status === 'high'
  switch (kind) {
    case 'soil':
      return `↓ Target max ${range.max}%`
    case 'light':
      return `↓ Target max ${range.max}%`
    case 'temperature':
      return `↓ Target max ${range.max}C`
    case 'air':
      return `↓ Target max ${range.max}%`
    case 'water':
      return `↓ Target max ${range.max}%`
  }
}

/**
 * Get sensor label from kind
 */
export function getSensorLabel(kind: SensorKind): string {
  switch (kind) {
    case 'soil':
      return 'Kelembapan Tanah'
    case 'light':
      return 'Intensitas Cahaya'
    case 'temperature':
      return 'Suhu'
    case 'air':
      return 'Kelembapan Udara'
    case 'water':
      return 'Level Air'
  }
}

/**
 * Get sensor accent color from kind
 */
export function getSensorAccent(kind: SensorKind): string {
  switch (kind) {
    case 'soil':
      return 'earth'
    case 'light':
      return 'sun'
    case 'temperature':
      return 'warm'
    case 'air':
      return 'air'
    case 'water':
      return 'water'
  }
}

/**
 * Get sensor sort order
 */
export function getSensorSort(kind: SensorKind): number {
  switch (kind) {
    case 'soil':
      return 1
    case 'light':
      return 2
    case 'temperature':
      return 3
    case 'air':
      return 4
    case 'water':
      return 5
    default:
      return 99
  }
}

// ============================================
// PLANT HEALTH COMPUTATION
// ============================================

export type PlantHealth = 'excellent' | 'good' | 'fair' | 'poor'

interface SensorData {
  kind: SensorKind
  value: number
}

/**
 * Compute plant health from sensor data
 */
export function computePlantHealth(
  sensors: SensorData[],
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): PlantHealth {
  const score = computePlantHealthScore(sensors, profile)
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

/**
 * Compute plant health score (0-100)
 */
export function computePlantHealthScore(
  sensors: SensorData[],
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): number {
  if (sensors.length === 0) return 0

  const sensorScores = sensors.map((s) => {
    const status = getSensorStatus(s.kind, s.value, profile)
    return status === 'optimal' ? 100 : 50
  })

  return Math.round(sensorScores.reduce((a, b) => a + b, 0) / sensorScores.length)
}

// ============================================
// DEVICE HELPERS
// ============================================

/**
 * Check if device is online (last seen < 5 minutes)
 */
export function isDeviceOnline(lastSeen: number): boolean {
  const fiveMinutes = 5 * 60 * 1000
  return Date.now() - lastSeen < fiveMinutes
}

/**
 * Compute water reservoir days remaining
 */
export function computeWaterReservoirDays(
  waterLevel: number, // 0-100%
  dailyUsage: number = 5, // liters per day
): number {
  const reservoirCapacity = 60 // liters
  const currentLiters = (waterLevel / 100) * reservoirCapacity
  return Math.floor(currentLiters / dailyUsage)
}

// ============================================
// TIME FORMATTING HELPERS
// ============================================

/**
 * Format timestamp as "10:24 AM"
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format timestamp as relative time "2 hours ago"
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit yang lalu`
  if (hours < 24) return `${hours} jam yang lalu`
  if (days === 1) return 'Kemarin'
  if (days < 7) return `${days} hari yang lalu`

  return new Date(timestamp).toLocaleDateString('id-ID', {
    month: 'short',
    day: 'numeric',
  })
}

// ============================================
// ALERT GENERATION
// ============================================

export interface Alert {
  type: 'critical' | 'warning' | 'info'
  message: string
  sensorKind?: SensorKind
}

/**
 * Generate alerts based on sensor data and device status
 */
export function generateAlerts(
  sensors: SensorData[],
  device: { lastSeen: number; autoWatering: boolean } | null,
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): Alert[] {
  const alerts: Alert[] = []

  // Check device online status
  if (device && !isDeviceOnline(device.lastSeen)) {
    alerts.push({
      type: 'critical',
      message: 'Perangkat offline - periksa koneksi',
    })
  }

  // Check sensor values
  for (const sensor of sensors) {
    const status = getSensorStatus(sensor.kind, sensor.value, profile)

    if (sensor.kind === 'soil' && status === 'low') {
      alerts.push({
        type: 'warning',
        message: 'Kelembapan tanah rendah - perlu penyiraman',
        sensorKind: 'soil',
      })
    }

    if (sensor.kind === 'water' && sensor.value < getSensorRange('water', profile).min) {
      alerts.push({
        type: 'critical',
        message: 'Reservoir air rendah - segera isi ulang',
        sensorKind: 'water',
      })
    }

    if (sensor.kind === 'temperature' && status === 'high') {
      alerts.push({
        type: 'warning',
        message: 'Suhu tinggi - tingkatkan ventilasi',
        sensorKind: 'temperature',
      })
    }

    if (sensor.kind === 'temperature' && status === 'low') {
      alerts.push({
        type: 'warning',
        message: 'Suhu rendah - tambahkan pemanas',
        sensorKind: 'temperature',
      })
    }
  }

  return alerts
}

// ============================================
// USER POINTS HELPERS
// ============================================

export const ACTIVITY_POINTS = {
  post_created: 50,
  comment_created: 10,
  post_liked: 5,
  plant_added: 25,
  watering_completed: 5,
} as const

/**
 * Get points for an activity type
 */
export function getActivityPoints(activityType: keyof typeof ACTIVITY_POINTS): number {
  return ACTIVITY_POINTS[activityType]
}
