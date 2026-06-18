import { getAuthUserId } from '@convex-dev/auth/server'
import type { QueryCtx, MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import type {
  Ctx, SensorKind, SensorStatus, SensorRange, PlantSensorProfile, PlantHealth,
  GrowEventSource, GrowEventEntity, GrowEventType, DeviceDoc, PlantDoc, DeviceQueuedCommands,
  QueuedDeviceAction, LifecycleProfile, PlantStageValue, MetricPoint,
  BlogPostDoc, ProductDoc,
} from './types'
import {
  DEFAULT_WATERING_THRESHOLD, DEFAULT_LIGHTING_THRESHOLD,
  DEFAULT_WATERING_DURATION, DEFAULT_WATERING_COOLDOWN, DEFAULT_LIGHTING_HYSTERESIS,
  ADC_RAW_MAX, ADC_RAW_MIN, lifecycleStages, defaultLifecycleProfile, sensorKinds,
  plantStagePoints,
} from './types'
export type { SensorKind, PlantHealth } from './types'

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
    throw new Error('Autentikasi diperlukan')
  }
  return user
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx)
  if (user.role !== 'admin') {
    throw new Error('Akses admin diperlukan')
  }
  return user
}

// ============================================
// SENSOR COMPUTATION HELPERS
// ============================================

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

const alertRules: Array<{
  kind: SensorKind
  status: SensorStatus
  type: Alert['type']
  message: string
}> = [
  { kind: 'soil', status: 'low', type: 'warning', message: 'Kelembapan tanah rendah - perlu penyiraman' },
  { kind: 'water', status: 'low', type: 'critical', message: 'Reservoir air rendah - segera isi ulang' },
  { kind: 'temperature', status: 'high', type: 'warning', message: 'Suhu tinggi - tingkatkan ventilasi' },
  { kind: 'temperature', status: 'low', type: 'warning', message: 'Suhu rendah - tambahkan pemanas' },
  { kind: 'light', status: 'low', type: 'warning', message: 'Cahaya rendah - tambahkan pencahayaan' },
  { kind: 'light', status: 'high', type: 'warning', message: 'Cahaya berlebih - kurangi paparan' },
  { kind: 'air', status: 'low', type: 'warning', message: 'Kelembapan udara rendah - tingkatkan kelembapan' },
  { kind: 'air', status: 'high', type: 'warning', message: 'Kelembapan udara tinggi - tingkatkan ventilasi' },
]

/**
 * Generate alerts based on sensor data and device status
 */
