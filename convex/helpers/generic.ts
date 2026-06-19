import type { QueryCtx, MutationCtx, SensorKind } from '../types'
import type { Id } from '../_generated/dataModel'
import { ADC_RAW_MAX, ADC_RAW_MIN, plantStagePoints } from '../types'
import type { PlantStageValue } from '../types'

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

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

export function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value))
}

export function normalizeRawSensorValue(kind: SensorKind, raw: number) {
  const clampedRaw = Math.max(ADC_RAW_MIN, Math.min(ADC_RAW_MAX, raw))
  const range = ADC_RAW_MAX - ADC_RAW_MIN
  if (range === 0) return 0

  switch (kind) {
    case 'soil':
    case 'light':
      return clampPercent(Math.round(((ADC_RAW_MAX - clampedRaw) / range) * 100))
    case 'water':
      return clampPercent(Math.round((clampedRaw / range) * 100))
    default:
      return clampedRaw
  }
}

export function formatEventValue(value: string | number | boolean | null | undefined) {
  if (value === undefined || value === null) return 'unset'
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  return String(value)
}

export function getAutomationModeLabel(device: { autoWatering: boolean; autoLighting: boolean }) {
  if (device.autoWatering && device.autoLighting) return 'Otomasi penuh'
  if (device.autoWatering || device.autoLighting) return 'Otomasi sebagian'
  return 'Kontrol manual'
}

export function isDeviceOnline(lastSeen: number): boolean {
  const fiveMinutes = 5 * 60 * 1000
  return Date.now() - lastSeen < fiveMinutes
}

export const ACTIVITY_POINTS = {
  post_created: 50,
  comment_created: 10,
  post_liked: 5,
  plant_added: 25,
  watering_completed: 5,
} as const

export function getActivityPoints(activityType: keyof typeof ACTIVITY_POINTS): number {
  return ACTIVITY_POINTS[activityType]
}

export async function addUserActivity(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'>
    activityType: keyof typeof ACTIVITY_POINTS
    relatedId?: string
    createdAt: number
  },
) {
  const points = getActivityPoints(args.activityType)
  await ctx.db.insert('userActivities', {
    userId: args.userId,
    activityType: args.activityType,
    points,
    relatedId: args.relatedId,
    createdAt: args.createdAt,
  })
  const user = await ctx.db.get(args.userId)
  if (user) {
    await ctx.db.patch(args.userId, {
      points: (user.points ?? 0) + points,
      updatedAt: args.createdAt,
    })
  }
}

export async function computeUserPlantPoints(ctx: QueryCtx, userId: Id<'users'>) {
  const devices = await ctx.db
    .query('devices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .take(32)
  let total = 0

  for (const device of devices) {
    const plants = await ctx.db
      .query('plants')
      .withIndex('by_device', (q) => q.eq('deviceId', device._id))
      .take(32)
    for (const plant of plants) {
      total += plantStagePoints[plant.growthStage as PlantStageValue] ?? 0
    }
  }

  return total
}

export function formatCurrencyIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}
