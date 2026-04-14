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

/**
 * Get sensor status from raw value
 */
export function getSensorStatus(kind: SensorKind, value: number): SensorStatus {
  switch (kind) {
    case 'soil':
      return value < 30 ? 'low' : value > 80 ? 'high' : 'optimal'
    case 'light':
      return value < 30 ? 'low' : value > 80 ? 'high' : 'optimal'
    case 'temperature':
      return value < 18 ? 'low' : value > 28 ? 'high' : 'optimal'
    case 'air':
      return value < 40 ? 'low' : value > 70 ? 'high' : 'optimal'
    case 'water':
      return value < 20 ? 'low' : value > 90 ? 'high' : 'optimal'
    default:
      return 'optimal'
  }
}

/**
 * Get sensor target message from status
 */
export function getSensorTarget(kind: SensorKind, value: number, status: SensorStatus): string {
  if (status === 'optimal') {
    switch (kind) {
      case 'soil': return '✓ Perfect moisture'
      case 'light': return '✓ Good lighting'
      case 'temperature': return '✓ Perfect temp'
      case 'air': return '✓ Good humidity'
      case 'water': return '✓ Sufficient'
    }
  }
  
  if (status === 'low') {
    switch (kind) {
      case 'soil': return '↑ Water needed'
      case 'light': return '↑ More light'
      case 'temperature': return '↑ Too cold'
      case 'air': return '↑ Too dry'
      case 'water': return '↑ Refill needed'
    }
  }
  
  // status === 'high'
  switch (kind) {
    case 'soil': return '↓ Too wet'
    case 'light': return '↓ Too bright'
    case 'temperature': return '↓ Too hot'
    case 'air': return '↓ Too humid'
    case 'water': return '✓ Full'
  }
}

/**
 * Get sensor label from kind
 */
export function getSensorLabel(kind: SensorKind): string {
  switch (kind) {
    case 'soil': return 'Soil Moisture'
    case 'light': return 'Light Intensity'
    case 'temperature': return 'Temperature'
    case 'air': return 'Humidity'
    case 'water': return 'Water Level'
  }
}

/**
 * Get sensor accent color from kind
 */
export function getSensorAccent(kind: SensorKind): string {
  switch (kind) {
    case 'soil': return 'earth'
    case 'light': return 'sun'
    case 'temperature': return 'warm'
    case 'air': return 'air'
    case 'water': return 'water'
  }
}

/**
 * Get sensor sort order
 */
export function getSensorSort(kind: SensorKind): number {
  switch (kind) {
    case 'soil': return 1
    case 'light': return 2
    case 'temperature': return 3
    case 'air': return 4
    case 'water': return 5
    default: return 99
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
export function computePlantHealth(sensors: SensorData[]): PlantHealth {
  const score = computePlantHealthScore(sensors)
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  return 'poor'
}

/**
 * Compute plant health score (0-100)
 */
export function computePlantHealthScore(sensors: SensorData[]): number {
  if (sensors.length === 0) return 0
  
  const sensorScores = sensors.map(s => {
    const status = getSensorStatus(s.kind, s.value)
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
  return (Date.now() - lastSeen) < fiveMinutes
}

/**
 * Compute water reservoir days remaining
 */
export function computeWaterReservoirDays(
  waterLevel: number, // 0-100%
  dailyUsage: number = 5 // liters per day
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
  return new Date(timestamp).toLocaleTimeString('en-US', {
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
  
  if (seconds < 60) return 'Just now'
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  
  return new Date(timestamp).toLocaleDateString('en-US', {
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
  device: { lastSeen: number; autoWatering: boolean } | null
): Alert[] {
  const alerts: Alert[] = []
  
  // Check device online status
  if (device && !isDeviceOnline(device.lastSeen)) {
    alerts.push({
      type: 'critical',
      message: 'Device offline - check connection',
    })
  }
  
  // Check sensor values
  for (const sensor of sensors) {
    const status = getSensorStatus(sensor.kind, sensor.value)
    
    if (sensor.kind === 'soil' && status === 'low') {
      alerts.push({
        type: 'warning',
        message: 'Soil moisture low - watering needed',
        sensorKind: 'soil',
      })
    }
    
    if (sensor.kind === 'water' && sensor.value < 20) {
      alerts.push({
        type: 'critical',
        message: 'Water reservoir low - refill soon',
        sensorKind: 'water',
      })
    }
    
    if (sensor.kind === 'temperature' && status === 'high') {
      alerts.push({
        type: 'warning',
        message: 'Temperature high - improve ventilation',
        sensorKind: 'temperature',
      })
    }
    
    if (sensor.kind === 'temperature' && status === 'low') {
      alerts.push({
        type: 'warning',
        message: 'Temperature low - add heating',
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