export function generateAlerts(
  sensors: SensorData[],
  device: { lastSeen: number; autoWatering: boolean } | null,
  profile?: Partial<Record<SensorKind, Partial<SensorRange>>> | null,
): Alert[] {
  const alerts: Alert[] = []

  if (device && !isDeviceOnline(device.lastSeen)) {
    alerts.push({
      type: 'critical',
      message: 'Perangkat offline - periksa koneksi',
    })
  }

  for (const sensor of sensors) {
    const status = getSensorStatus(sensor.kind, sensor.value, profile)

    for (const rule of alertRules) {
      if (rule.kind === sensor.kind && rule.status === status) {
        alerts.push({
          type: rule.type,
          message: rule.message,
          sensorKind: rule.kind,
        })
      }
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

// ============================================
// GENERIC UTILITY HELPERS
// ============================================

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

export function getDeviceWateringDuration(device: Pick<DeviceDoc, 'wateringDuration'>) {
  return Number.isFinite(device.wateringDuration)
    ? device.wateringDuration
    : DEFAULT_WATERING_DURATION
}

export function getDeviceWateringCooldown(device: Pick<DeviceDoc, 'wateringCooldown'>) {
  return Number.isFinite(device.wateringCooldown)
    ? device.wateringCooldown
    : DEFAULT_WATERING_COOLDOWN
}

export function getDeviceLightingHysteresis(device: Pick<DeviceDoc, 'lightingHysteresis'>) {
  return Number.isFinite(device.lightingHysteresis)
    ? device.lightingHysteresis
    : DEFAULT_LIGHTING_HYSTERESIS
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

// ============================================
// STORAGE / IMAGE HELPERS
// ============================================

export async function resolveStoredImageUrl(
  ctx: Ctx,
  imageStorageId?: Id<'_storage'> | null,
  fallbackImage?: string | null,
) {
  if (imageStorageId) {
    const storageUrl = await ctx.storage.getUrl(imageStorageId)
    if (storageUrl) return storageUrl
  }
  return fallbackImage ?? null
}

// ============================================
// EVENT RECORDING HELPERS
// ============================================

export async function recordGrowEvent(
  ctx: MutationCtx,
  args: {
    deviceId?: Id<'devices'>
    plantId?: Id<'plants'>
    userId?: Id<'users'>
    source: GrowEventSource
    entityType: GrowEventEntity
    eventType: GrowEventType
    title: string
    detail?: string
    data?: Record<string, string | number | boolean>
    timestamp: number
  },
) {
  await ctx.db.insert('growEvents', args)
}

export async function recordPlantImage(
  ctx: MutationCtx,
  args: {
    plantId?: Id<'plants'>
    deviceId: Id<'devices'>
    imageStorageId: Id<'_storage'>
    source: 'camera' | 'manual'
    capturedAt: number
  },
) {
  await ctx.db.insert('plantImages', args)
}

export async function recordAutomationEvent(
  ctx: MutationCtx,
  args: {
    deviceId: Id<'devices'>
    plantId?: Id<'plants'>
    action:
      | 'pump_enabled'
      | 'pump_disabled'
      | 'light_on'
      | 'light_off'
      | 'manual_pump'
      | 'manual_light'
      | 'schedule_completed'
    soilValue?: number
    lightValue?: number
    threshold?: number
    duration?: number
    timestamp: number
  },
) {
  if (!args.plantId) return
  await ctx.db.insert('automationLogs', {
    deviceId: args.deviceId,
    plantId: args.plantId,
    timestamp: args.timestamp,
    action: args.action,
    soilValue: args.soilValue,
    lightValue: args.lightValue,
    threshold: args.threshold,
    duration: args.duration,
  })
}

// ============================================
// QUERY HELPERS (History, Logs, Messages)
// ============================================

export async function getSensorHistory(ctx: Ctx, plantId: Id<'plants'>, limit = 24) {
  const histories = await Promise.all(
    sensorKinds.map(async (kind) => {
      const readings = await ctx.db
        .query('sensorReadings')
        .withIndex('by_plant_kind_measuredAt', (q) => q.eq('plantId', plantId).eq('kind', kind))
        .order('desc')
        .take(limit)

      return [
        kind,
        readings
          .reverse()
          .map((reading) => ({ value: reading.value, measuredAt: reading.measuredAt })),
      ]
    }),
  )
  return Object.fromEntries(histories) as Record<SensorKind, MetricPoint[]>
}

export async function getPlantImageHistory(ctx: Ctx, plantId: Id<'plants'>, limit = 8) {
  const images = await ctx.db
    .query('plantImages')
    .withIndex('by_plant', (q) => q.eq('plantId', plantId))
    .order('desc')
    .take(limit)

  return await Promise.all(
    images.map(async (image) => ({
      _id: image._id,
      image: await resolveStoredImageUrl(ctx, image.imageStorageId),
      source: image.source,
      capturedAt: image.capturedAt,
      capturedAtLabel: formatTimestamp(image.capturedAt),
    })),
  )
}

export async function getRecentGrowEvents(ctx: Ctx, deviceDocId: Id<'devices'>, limit = 10) {
  const events = await ctx.db
    .query('growEvents')
    .withIndex('by_device_and_timestamp', (q) => q.eq('deviceId', deviceDocId))
    .order('desc')
    .take(limit)

  return events.map((event) => ({
    ...event,
    timestampLabel: formatTimestamp(event.timestamp),
    relativeTime: getRelativeTime(event.timestamp),
  }))
}

export async function getRecentAutomationLogs(ctx: Ctx, plantId: Id<'plants'>, limit = 8) {
  const logs = await ctx.db
    .query('automationLogs')
    .withIndex('by_plant', (q) => q.eq('plantId', plantId))
    .order('desc')
    .take(limit)

  return logs.map((log) => ({
    ...log,
    timestampLabel: formatTimestamp(log.timestamp),
    relativeTime: getRelativeTime(log.timestamp),
  }))
}

export async function getSupportMessages(ctx: Ctx, requestId: Id<'supportRequests'>, limit = 24) {
  const messages = await ctx.db
    .query('supportMessages')
    .withIndex('by_request_and_createdAt', (q) => q.eq('requestId', requestId))
    .order('desc')
    .take(limit)

  return messages.reverse()
}

// ============================================
// PLANT HELPERS
// ============================================

export function normalizeLifecycleProfile(profile?: Partial<LifecycleProfile> | null): LifecycleProfile {
  return {
    seedDormancyDays: profile?.seedDormancyDays ?? defaultLifecycleProfile.seedDormancyDays,
    germinationDays: profile?.germinationDays ?? defaultLifecycleProfile.germinationDays,
    seedlingDevelopmentDays:
      profile?.seedlingDevelopmentDays ?? defaultLifecycleProfile.seedlingDevelopmentDays,
    vegetativeGrowthDays:
      profile?.vegetativeGrowthDays ?? defaultLifecycleProfile.vegetativeGrowthDays,
    floweringReproductionDays:
      profile?.floweringReproductionDays ?? defaultLifecycleProfile.floweringReproductionDays,
    maturitySenescenceDays:
      profile?.maturitySenescenceDays ?? defaultLifecycleProfile.maturitySenescenceDays,
  }
}

export function formatPlantStage(stage: PlantStageValue) {
  return lifecycleStages.find((item) => item.key === stage)?.label ?? stage
}

export function computePlantProgress(
  plant: Pick<PlantDoc, 'growthStage' | 'plantedAt' | 'lifecycleProfile'>,
) {
  const lifecycleProfile = normalizeLifecycleProfile(plant.lifecycleProfile)
  const normalizedStage = plant.growthStage as PlantStageValue
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - plant.plantedAt) / (24 * 60 * 60 * 1000)),
  )

  let offsetDays = 0
  for (const stage of lifecycleStages) {
    if (stage.key === normalizedStage) break
    offsetDays += lifecycleProfile[stage.durationKey as keyof LifecycleProfile]
  }

  const totalDays = (Object.keys(lifecycleProfile) as (keyof LifecycleProfile)[]).reduce(
    (total, key) => total + lifecycleProfile[key],
    0,
  )
  const progressDays = Math.min(offsetDays + elapsedDays, totalDays)

  let cursor = 0
  let activeStage = lifecycleStages[lifecycleStages.length - 1]!

  const stages = lifecycleStages.map((stage) => {
    const duration = lifecycleProfile[stage.durationKey as keyof LifecycleProfile]
    const startDay = cursor
    const endDay = cursor + duration
    const complete = progressDays >= endDay
    const active = !complete && progressDays >= startDay && progressDays < endDay
    if (active) activeStage = stage
    cursor = endDay
    return {
      key: stage.key,
      label: stage.label,
      duration,
      startDay,
      endDay,
      complete,
      active,
    }
  })

  return {
    currentStage: activeStage.key,
    currentStageLabel: activeStage.label,
    elapsedDays,
    progressDays,
    totalDays,
    percent: Math.max(0, Math.min(100, Math.round((progressDays / Math.max(totalDays, 1)) * 100))),
    stages,
  }
}

export async function buildPlantView(ctx: Ctx, plant: PlantDoc) {
  return {
    ...plant,
    sensorProfile: normalizePlantSensorProfile(plant.sensorProfile),
    image: await resolveStoredImageUrl(ctx, plant.imageStorageId, plant.image),
  }
}

export function getHealthComputationGuide(profile = defaultPlantSensorProfile) {
  const normalized = normalizePlantSensorProfile(profile)
  return {
    sensorOptimalRanges: {
      soil: `${normalized.soil.min} to ${normalized.soil.max}`,
      light: `${normalized.light.min} to ${normalized.light.max}`,
      temperature: `${normalized.temperature.min} to ${normalized.temperature.max}`,
      air: `${normalized.air.min} to ${normalized.air.max}`,
      water: `${normalized.water.min} to ${normalized.water.max}`,
    },
    scoring: {
      perSensor: '100 jika optimal, 50 jika terlalu rendah atau terlalu tinggi',
      noSensorData: 'skor 0 dan kondisi tanaman dianggap kurang stabil',
      finalScore: 'rata-rata semua skor sensor yang dibulatkan ke bilangan bulat terdekat',
    },
    labels: {
      excellent: '80 sampai 100',
      good: '60 sampai 79',
      fair: '40 sampai 59',
      poor: '0 sampai 39',
    },
  }
}

// ============================================
// DEVICE HELPERS (Extended)
// ============================================

export function getQueuedDeviceCommands(device: DeviceDoc): DeviceQueuedCommands {
  return (
    device.queuedCommands ?? {
      pump: null,
      light: null,
    }
  )
}

export function buildDeviceCommandList(device: DeviceDoc) {
  return Object.values(getQueuedDeviceCommands(device)).filter(
    (command): command is QueuedDeviceAction => command !== null,
  )
}

export function buildQueuedPumpAction(device: DeviceDoc, durationSeconds: number) {
  const queuedCommands = getQueuedDeviceCommands(device)
  return {
    queuedCommands: {
      ...queuedCommands,
      pump: { kind: 'pump' as const, durationMs: durationSeconds * 1000 },
    },
  }
}

export function buildQueuedLightAction(device: DeviceDoc, enabled: boolean) {
  const queuedCommands = getQueuedDeviceCommands(device)
  return {
    queuedCommands: {
      ...queuedCommands,
      light: { kind: 'light' as const, enabled },
    },
  }
}

export async function getDeviceByExternalId(ctx: Ctx, deviceId: string) {
  return await ctx.db
    .query('devices')
    .withIndex('by_deviceId', (q) => q.eq('deviceId', deviceId))
    .first()
}

export function getDefaultDeviceName(deviceId: string) {
  const normalized = deviceId.trim()
  const suffix = normalized.length > 6 ? normalized.slice(-6) : normalized
  return `GrowMate ${suffix.toUpperCase()}`
}

export async function ensureDeviceExists(ctx: MutationCtx, deviceId: string, firmwareVersion?: string) {
  const normalizedDeviceId = deviceId.trim()
  const existing = await getDeviceByExternalId(ctx, normalizedDeviceId)
  if (existing) return existing

  const now = Date.now()
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: normalizedDeviceId,
    name: getDefaultDeviceName(normalizedDeviceId),
    autoWatering: true,
    autoLighting: true,
    wateringThreshold: DEFAULT_WATERING_THRESHOLD,
    wateringDuration: DEFAULT_WATERING_DURATION,
    wateringCooldown: DEFAULT_WATERING_COOLDOWN,
    lightingThreshold: DEFAULT_LIGHTING_THRESHOLD,
    lightingHysteresis: DEFAULT_LIGHTING_HYSTERESIS,
    lightEnabled: false,
    queuedCommands: { pump: null, light: null },
    reportedLightEnabled: false,
    reportedPumpEnabled: false,
    lastSeen: now,
    firmwareVersion: firmwareVersion?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  })

  return (await ctx.db.get(deviceDocId))!
}

export async function getUserDevices(ctx: Ctx, userId: Id<'users'>) {
  const devices = await ctx.db
    .query('devices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  return devices.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function requireOwnedDevice(ctx: Ctx, userId: Id<'users'>, deviceId: string) {
  const device = await getDeviceByExternalId(ctx, deviceId)
  if (!device || device.userId !== userId) {
    throw new Error('Perangkat tidak ditemukan')
  }
  return device
}

export async function getSelectedDevice(ctx: Ctx, userId: Id<'users'>, deviceId?: string) {
  if (deviceId) return await requireOwnedDevice(ctx, userId, deviceId)
  const devices = await getUserDevices(ctx, userId)
  return devices[0] ?? null
}

export async function archivePlant(
  ctx: MutationCtx,
  plantId: Id<'plants'>,
  archivedAt: number,
  userId?: Id<'users'>,
  reason = 'Tanaman diarsipkan',
) {
  const plant = await ctx.db.get(plantId)
  if (!plant || plant.archived) return plant

  await ctx.db.patch(plantId, {
    archived: true,
    archivedAt,
    updatedAt: archivedAt,
  })

  await recordGrowEvent(ctx, {
    deviceId: plant.deviceId,
    plantId,
    userId,
    source: userId ? 'user' : 'system',
    entityType: 'plant',
    eventType: 'plant_archived',
    title: reason,
    detail: `${plant.name} dipindahkan ke riwayat arsip.`,
    data: { archived: true, archivedAt },
    timestamp: archivedAt,
  })

  return await ctx.db.get(plantId)
}

export async function buildDeviceSummary(ctx: Ctx, device: DeviceDoc) {
  const currentPlant = device.plantId ? await ctx.db.get(device.plantId) : null
  const archivedPlants = await ctx.db
    .query('plants')
    .withIndex('by_device_archived', (q) => q.eq('deviceId', device._id).eq('archived', true))
    .collect()
  const recentEvents = await getRecentGrowEvents(ctx, device._id, 4)

  const plantImage =
    currentPlant && !currentPlant.archived
      ? await resolveStoredImageUrl(ctx, currentPlant.imageStorageId, currentPlant.image)
      : null

  return {
    _id: device._id,
    deviceId: device.deviceId,
    name: device.name,
    firmwareVersion: device.firmwareVersion,
    autoWatering: device.autoWatering,
    autoLighting: device.autoLighting,
    wateringThreshold: device.wateringThreshold,
    wateringDuration: getDeviceWateringDuration(device),
    wateringCooldown: getDeviceWateringCooldown(device),
    lightingThreshold: device.lightingThreshold,
    lightingHysteresis: getDeviceLightingHysteresis(device),
    lightEnabled: device.lightEnabled,
    lastWatered: device.lastWatered,
    lastSeen: device.lastSeen,
    isOnline: isDeviceOnline(device.lastSeen),
    hasPlant: Boolean(currentPlant && !currentPlant.archived),
    plant:
      currentPlant && !currentPlant.archived
        ? {
            _id: currentPlant._id,
            name: currentPlant.name,
            species: currentPlant.species,
            growthStage: currentPlant.growthStage,
            growthStageLabel: formatPlantStage(currentPlant.growthStage),
            wateringThreshold: currentPlant.wateringThreshold,
            lightingThreshold: currentPlant.lightingThreshold,
            location: currentPlant.location,
            image: plantImage,
            plantedAt: currentPlant.plantedAt,
          }
        : null,
    archivedPlantCount: archivedPlants.length,
    archivedPlants: archivedPlants
      .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
      .slice(0, 3)
      .map((plant) => ({
        _id: plant._id,
        name: plant.name,
        species: plant.species,
        growthStage: plant.growthStage,
        growthStageLabel: formatPlantStage(plant.growthStage),
        archivedAt: plant.archivedAt,
        archivedAtLabel: plant.archivedAt ? formatTimestamp(plant.archivedAt) : null,
      })),
    recentEvents,
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

// ============================================
// MARKETPLACE HELPERS
// ============================================

function formatMarketplaceStatus(status: 'active' | 'reserved' | 'sold' | 'archived') {
  switch (status) {
    case 'active':
      return 'Tersedia'
    case 'reserved':
      return 'Dipesan'
    case 'sold':
      return 'Terjual'
    case 'archived':
      return 'Diarsipkan'
  }
}

export function formatCurrencyIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

export async function enrichMarketplaceProduct(ctx: Ctx, product: ProductDoc, viewerId?: Id<'users'>) {
  const seller = await ctx.db.get(product.sellerId)
  const image = await resolveStoredImageUrl(ctx, product.imageStorageId, product.image)
  const thread =
    viewerId && product.type === 'community'
      ? await ctx.db
          .query('marketplaceThreads')
          .withIndex('by_product_and_buyer', (q) =>
            q.eq('productId', product._id).eq('buyerId', viewerId),
          )
          .first()
      : null

  return {
    ...product,
    sellerName: seller?.name ?? 'Penjual tidak diketahui',
    sellerAvatar: seller?.avatar ?? 'GM',
    sellerId: seller?._id,
    image,
    priceLabel: `${formatCurrencyIdr(product.price)} / ${product.priceUnit}`,
    quantityLabel: `${product.quantityAvailable} ${product.quantityUnit ?? 'item'}`,
    statusLabel: formatMarketplaceStatus(product.status),
    contactThreadId: thread?._id ?? null,
  }
}

export async function getMarketplaceThreadsForUser(ctx: Ctx, userId: Id<'users'>) {
  const [buyerThreads, sellerThreads] = await Promise.all([
    ctx.db
      .query('marketplaceThreads')
      .withIndex('by_buyer_and_lastMessageAt', (q) => q.eq('buyerId', userId))
      .order('desc')
      .take(12),
    ctx.db
      .query('marketplaceThreads')
      .withIndex('by_seller_and_lastMessageAt', (q) => q.eq('sellerId', userId))
      .order('desc')
      .take(12),
  ])

  const uniqueThreads = [...buyerThreads, ...sellerThreads].filter(
    (thread, index, list) =>
      list.findIndex((item) => String(item._id) === String(thread._id)) === index,
  )

  const needsProduct = uniqueThreads.filter((t) => !t.productTitle)
  const needsBuyer = uniqueThreads.filter((t) => !t.buyerName)
  const needsSeller = uniqueThreads.filter((t) => !t.sellerName)

  const [productMap, buyerMap, sellerMap] = await Promise.all([
    needsProduct.length
      ? Promise.all(needsProduct.map((t) => ctx.db.get(t.productId))).then((docs) =>
          new Map(docs.filter(Boolean).map((d) => [String(d!._id), d!])),
        )
      : Promise.resolve(new Map()),
    needsBuyer.length
      ? Promise.all(needsBuyer.map((t) => ctx.db.get(t.buyerId))).then((docs) =>
          new Map(docs.filter(Boolean).map((d) => [String(d!._id), d!])),
        )
      : Promise.resolve(new Map()),
    needsSeller.length
      ? Promise.all(needsSeller.map((t) => ctx.db.get(t.sellerId))).then((docs) =>
          new Map(docs.filter(Boolean).map((d) => [String(d!._id), d!])),
        )
      : Promise.resolve(new Map()),
  ])

  return await Promise.all(
    uniqueThreads.map(async (thread) => {
      const productTitle = thread.productTitle ?? productMap.get(String(thread.productId))?.title ?? 'Listing tidak diketahui'
      const productImage = thread.productImage ?? productMap.get(String(thread.productId))?.image
      const productStatus = thread.productStatus ?? productMap.get(String(thread.productId))?.status ?? 'archived'

      const buyerName = thread.buyerName ?? buyerMap.get(String(thread.buyerId))?.name ?? 'Pembeli'
      const buyerAvatar = buyerMap.get(String(thread.buyerId))?.avatar ?? 'BY'
      const sellerName = thread.sellerName ?? sellerMap.get(String(thread.sellerId))?.name ?? 'Penjual'
      const sellerAvatar = sellerMap.get(String(thread.sellerId))?.avatar ?? 'SL'

      const messages = await ctx.db
        .query('marketplaceMessages')
        .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id))
        .order('desc')
        .take(16)

      return {
        ...thread,
        role: String(thread.sellerId) === String(userId) ? 'seller' : 'buyer',
        productTitle,
        productImage,
        productStatus,
        participantName:
          String(thread.sellerId) === String(userId) ? buyerName : sellerName,
        participantAvatar:
          String(thread.sellerId) === String(userId) ? buyerAvatar : sellerAvatar,
        messages: messages.reverse().map((message) => ({
          ...message,
          createdAtLabel: formatTimestamp(message.createdAt),
          mine: String(message.senderId) === String(userId),
        })),
      }
    }),
  )
}

// ============================================
// MANUAL WATERING / LIGHTING HELPERS (unified for public + assistant triggers)
// ============================================

export async function executeManualWatering(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  now = Date.now(),
) {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null
  const durationSeconds = getDeviceWateringDuration(device)

  await ctx.db.patch(device._id, {
    ...buildQueuedPumpAction(device, durationSeconds),
    updatedAt: now,
  })

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_pump',
      duration: durationSeconds,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_watering_triggered',
      title: 'Penyiraman manual dipicu',
      detail: `${device.name} memulai siklus penyiraman manual.`,
      data: { duration: durationSeconds },
      timestamp: now,
    })
  }

  await ctx.db.insert('notifications', {
    userId: user._id,
    title: 'Penyiraman manual dipicu',
    detail: `${device.name} berhasil menjalankan siklus penyiraman manual.`,
    kind: 'system',
    read: false,
    createdAt: now,
  })
}

export async function executeManualLighting(
  ctx: MutationCtx,
  user: { _id: Id<'users'>; name?: string },
  device: DeviceDoc,
  enabled: boolean,
  now = Date.now(),
) {
  const plant = device.plantId ? await ctx.db.get(device.plantId) : null

  await ctx.db.patch(device._id, {
    ...buildQueuedLightAction(device, enabled),
    lightEnabled: enabled,
    updatedAt: now,
  })

  if (plant && !plant.archived) {
    await recordAutomationEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      action: 'manual_light',
      lightValue: undefined,
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'automation',
      eventType: 'manual_lighting_triggered',
      title: enabled ? 'Pencahayaan manual dinyalakan' : 'Pencahayaan manual dimatikan',
      detail: `${device.name} lampu tumbuh ${enabled ? 'dinyalakan' : 'dimatikan'} secara manual.`,
      data: { enabled },
      timestamp: now,
    })
  }
}

// ============================================
// BLOG HELPERS
// ============================================

export async function enrichBlogPost(ctx: Ctx, post: BlogPostDoc) {
  const [author, image] = await Promise.all([
    ctx.db.get(post.authorId),
    resolveStoredImageUrl(ctx, post.imageStorageId, post.image),
  ])

  return {
    ...post,
    image,
    authorName: author?.name ?? author?.email ?? 'GrowMate admin',
    createdAtLabel: formatTimestamp(post.createdAt),
    relativeTime: getRelativeTime(post.createdAt),
  }
}
