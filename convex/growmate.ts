import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { mutation, query, internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import { getCurrentUser, requireAdmin, requireUser } from './helpers'
import type { PlantPreset } from '../src/lib/plants'
import { plantCatalogSeed } from './plantCatalogSeed'
import {
  getSensorStatus,
  getSensorTarget,
  getSensorLabel,
  getSensorAccent,
  getSensorSort,
  computePlantHealth,
  isDeviceOnline,
  computeWaterReservoirDays,
  formatTimestamp,
  getRelativeTime,
  generateAlerts,
  getActivityPoints,
  type SensorKind,
} from './helpers'

function normalizeHandle(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s.]/g, '')
    .replace(/\s+/g, '.')
}

type GrowEventSource = 'user' | 'device' | 'system' | 'automation'
type GrowEventEntity = 'device' | 'plant' | 'schedule' | 'automation' | 'sensor'
type GrowEventType =
  | 'device_claimed'
  | 'device_unclaimed'
  | 'plant_assigned'
  | 'plant_archived'
  | 'plant_image_updated'
  | 'sensor_recorded'
  | 'manual_watering_triggered'
  | 'automation_settings_updated'
  | 'care_schedule_toggled'
  | 'automation_action_executed'
  | 'care_schedule_saved'
  | 'care_schedule_completed'
  | 'manual_lighting_triggered'

type MetricPoint = {
  value: number
  measuredAt: number
}

type Ctx = QueryCtx | MutationCtx
type UserDoc = Doc<'users'>
type PlantDoc = Doc<'plants'>
type DeviceDoc = Doc<'devices'>
type SensorDoc = Doc<'sensors'>
type CareScheduleDoc = Doc<'careSchedules'>
type ProductDoc = Doc<'products'>
type CommunityPostDoc = Doc<'communityPosts'>
type DeviceAutomationKey =
  | 'autoWatering'
  | 'autoLighting'
  | 'wateringThreshold'
  | 'wateringDuration'
  | 'wateringCooldown'
  | 'lightingThreshold'
  | 'lightingHysteresis'

type ScheduleCadenceUnit = 'hours' | 'days'

type ScheduleCadence = {
  unit: ScheduleCadenceUnit
  value: number
  timeOfDayMinutes: number | null
  timezoneOffsetMinutes: number
}

type LifecycleProfile = {
  seedDormancyDays: number
  germinationDays: number
  seedlingDevelopmentDays: number
  vegetativeGrowthDays: number
  floweringReproductionDays: number
  maturitySenescenceDays: number
}

type PlantStageValue =
  | 'seed_dormancy'
  | 'germination'
  | 'seedling_development'
  | 'vegetative_growth'
  | 'flowering_reproduction'
  | 'maturity_senescence'

const defaultLifecycleProfile: LifecycleProfile = {
  seedDormancyDays: 7,
  germinationDays: 10,
  seedlingDevelopmentDays: 14,
  vegetativeGrowthDays: 30,
  floweringReproductionDays: 24,
  maturitySenescenceDays: 20,
}

const lifecycleStages = [
  { key: 'seed_dormancy', label: 'Seed dormancy', durationKey: 'seedDormancyDays' },
  { key: 'germination', label: 'Germination', durationKey: 'germinationDays' },
  { key: 'seedling_development', label: 'Seedling development', durationKey: 'seedlingDevelopmentDays' },
  { key: 'vegetative_growth', label: 'Vegetative growth', durationKey: 'vegetativeGrowthDays' },
  { key: 'flowering_reproduction', label: 'Flowering / reproduction', durationKey: 'floweringReproductionDays' },
  { key: 'maturity_senescence', label: 'Maturity / senescence', durationKey: 'maturitySenescenceDays' },
] as const

const sensorKinds: SensorKind[] = ['soil', 'light', 'temperature', 'air', 'water']

const DEFAULT_WATERING_DURATION = 8
const DEFAULT_WATERING_COOLDOWN = 6 * 60 * 60
const DEFAULT_LIGHTING_HYSTERESIS = 8

function clampScheduleTimeOfDayMinutes(value?: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 8 * 60
  return Math.max(0, Math.min(23 * 60 + 59, Math.round(value)))
}

function normalizeScheduleCadence(input: {
  cadenceUnit?: CareScheduleDoc['cadenceUnit']
  cadenceValue?: CareScheduleDoc['cadenceValue']
  timeOfDayMinutes?: CareScheduleDoc['timeOfDayMinutes']
  timezoneOffsetMinutes?: CareScheduleDoc['timezoneOffsetMinutes']
  intervalDays?: CareScheduleDoc['intervalDays']
  intervalHours?: CareScheduleDoc['intervalHours']
  nextRunAt?: CareScheduleDoc['nextRunAt']
}): ScheduleCadence {
  if (input.cadenceUnit && input.cadenceValue) {
    return {
      unit: input.cadenceUnit,
      value: Math.max(1, Math.round(input.cadenceValue)),
      timeOfDayMinutes: input.cadenceUnit === 'days' ? clampScheduleTimeOfDayMinutes(input.timeOfDayMinutes) : null,
      timezoneOffsetMinutes: Math.round(input.timezoneOffsetMinutes ?? 0),
    }
  }

  const intervalDays = Math.max(0, Math.round(input.intervalDays ?? 0))
  const intervalHours = Math.max(0, Math.round(input.intervalHours ?? 0))
  const totalHours = Math.max(1, intervalDays * 24 + intervalHours)

  if (totalHours % 24 === 0) {
    const nextRunDate = new Date(input.nextRunAt ?? Date.now())
    return {
      unit: 'days',
      value: Math.max(1, totalHours / 24),
      timeOfDayMinutes: nextRunDate.getHours() * 60 + nextRunDate.getMinutes(),
      timezoneOffsetMinutes: -nextRunDate.getTimezoneOffset(),
    }
  }

  return {
    unit: 'hours',
    value: totalHours,
    timeOfDayMinutes: null,
    timezoneOffsetMinutes: 0,
  }
}

function formatScheduleTime(minutes: number | null) {
  if (minutes === null) return null
  const normalized = clampScheduleTimeOfDayMinutes(minutes)
  const hours24 = Math.floor(normalized / 60)
  const mins = normalized % 60
  const suffix = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 || 12
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`
}

function formatScheduleCadence(cadence: ScheduleCadence) {
  if (cadence.unit === 'hours') {
    return cadence.value === 1 ? 'Every hour' : `Every ${cadence.value} hours`
  }

  const dayLabel = cadence.value === 1 ? 'Every day' : `Every ${cadence.value} days`
  const timeLabel = formatScheduleTime(cadence.timeOfDayMinutes)
  return timeLabel ? `${dayLabel} at ${timeLabel}` : dayLabel
}

function getLegacyScheduleInterval(cadence: ScheduleCadence) {
  if (cadence.unit === 'days') {
    return {
      intervalDays: cadence.value,
      intervalHours: undefined,
    }
  }

  return {
    intervalDays: Math.floor(cadence.value / 24),
    intervalHours: cadence.value % 24 || undefined,
  }
}

function computeNextRunAtFromCadence(cadence: ScheduleCadence, fromTime: number) {
  if (cadence.unit === 'hours') {
    return fromTime + cadence.value * 60 * 60 * 1000
  }

  const timeOfDayMinutes = clampScheduleTimeOfDayMinutes(cadence.timeOfDayMinutes)
  const localReference = new Date(fromTime + cadence.timezoneOffsetMinutes * 60 * 1000)
  const localYear = localReference.getUTCFullYear()
  const localMonth = localReference.getUTCMonth()
  const localDate = localReference.getUTCDate()
  const localHours = Math.floor(timeOfDayMinutes / 60)
  const localMinutes = timeOfDayMinutes % 60

  let candidate = Date.UTC(localYear, localMonth, localDate, localHours, localMinutes) - cadence.timezoneOffsetMinutes * 60 * 1000
  if (candidate <= fromTime) {
    candidate = Date.UTC(localYear, localMonth, localDate + cadence.value, localHours, localMinutes) - cadence.timezoneOffsetMinutes * 60 * 1000
  }

  return candidate
}

function formatScheduleSummary(input: {
  cadenceUnit?: CareScheduleDoc['cadenceUnit']
  cadenceValue?: CareScheduleDoc['cadenceValue']
  timeOfDayMinutes?: CareScheduleDoc['timeOfDayMinutes']
  timezoneOffsetMinutes?: CareScheduleDoc['timezoneOffsetMinutes']
  intervalDays?: CareScheduleDoc['intervalDays']
  intervalHours?: CareScheduleDoc['intervalHours']
  nextRunAt?: CareScheduleDoc['nextRunAt']
}) {
  const cadence = normalizeScheduleCadence(input)
  const legacy = getLegacyScheduleInterval(cadence)

  return {
    cadence,
    cadenceLabel: formatScheduleCadence(cadence),
    timeLabel: formatScheduleTime(cadence.timeOfDayMinutes),
    intervalDays: legacy.intervalDays,
    intervalHours: legacy.intervalHours ?? 0,
  }
}

function normalizeLifecycleProfile(profile?: Partial<LifecycleProfile> | null): LifecycleProfile {
  return {
    seedDormancyDays: profile?.seedDormancyDays ?? defaultLifecycleProfile.seedDormancyDays,
    germinationDays: profile?.germinationDays ?? defaultLifecycleProfile.germinationDays,
    seedlingDevelopmentDays: profile?.seedlingDevelopmentDays ?? defaultLifecycleProfile.seedlingDevelopmentDays,
    vegetativeGrowthDays: profile?.vegetativeGrowthDays ?? defaultLifecycleProfile.vegetativeGrowthDays,
    floweringReproductionDays: profile?.floweringReproductionDays ?? defaultLifecycleProfile.floweringReproductionDays,
    maturitySenescenceDays: profile?.maturitySenescenceDays ?? defaultLifecycleProfile.maturitySenescenceDays,
  }
}

function formatPlantStage(stage: PlantStageValue) {
  return stage
    .split('_')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ')
}

function computePlantProgress(plant: Pick<PlantDoc, 'growthStage' | 'plantedAt' | 'lifecycleProfile'>) {
  const lifecycleProfile = normalizeLifecycleProfile(plant.lifecycleProfile)
  const normalizedStage = plant.growthStage as PlantStageValue
  const elapsedDays = Math.max(0, Math.floor((Date.now() - plant.plantedAt) / (24 * 60 * 60 * 1000)))

  let offsetDays = 0
  for (const stage of lifecycleStages) {
    if (stage.key === normalizedStage) {
      break
    }
    offsetDays += lifecycleProfile[stage.durationKey]
  }

  const progressDays = offsetDays + elapsedDays
  const totalDays = lifecycleStages.reduce((total, stage) => total + lifecycleProfile[stage.durationKey], 0)

  let cursor = 0
  let activeStage = lifecycleStages[lifecycleStages.length - 1]!

  const stages = lifecycleStages.map((stage) => {
    const duration = lifecycleProfile[stage.durationKey]
    const startDay = cursor
    const endDay = cursor + duration
    const complete = progressDays >= endDay
    const active = !complete && progressDays >= startDay && progressDays < endDay
    if (active) {
      activeStage = stage
    }
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

function getHealthComputationGuide() {
  return {
    sensorOptimalRanges: {
      soil: '30 to 80',
      light: '30 to 80',
      temperature: '18 to 28',
      air: '40 to 70',
      water: '20 to 90',
    },
    scoring: {
      perSensor: '100 if optimal, 50 if low or high',
      noSensorData: 'score 0 and health poor',
      finalScore: 'average of all sensor scores rounded to nearest whole number',
    },
    labels: {
      excellent: '80 to 100',
      good: '60 to 79',
      fair: '40 to 59',
      poor: '0 to 39',
    },
  }
}

const plantStagePoints: Record<PlantStageValue, number> = {
  seed_dormancy: 5,
  germination: 10,
  seedling_development: 20,
  vegetative_growth: 35,
  flowering_reproduction: 50,
  maturity_senescence: 65,
}

async function computeUserPlantPoints(ctx: QueryCtx, userId: Id<'users'>) {
  const devices = await ctx.db.query('devices').withIndex('by_user', (q) => q.eq('userId', userId)).take(32)
  let total = 0

  for (const device of devices) {
    const plants = await ctx.db.query('plants').withIndex('by_device', (q) => q.eq('deviceId', device._id)).take(32)
    for (const plant of plants) {
      total += plantStagePoints[plant.growthStage as PlantStageValue] ?? 0
    }
  }

  return total
}

function formatEventValue(value: string | number | boolean | null | undefined) {
  if (value === undefined || value === null) return 'unset'
  if (typeof value === 'boolean') return value ? 'on' : 'off'
  return String(value)
}

function getDeviceWateringDuration(device: Pick<DeviceDoc, 'wateringDuration'>) {
  return Number.isFinite(device.wateringDuration) ? device.wateringDuration : DEFAULT_WATERING_DURATION
}

function getDeviceWateringCooldown(device: Pick<DeviceDoc, 'wateringCooldown'>) {
  return Number.isFinite(device.wateringCooldown) ? device.wateringCooldown : DEFAULT_WATERING_COOLDOWN
}

function getDeviceLightingHysteresis(device: Pick<DeviceDoc, 'lightingHysteresis'>) {
  return Number.isFinite(device.lightingHysteresis) ? device.lightingHysteresis : DEFAULT_LIGHTING_HYSTERESIS
}

async function recordGrowEvent(
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

async function recordPlantImage(
  ctx: MutationCtx,
  args: {
    plantId: Id<'plants'>
    deviceId: Id<'devices'>
    image: string
    source: 'camera' | 'manual'
    capturedAt: number
  },
) {
  await ctx.db.insert('plantImages', args)
}

async function recordAutomationEvent(
  ctx: MutationCtx,
  args: {
    deviceId: string
    plantId?: Id<'plants'>
    action: 'pump_enabled' | 'pump_disabled' | 'light_on' | 'light_off' | 'manual_pump' | 'manual_light' | 'schedule_completed'
    soilValue?: number
    lightValue?: number
    threshold?: number
    duration?: number
    timestamp: number
  },
) {
  if (!args.plantId) {
    return
  }

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

async function getSensorHistory(ctx: Ctx, plantId: Id<'plants'>, limit = 24) {
  const histories = await Promise.all(
    sensorKinds.map(async (kind) => {
      const readings = await ctx.db
        .query('sensorReadings')
        .withIndex('by_plant_kind', (q) => q.eq('plantId', plantId).eq('kind', kind))
        .order('desc')
        .take(limit)

      return [kind, readings.reverse().map((reading) => ({ value: reading.value, measuredAt: reading.measuredAt }))]
    }),
  )

  return Object.fromEntries(histories) as Record<SensorKind, MetricPoint[]>
}

async function getPlantImageHistory(ctx: Ctx, plantId: Id<'plants'>, limit = 8) {
  const images = await ctx.db
    .query('plantImages')
    .withIndex('by_plant', (q) => q.eq('plantId', plantId))
    .order('desc')
    .take(limit)

  return images.map((image) => ({
    _id: image._id,
    image: image.image,
    source: image.source,
    capturedAt: image.capturedAt,
    capturedAtLabel: formatTimestamp(image.capturedAt),
  }))
}

async function getRecentGrowEvents(ctx: Ctx, deviceDocId: Id<'devices'>, limit = 10) {
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

async function getRecentAutomationLogs(ctx: Ctx, plantId: Id<'plants'>, limit = 8) {
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

async function getSupportMessages(ctx: Ctx, requestId: Id<'supportRequests'>, limit = 24) {
  const messages = await ctx.db
    .query('supportMessages')
    .withIndex('by_request_and_createdAt', (q) => q.eq('requestId', requestId))
    .order('desc')
    .take(limit)

  return messages.reverse()
}

function getAssistantMessageLimit(tier?: 'basic' | 'advanced') {
  return tier === 'advanced' ? 100 : 20
}

function getStartOfToday() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.getTime()
}

async function getAssistantThread(ctx: Ctx, userId: Id<'users'>) {
  return await ctx.db.query('assistantThreads').withIndex('by_user', (q) => q.eq('userId', userId)).first()
}

async function getAssistantMessages(ctx: Ctx, threadId: Id<'assistantThreads'>, limit = 24) {
  const messages = await ctx.db
    .query('assistantMessages')
    .withIndex('by_createdAt', (q) => q.eq('threadId', threadId))
    .order('desc')
    .take(limit)

  return messages.reverse()
}

async function getAssistantUsage(ctx: Ctx, threadId: Id<'assistantThreads'>, tier?: 'basic' | 'advanced') {
  const startOfToday = getStartOfToday()
    const recentMessages = await ctx.db
      .query('assistantMessages')
      .withIndex('by_createdAt', (q) => q.eq('threadId', threadId))
      .order('desc')
      .take(160)

  const usedToday = recentMessages.filter((message) => message.role === 'user' && message.createdAt >= startOfToday).length
  const limit = getAssistantMessageLimit(tier)

  return {
    usedToday,
    limit,
    remainingToday: Math.max(0, limit - usedToday),
    resetsAt: startOfToday + 24 * 60 * 60 * 1000,
  }
}

async function buildAssistantContext(ctx: Ctx, user: UserDoc, device: DeviceDoc | null, plant: PlantDoc | null) {
  const activePlant = plant && !plant.archived ? plant : null
  const deviceWithPlant = plant && !plant.archived && device ? device : null
  let sensors: SensorDoc[] = []
  let schedules: CareScheduleDoc[] = []
  let recentEvents: Awaited<ReturnType<typeof getRecentGrowEvents>> = []
  let automationLogs: Awaited<ReturnType<typeof getRecentAutomationLogs>> = []

  if (deviceWithPlant && activePlant) {
    ;[sensors, schedules, recentEvents, automationLogs] = await Promise.all([
      ctx.db.query('sensors').withIndex('by_plant', (q) => q.eq('plantId', activePlant._id)).collect(),
      ctx.db.query('careSchedules').withIndex('by_plant', (q) => q.eq('plantId', activePlant._id)).take(5),
      getRecentGrowEvents(ctx, deviceWithPlant._id, 8),
      getRecentAutomationLogs(ctx, activePlant._id, 6),
    ])
  } else {
    recentEvents = device ? await getRecentGrowEvents(ctx, device._id, 8) : []
  }

  const sensorSummaries = sensors.map((sensor) => ({
    kind: sensor.kind,
    label: getSensorLabel(sensor.kind as SensorKind),
    value: sensor.value,
    unit: sensor.unit,
    status: getSensorStatus(sensor.kind as SensorKind, sensor.value),
    target: getSensorTarget(sensor.kind as SensorKind, sensor.value, getSensorStatus(sensor.kind as SensorKind, sensor.value)),
  }))

  return {
    user: {
      name: user.name ?? 'GrowMate user',
      tier: user.tier ?? 'basic',
    },
    activeDevice: device
      ? {
          name: device.name,
          deviceId: device.deviceId,
          autoWatering: device.autoWatering,
          autoLighting: device.autoLighting,
          wateringThreshold: device.wateringThreshold,
          wateringDuration: getDeviceWateringDuration(device),
          wateringCooldown: getDeviceWateringCooldown(device),
          lightingThreshold: device.lightingThreshold,
          lightingHysteresis: getDeviceLightingHysteresis(device),
          pumpEnabled: device.pumpEnabled,
          lightEnabled: device.lightEnabled,
          lastSeen: formatTimestamp(device.lastSeen),
        }
      : null,
    activePlant: plant && !plant.archived
      ? {
          name: plant.name,
          species: plant.species,
          health: computePlantHealth(sensorSummaries.map((sensor) => ({ kind: sensor.kind, value: sensor.value }))),
          growthStage: formatPlantStage(plant.growthStage),
          location: plant.location,
          wateringThreshold: plant.wateringThreshold,
          lightingThreshold: plant.lightingThreshold,
          progress: computePlantProgress(plant),
          lifecycleProfile: plant.lifecycleProfile,
        }
      : null,
    sensors: sensorSummaries,
    schedules: schedules.map((schedule) => {
      const summary = formatScheduleSummary(schedule)
      return {
        title: schedule.title,
        enabled: schedule.enabled,
        nextRunAt: formatTimestamp(schedule.nextRunAt),
        lastRunAt: schedule.lastRunAt ? formatTimestamp(schedule.lastRunAt) : null,
        intervalDays: summary.intervalDays,
        intervalHours: summary.intervalHours,
        cadenceUnit: summary.cadence.unit,
        cadenceValue: summary.cadence.value,
        timeOfDayMinutes: summary.cadence.timeOfDayMinutes,
        cadenceLabel: summary.cadenceLabel,
        timeLabel: summary.timeLabel,
      }
    }),
    recentEvents: recentEvents.map((event) => ({
      title: event.title,
      detail: event.detail,
      time: event.relativeTime,
    })),
    automationLogs: automationLogs.map((log) => ({
      action: log.action,
      soilValue: log.soilValue,
      lightValue: log.lightValue,
      threshold: log.threshold,
      duration: log.duration,
      time: log.relativeTime,
    })),
  }
}

function formatMarketplaceStatus(status: 'active' | 'reserved' | 'sold' | 'archived') {
  switch (status) {
    case 'active':
      return 'Available'
    case 'reserved':
      return 'Reserved'
    case 'sold':
      return 'Sold'
    case 'archived':
      return 'Archived'
  }
}

function getAutomationModeLabel(device: { autoWatering: boolean; autoLighting: boolean }) {
  if (device.autoWatering && device.autoLighting) return 'Full automation'
  if (device.autoWatering || device.autoLighting) return 'Partial automation'
  return 'Manual control'
}

async function upsertPlantCatalog(ctx: MutationCtx, preset: PlantPreset, now: number) {
  const existing = await ctx.db.query('plantCatalog').withIndex('by_key', (q) => q.eq('key', preset.key)).first()
  const payload = {
    key: preset.key,
    name: preset.name,
    species: preset.species,
    growthStage: preset.growthStage,
    image: preset.image,
    imageStorageId: undefined,
    description: preset.description,
    location: preset.location,
    category: preset.category,
    difficulty: preset.difficulty,
    wateringThreshold: preset.wateringThreshold,
    lightingThreshold: preset.lightingThreshold,
    lifecycleProfile: preset.lifecycleProfile,
    updatedAt: now,
  }

  if (existing) {
    await ctx.db.patch(existing._id, payload)
  } else {
    await ctx.db.insert('plantCatalog', {
      ...payload,
      createdAt: now,
    })
  }
}

function normalizePlantPresetKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
}

async function enrichMarketplaceProduct(ctx: Ctx, product: ProductDoc, viewerId?: Id<'users'>) {
  const seller = await ctx.db.get(product.sellerId)
  const image = await resolveStoredImageUrl(ctx, product.imageStorageId, product.image)
  const thread = viewerId && product.type === 'community'
    ? await ctx.db.query('marketplaceThreads').withIndex('by_product_and_buyer', (q) => q.eq('productId', product._id).eq('buyerId', viewerId)).first()
    : null

  return {
    ...product,
    sellerName: seller?.name ?? 'Unknown grower',
    sellerAvatar: seller?.avatar ?? 'GM',
    sellerId: seller?._id,
    image,
    distance: product.distanceMiles ? `${product.distanceMiles} miles away` : null,
    priceLabel: `${formatCurrencyIdr(product.price)} / ${product.priceUnit}`,
    quantityLabel: `${product.quantityAvailable} ${product.quantityUnit ?? 'items'}`,
    statusLabel: formatMarketplaceStatus(product.status),
    contactThreadId: thread?._id ?? null,
  }
}

function formatCurrencyIdr(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

async function resolveStoredImageUrl(
  ctx: Ctx,
  imageStorageId?: Id<'_storage'> | null,
  fallbackImage?: string | null,
) {
  if (imageStorageId) {
    const storageUrl = await ctx.storage.getUrl(imageStorageId)
    if (storageUrl) {
      return storageUrl
    }
  }

  return fallbackImage ?? null
}

async function getMarketplaceThreadsForUser(ctx: Ctx, userId: Id<'users'>) {
  const [buyerThreads, sellerThreads] = await Promise.all([
    ctx.db.query('marketplaceThreads').withIndex('by_buyer_and_lastMessageAt', (q) => q.eq('buyerId', userId)).order('desc').take(12),
    ctx.db.query('marketplaceThreads').withIndex('by_seller_and_lastMessageAt', (q) => q.eq('sellerId', userId)).order('desc').take(12),
  ])

  const uniqueThreads = [...buyerThreads, ...sellerThreads].filter(
    (thread, index, list) => list.findIndex((item) => String(item._id) === String(thread._id)) === index,
  )

  return await Promise.all(uniqueThreads.map(async (thread) => {
      const [product, buyer, seller, messages] = await Promise.all([
        ctx.db.get(thread.productId),
        ctx.db.get(thread.buyerId),
        ctx.db.get(thread.sellerId),
        ctx.db.query('marketplaceMessages').withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id)).order('desc').take(16),
      ])

    return {
      ...thread,
      role: String(thread.sellerId) === String(userId) ? 'seller' : 'buyer',
      productTitle: product?.title ?? 'Unknown listing',
      productImage: product?.image,
      productStatus: product?.status ?? 'archived',
      participantName: String(thread.sellerId) === String(userId) ? buyer?.name ?? 'Buyer' : seller?.name ?? 'Seller',
      participantAvatar: String(thread.sellerId) === String(userId) ? buyer?.avatar ?? 'BY' : seller?.avatar ?? 'SL',
      messages: messages.reverse().map((message) => ({
        ...message,
        createdAtLabel: formatTimestamp(message.createdAt),
        mine: String(message.senderId) === String(userId),
      })),
    }
  }))
}

async function getCommunityPostView(ctx: Ctx, post: CommunityPostDoc, viewerId?: Id<'users'>) {
  const [likes, comments, postUser] = await Promise.all([
    ctx.db.query('postLikes').withIndex('by_post', (q) => q.eq('postId', post._id)).collect(),
    ctx.db.query('postComments').withIndex('by_post', (q) => q.eq('postId', post._id)).collect(),
    ctx.db.get(post.userId),
  ])
  const image = await resolveStoredImageUrl(ctx, post.imageStorageId, post.image)

  const commentUsers = new Map<string, UserDoc | null>()
  for (const comment of comments) {
    if (!commentUsers.has(String(comment.userId))) {
      commentUsers.set(String(comment.userId), await ctx.db.get(comment.userId))
    }
  }

  return {
    ...post,
    image,
    user: postUser,
    likeCount: likes.length,
    commentCount: comments.length,
    viewerHasLiked: viewerId ? likes.some((like) => String(like.userId) === String(viewerId)) : false,
    timestamp: getRelativeTime(post.createdAt),
    comments: comments
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-6)
      .map((comment) => ({
        ...comment,
        user: commentUsers.get(String(comment.userId)),
        createdAtLabel: getRelativeTime(comment.createdAt),
      })),
  }
}

async function getUserDevices(ctx: Ctx, userId: Id<'users'>) {
  const devices = await ctx.db
    .query('devices')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  return devices.sort((a, b) => b.updatedAt - a.updatedAt)
}

async function getDeviceByExternalId(ctx: Ctx, deviceId: string) {
  return await ctx.db
    .query('devices')
    .withIndex('by_deviceId', (q) => q.eq('deviceId', deviceId))
    .first()
}

async function requireOwnedDevice(ctx: Ctx, userId: Id<'users'>, deviceId: string) {
  const device = await getDeviceByExternalId(ctx, deviceId)

  if (!device || device.userId !== userId) {
    throw new Error('Device not found')
  }

  return device
}

async function getSelectedDevice(ctx: Ctx, userId: Id<'users'>, deviceId?: string) {
  if (deviceId) {
    return await requireOwnedDevice(ctx, userId, deviceId)
  }

  const devices = await getUserDevices(ctx, userId)
  return devices[0] ?? null
}

async function archivePlant(ctx: MutationCtx, plantId: Id<'plants'>, archivedAt: number, userId?: Id<'users'>, reason = 'Archived plant') {
  const plant = await ctx.db.get(plantId)
  if (!plant || plant.archived) {
    return plant
  }

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
    detail: `${plant.name} moved into archive history.`,
    data: {
      archived: true,
      archivedAt,
    },
    timestamp: archivedAt,
  })

  return await ctx.db.get(plantId)
}

async function buildDeviceSummary(ctx: Ctx, device: DeviceDoc) {
  const currentPlant = device.plantId ? await ctx.db.get(device.plantId) : null
  const archivedPlants = await ctx.db
    .query('plants')
    .withIndex('by_device_archived', (q) => q.eq('deviceId', device._id).eq('archived', true))
    .collect()
  const recentEvents = await getRecentGrowEvents(ctx, device._id, 4)

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
    pumpEnabled: device.pumpEnabled,
    lightEnabled: device.lightEnabled,
    lastWatered: device.lastWatered,
    lastSeen: device.lastSeen,
    isOnline: isDeviceOnline(device.lastSeen),
    hasPlant: Boolean(currentPlant && !currentPlant.archived),
    plant: currentPlant && !currentPlant.archived
      ? {
          _id: currentPlant._id,
          name: currentPlant.name,
          species: currentPlant.species,
          growthStage: currentPlant.growthStage,
          growthStageLabel: formatPlantStage(currentPlant.growthStage),
          wateringThreshold: currentPlant.wateringThreshold,
          lightingThreshold: currentPlant.lightingThreshold,
          location: currentPlant.location,
          image: currentPlant.image,
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

function buildSetupStatus(user: UserDoc, devices: DeviceDoc[]) {
  if (user.role === 'admin') {
    return {
      authenticated: true,
      hasProfile: Boolean(user?.name),
      hasDevice: false,
      setupComplete: true,
      devicesCount: 0,
      configuredDevicesCount: 0,
      needsPlantSelection: false,
      nextStep: 'done' as const,
      nextDeviceId: null,
      role: 'admin' as const,
      isAdmin: true,
    }
  }

  const hasProfile = Boolean(user?.name)
  const hasDevice = devices.length > 0
  const configuredDevices = devices.filter((device) => Boolean(device.plantId))
  const needsPlantDevice = devices.find((device) => !device.plantId) ?? null
  const setupComplete = hasProfile && configuredDevices.length > 0

  let nextStep: 'complete-profile' | 'claim-device' | 'select-plant' | 'done' = 'done'
  if (!hasProfile) {
    nextStep = 'complete-profile'
  } else if (!hasDevice) {
    nextStep = 'claim-device'
  } else if (configuredDevices.length === 0 && needsPlantDevice) {
    nextStep = 'select-plant'
  }

  return {
    authenticated: true,
    hasProfile,
    hasDevice,
    setupComplete,
    devicesCount: devices.length,
    configuredDevicesCount: configuredDevices.length,
    needsPlantSelection: Boolean(needsPlantDevice),
    nextStep,
    nextDeviceId: needsPlantDevice?.deviceId ?? configuredDevices[0]?.deviceId ?? devices[0]?.deviceId ?? null,
    role: user.role ?? 'grower',
    isAdmin: false,
  }
}

// ============================================
// AUTH FLOW - Registration & Onboarding
// ============================================

export const completeProfile = mutation({
  args: {
    name: v.string(),
    handle: v.optional(v.string()),
    role: v.optional(v.union(v.literal('grower'), v.literal('company'))),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')

    const handle = normalizeHandle(args.handle?.trim() || args.name)
    const existingHandle = await ctx.db.query('users').withIndex('by_handle', (q) => q.eq('handle', handle)).first()
    if (existingHandle && String(existingHandle._id) !== String(user._id)) {
      throw new Error('That handle is already in use')
    }

    const now = Date.now()
    await ctx.db.patch(user._id, {
      name: args.name.trim(),
      handle,
      role: args.role || 'grower',
      tier: 'basic',
      avatar: args.avatar || args.name.split(' ').map(n => n[0]).join('').toUpperCase(),
      updatedAt: now,
    })

    return { success: true }
  },
})

export const claimDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) throw new Error('Not authenticated')
    if (!user.name) throw new Error('Please complete your profile first')

    const device = await ctx.db
      .query('devices')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .first()
    
    if (!device) {
      throw new Error('Device not found. Please check the device ID and try again.')
    }

    // Check if device is already claimed
    if (device.userId) {
      throw new Error('This device is already registered to another user')
    }

    const now = Date.now()

    await ctx.db.patch(device._id, {
      userId: user._id,
      plantId: undefined,
      updatedAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      userId: user._id,
      source: 'user',
      entityType: 'device',
      eventType: 'device_claimed',
      title: 'Device claimed',
      detail: `${device.name} was linked to ${user.name || user.email || 'this account'}.`,
      data: {
        deviceId: device.deviceId,
      },
      timestamp: now,
    })

    return {
      success: true,
      device: {
        _id: device._id,
        deviceId: device.deviceId,
        name: device.name,
      },
    }
  },
})

export const checkSetupStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return { authenticated: false, hasProfile: false, hasDevice: false, setupComplete: false }

    const devices = await getUserDevices(ctx, user._id)
    return buildSetupStatus(user, devices)
  },
})

export const currentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    return {
      _id: user._id,
      email: user.email ?? '',
      name: user.name ?? '',
      handle: user.handle ?? '',
      avatar: user.avatar ?? '',
      role: user.role ?? 'grower',
      tier: user.tier ?? 'basic',
      setupComplete: Boolean(user.setupComplete),
    }
  },
})

export const updateCurrentUserProfile = mutation({
  args: {
    name: v.string(),
    handle: v.string(),
    avatar: v.optional(v.string()),
    role: v.optional(v.union(v.literal('grower'), v.literal('company'))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const normalizedHandle = normalizeHandle(args.handle || args.name)
    const existingHandle = await ctx.db.query('users').withIndex('by_handle', (q) => q.eq('handle', normalizedHandle)).first()
    if (existingHandle && String(existingHandle._id) !== String(user._id)) {
      throw new Error('That handle is already in use')
    }

    await ctx.db.patch(user._id, {
      name: args.name.trim(),
      handle: normalizedHandle,
      avatar: args.avatar?.trim() || args.name.split(' ').map((part) => part[0]).join('').toUpperCase(),
      role: user.role === 'admin' ? 'admin' : args.role ?? user.role ?? 'grower',
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const headerNotifications = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      return { items: [], unreadCount: 0 }
    }

    const items = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(8)

    return {
      items: items.map((notification) => ({
        ...notification,
        createdAtLabel: formatTimestamp(notification.createdAt),
        relativeTime: getRelativeTime(notification.createdAt),
      })),
      unreadCount: items.filter((notification) => !notification.read).length,
    }
  },
})

export const plantLibrary = query({
  args: {},
  handler: async (ctx) => {
    const presets = await ctx.db.query('plantCatalog').take(64)
    const presetsWithImages = await Promise.all(presets.map(async (preset) => ({
      ...preset,
      image: (await resolveStoredImageUrl(ctx, preset.imageStorageId, preset.image)) ?? preset.image,
    })))
    return presetsWithImages.sort((a, b) => a.name.localeCompare(b.name))
  },
})

export const syncPlantCatalog = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    for (const preset of plantCatalogSeed) {
      await upsertPlantCatalog(ctx, preset, now)
    }

    return { success: true, count: plantCatalogSeed.length }
  },
})

export const getUnclaimedDevice = query({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const device = await ctx.db
      .query('devices')
      .withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId))
      .first()
    
    if (!device) return null
    if (device.userId) return null // Already claimed

    return {
      deviceId: device.deviceId,
      name: device.name,
      firmwareVersion: device.firmwareVersion,
    }
  },
})

export const userDevices = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    const devices = await getUserDevices(ctx, user._id)
    return await Promise.all(devices.map((device) => buildDeviceSummary(ctx, device)))
  },
})

export const assignPlantToDevice = mutation({
  args: {
    deviceId: v.string(),
    plantName: v.string(),
    plantSpecies: v.string(),
    growthStage: v.optional(v.union(
      v.literal('seed_dormancy'),
      v.literal('germination'),
      v.literal('seedling_development'),
      v.literal('vegetative_growth'),
      v.literal('flowering_reproduction'),
      v.literal('maturity_senescence'),
    )),
    wateringThreshold: v.optional(v.number()),
    lightingThreshold: v.optional(v.number()),
    lifecycleProfile: v.optional(v.object({
      seedDormancyDays: v.number(),
      germinationDays: v.number(),
      seedlingDevelopmentDays: v.number(),
      vegetativeGrowthDays: v.number(),
      floweringReproductionDays: v.number(),
      maturitySenescenceDays: v.number(),
    })),
    location: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await requireOwnedDevice(ctx, user._id, args.deviceId)
    const now = Date.now()
    const previousPlant = device.plantId ? await ctx.db.get(device.plantId) : null

    if (device.plantId) {
      await archivePlant(ctx, device.plantId, now, user._id, 'Plant replaced')
    }

    const lifecycleProfile = normalizeLifecycleProfile(args.lifecycleProfile)
    const wateringThreshold = args.wateringThreshold ?? device.wateringThreshold
    const lightingThreshold = args.lightingThreshold ?? device.lightingThreshold
    const image = await resolveStoredImageUrl(ctx, args.imageStorageId)

    const plantId = await ctx.db.insert('plants', {
      deviceId: device._id,
      name: args.plantName.trim(),
      species: args.plantSpecies.trim(),
      growthStage: args.growthStage ?? 'seed_dormancy',
      wateringThreshold,
      lightingThreshold,
      lifecycleProfile,
      location: args.location?.trim() || device.name,
      image: image ?? undefined,
      archived: false,
      plantedAt: now,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(device._id, {
      plantId,
      wateringThreshold,
      lightingThreshold,
      updatedAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId,
      userId: user._id,
      source: 'user',
      entityType: 'plant',
      eventType: 'plant_assigned',
      title: previousPlant ? 'Plant changed' : 'Plant assigned',
      detail: `${args.plantName.trim()} is now the active plant on ${device.name}.`,
      data: {
        growthStage: formatPlantStage((args.growthStage ?? 'seed_dormancy') as PlantStageValue),
        wateringThreshold,
        lightingThreshold,
        previousPlant: previousPlant?.name ?? 'none',
      },
      timestamp: now,
    })

    if (image) {
      await recordPlantImage(ctx, {
        plantId,
        deviceId: device._id,
        image,
        source: 'manual',
        capturedAt: now,
      })
    }

    await ctx.db.patch(user._id, {
      setupComplete: true,
      updatedAt: now,
    })

    await ctx.db.insert('userActivities', {
      userId: user._id,
      activityType: 'plant_added',
      points: getActivityPoints('plant_added'),
      relatedId: plantId,
      createdAt: now,
    })

    return { success: true, plantId }
  },
})

export const removeDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await requireOwnedDevice(ctx, user._id, args.deviceId)
    const now = Date.now()

    if (device.plantId) {
      await archivePlant(ctx, device.plantId, now, user._id, 'Plant archived during device removal')
    }

    await ctx.db.patch(device._id, {
      userId: undefined,
      plantId: undefined,
      updatedAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      userId: user._id,
      source: 'user',
      entityType: 'device',
      eventType: 'device_unclaimed',
      title: 'Device removed',
      detail: `${device.name} returned to the unclaimed device pool.`,
      data: {
        deviceId: device.deviceId,
      },
      timestamp: now,
    })

    const remainingDevices = await getUserDevices(ctx, user._id)
    await ctx.db.patch(user._id, {
      setupComplete: remainingDevices.some((ownedDevice) => Boolean(ownedDevice.plantId)),
      updatedAt: now,
    })

    return { success: true }
  },
})

// ============================================
// DASHBOARD QUERY - Computed values
// ============================================

export const dashboard = query({
  args: {
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) return null

    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const notifications = await ctx.db.query('notifications').withIndex('by_user', (q) => q.eq('userId', user._id)).take(8)

    if (!plant || plant.archived) {
      const recentEvents = await getRecentGrowEvents(ctx, device._id, 10)
      return {
        user,
        device: await buildDeviceSummary(ctx, device),
        plant: null,
        sensors: [],
        schedules: [],
        healthComputation: getHealthComputationGuide(),
        notifications,
        reservoirDays: 0,
        alerts: [],
        automationMode: getAutomationModeLabel(device),
        recentEvents,
        automationLogs: [],
        imageHistory: [],
      }
    }

    const rawSensors = await ctx.db
      .query('sensors')
      .withIndex('by_plant', (q) => q.eq('plantId', plant._id))
      .collect()
    const [sensorHistory, recentEvents, automationLogs, imageHistory] = await Promise.all([
      getSensorHistory(ctx, plant._id, 24),
      getRecentGrowEvents(ctx, device._id, 10),
      getRecentAutomationLogs(ctx, plant._id, 8),
      getPlantImageHistory(ctx, plant._id, 8),
    ])

    const sensors = rawSensors.map(s => ({
      _id: s._id,
      kind: s.kind,
      value: s.value,
      unit: s.unit,
      label: getSensorLabel(s.kind as SensorKind),
      status: getSensorStatus(s.kind as SensorKind, s.value),
      target: getSensorTarget(s.kind as SensorKind, s.value, getSensorStatus(s.kind as SensorKind, s.value)),
      accent: getSensorAccent(s.kind as SensorKind),
      sort: getSensorSort(s.kind as SensorKind),
      history: sensorHistory[s.kind as SensorKind] ?? [],
    })).sort((a, b) => a.sort - b.sort)

    const plantHealth = computePlantHealth(rawSensors.map(s => ({ kind: s.kind as SensorKind, value: s.value })))
    const plantProgress = computePlantProgress(plant)
    const waterSensor = rawSensors.find(s => s.kind === 'water')
    const waterLevel = waterSensor?.value || 0
    const dailyUsage = device.autoWatering ? 5 : 2
    const reservoirDays = computeWaterReservoirDays(waterLevel, dailyUsage)

    const alerts = generateAlerts(
      rawSensors.map(s => ({ kind: s.kind as SensorKind, value: s.value })),
      { lastSeen: device.lastSeen, autoWatering: device.autoWatering },
    )

    const schedules = await ctx.db.query('careSchedules').withIndex('by_plant', (q) => q.eq('plantId', plant._id)).take(6)
    const formattedSchedules = schedules.map((schedule) => {
      const summary = formatScheduleSummary(schedule)
      return {
        ...schedule,
        intervalDays: summary.intervalDays,
        intervalHours: summary.intervalHours,
        cadenceUnit: summary.cadence.unit,
        cadenceValue: summary.cadence.value,
        timeOfDayMinutes: summary.cadence.timeOfDayMinutes,
        cadenceLabel: summary.cadenceLabel,
        timeLabel: summary.timeLabel,
        nextRunLabel: getRelativeTime(schedule.nextRunAt),
        lastRunLabel: schedule.lastRunAt ? getRelativeTime(schedule.lastRunAt) : null,
      }
    })

    return {
      user,
      plant: {
        ...plant,
        health: plantHealth,
        healthReason: rawSensors.length
          ? `${rawSensors.filter((sensor) => getSensorStatus(sensor.kind as SensorKind, sensor.value) === 'optimal').length} of ${rawSensors.length} sensors are in the optimal range.`
          : 'No sensor readings are available, so health defaults to poor.',
        growthStageLabel: formatPlantStage(plant.growthStage),
        progress: plantProgress,
      },
      device: await buildDeviceSummary(ctx, device),
      sensors,
      schedules: formattedSchedules,
      healthComputation: getHealthComputationGuide(),
      notifications,
      reservoirDays,
      alerts,
      automationMode: getAutomationModeLabel(device),
      recentEvents,
      automationLogs,
      imageHistory,
    }
  },
})

export const deviceHistory = query({
  args: {
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) return null

    const currentPlant = device.plantId ? await ctx.db.get(device.plantId) : null
    const archivedPlants = await ctx.db
      .query('plants')
      .withIndex('by_device_archived', (q) => q.eq('deviceId', device._id).eq('archived', true))
      .collect()

    const [timeline, imageHistory] = await Promise.all([
      getRecentGrowEvents(ctx, device._id, 5),
      currentPlant && !currentPlant.archived ? getPlantImageHistory(ctx, currentPlant._id, 16) : Promise.resolve([]),
    ])

    if (!currentPlant || currentPlant.archived) {
      return {
        device: await buildDeviceSummary(ctx, device),
        currentPlant: null,
        archivedPlants: archivedPlants
          .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
          .map((plant) => ({
            _id: plant._id,
            name: plant.name,
            species: plant.species,
            growthStage: plant.growthStage,
            location: plant.location,
            plantedAtLabel: formatTimestamp(plant.plantedAt),
            archivedAtLabel: plant.archivedAt ? formatTimestamp(plant.archivedAt) : null,
          })),
        metricHistory: {},
        automationLogs: [],
        timeline,
        imageHistory,
      }
    }

    const [metricHistory, automationLogs] = await Promise.all([
      getSensorHistory(ctx, currentPlant._id, 60),
      getRecentAutomationLogs(ctx, currentPlant._id, 20),
    ])

    return {
      device: await buildDeviceSummary(ctx, device),
      currentPlant: {
        ...currentPlant,
        plantedAtLabel: formatTimestamp(currentPlant.plantedAt),
        growthStageLabel: formatPlantStage(currentPlant.growthStage),
        progress: computePlantProgress(currentPlant),
      },
      archivedPlants: archivedPlants
        .sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
        .map((plant) => ({
          _id: plant._id,
          name: plant.name,
          species: plant.species,
          growthStage: plant.growthStage,
          location: plant.location,
          plantedAtLabel: formatTimestamp(plant.plantedAt),
          archivedAtLabel: plant.archivedAt ? formatTimestamp(plant.archivedAt) : null,
        })),
      metricHistory,
      automationLogs,
      timeline,
      imageHistory,
    }
  },
})

// ============================================
// ASSISTANT QUERY - Computed recommendations
// ============================================

export const assistant = query({
  args: {
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    const plant = device?.plantId ? await ctx.db.get(device.plantId) : null
    const thread = await getAssistantThread(ctx, user._id)

    const [rawMessages, supportRequests, schedules, sensors] = await Promise.all([
      thread
        ? getAssistantMessages(ctx, thread._id, 40)
        : Promise.resolve([]),
      ctx.db.query('supportRequests').withIndex('by_user', (q) => q.eq('userId', user._id)).take(50),
      plant && !plant.archived
        ? ctx.db.query('careSchedules').withIndex('by_plant', (q) => q.eq('plantId', plant._id)).take(3)
        : Promise.resolve([]),
      plant && !plant.archived
        ? ctx.db.query('sensors').withIndex('by_plant', (q) => q.eq('plantId', plant._id)).collect()
        : Promise.resolve([]),
    ])
    const quota = thread
      ? await getAssistantUsage(ctx, thread._id, user.tier)
      : {
          usedToday: 0,
          limit: getAssistantMessageLimit(user.tier),
          remainingToday: getAssistantMessageLimit(user.tier),
          resetsAt: getStartOfToday() + 24 * 60 * 60 * 1000,
        }

    const messages = rawMessages.map((m) => ({
      ...m,
      createdAtLabel: formatTimestamp(m.createdAt),
    }))

    const supportThreads = await Promise.all(
      supportRequests
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (request) => ({
          ...request,
          createdAtLabel: formatTimestamp(request.createdAt),
          updatedAtLabel: formatTimestamp(request.updatedAt),
          messages: (await getSupportMessages(ctx, request._id, 20)).map((message) => ({
            ...message,
            createdAtLabel: formatTimestamp(message.createdAt),
            mine: String(message.senderUserId) === String(user._id),
          })),
        })),
    )

    const recommendations: Array<{ sort: number; title: string; detail: string; accent: string }> = []
    let sort = 0

    if (!device) {
      recommendations.push({
        sort: sort++,
        title: 'Add your first device',
        detail: 'Claim a GrowMate pod to start getting device-specific coaching.',
        accent: 'bg-[#cae6ff] text-[#006493]',
      })
    } else if (!plant || plant.archived) {
      recommendations.push({
        sort: sort++,
        title: 'Choose a plant',
        detail: `Assign a plant to ${device.name} so Floral Assistant can tailor care tips.`,
        accent: 'bg-[#ffdbcf] text-[#795548]',
      })
    } else {
      for (const sensor of sensors) {
        const status = getSensorStatus(sensor.kind as SensorKind, sensor.value)

        if (sensor.kind === 'soil' && status === 'low') {
          recommendations.push({
            sort: sort++,
            title: 'Watering Needed',
            detail: `${plant.name} is thirsty. Schedule a watering cycle soon.`,
            accent: 'bg-[#cae6ff] text-[#006493]',
          })
        }

        if (sensor.kind === 'water' && sensor.value < 20) {
          recommendations.push({
            sort: sort++,
            title: 'Refill Reservoir',
            detail: `${device.name} is running low on water reserve.`,
            accent: 'bg-[#ffdbcf] text-[#795548]',
          })
        }

        if (sensor.kind === 'temperature' && status === 'high') {
          recommendations.push({
            sort: sort++,
            title: 'Cool the canopy',
            detail: `Temperature around ${plant.name} is elevated. Improve airflow or shade.`,
            accent: 'bg-[#ffdbcf] text-[#795548]',
          })
        }
      }
    }

    if (user.tier === 'basic') {
      recommendations.push({
        sort: sort++,
        title: 'Upgrade to Advanced',
        detail: 'Get AI-powered insights and priority support.',
        accent: 'bg-[#94f990]/40 text-[#005313]',
      })
    }

    const careNotifications = [
      ...(device ? [`Active device: ${device.name}`] : ['No active device selected yet']),
      ...schedules.map((schedule) => `${schedule.title} is scheduled for ${formatTimestamp(schedule.nextRunAt)}`),
      ...supportRequests.slice(0, 1).map((request) => `Support request "${request.topic}" is ${request.status.replace('_', ' ')}`),
    ].slice(0, 3)

    return {
      user,
      device: device ? await buildDeviceSummary(ctx, device) : null,
      plant: plant && !plant.archived ? plant : null,
      thread: {
        ...(thread ?? { title: 'Floral Assistant Chat' }),
        assistantName: 'Floral Assistant',
        mood: device ? 'Focused on your active device' : 'Waiting for your first pod',
      },
      messages,
      supportRequests: supportThreads,
      recommendations,
      careNotifications,
      quota,
    }
  },
})

export const supportInbox = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const supportRequests = await ctx.db
      .query('supportRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .take(50)

    const supportThreads = await Promise.all(
      supportRequests
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (request) => ({
          ...request,
          createdAtLabel: formatTimestamp(request.createdAt),
          updatedAtLabel: formatTimestamp(request.updatedAt),
          messages: (await getSupportMessages(ctx, request._id, 40)).map((message) => ({
            ...message,
            createdAtLabel: formatTimestamp(message.createdAt),
            mine: String(message.senderUserId) === String(user._id),
          })),
        })),
    )

    return {
      requests: supportThreads,
      activeCount: supportThreads.filter((request) => request.status !== 'resolved' && request.status !== 'closed').length,
    }
  },
})

export const marketplace = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    const [officialProducts, communityProducts, listingDrafts, userListings, marketplaceThreads] = user
      ? await Promise.all([
          ctx.db.query('products').withIndex('by_type_and_status', (q) => q.eq('type', 'official').eq('status', 'active')).take(8),
          ctx.db.query('products').withIndex('by_type_and_status', (q) => q.eq('type', 'community').eq('status', 'active')).take(24),
          ctx.db.query('listingDrafts').withIndex('by_user', (q) => q.eq('userId', user._id)).take(6),
          ctx.db.query('products').withIndex('by_seller_and_type', (q) => q.eq('sellerId', user._id).eq('type', 'community')).take(12),
          getMarketplaceThreadsForUser(ctx, user._id),
        ])
      : [
          await ctx.db.query('products').withIndex('by_type_and_status', (q) => q.eq('type', 'official').eq('status', 'active')).take(8),
          await ctx.db.query('products').withIndex('by_type_and_status', (q) => q.eq('type', 'community').eq('status', 'active')).take(24),
          [],
          [],
          [],
        ]

    const [official, community, myListings] = await Promise.all([
      Promise.all(officialProducts.map((product) => enrichMarketplaceProduct(ctx, product, user?._id))),
      Promise.all(communityProducts.map((product) => enrichMarketplaceProduct(ctx, product, user?._id))),
      Promise.all(userListings.map((product) => enrichMarketplaceProduct(ctx, product, user?._id))),
    ])

    return {
      official,
      community,
      featured: official.find((product) => product.featured) ?? official[0] ?? null,
      listingDrafts: await Promise.all(listingDrafts.map(async (draft) => ({
        ...draft,
        image: (await resolveStoredImageUrl(ctx, draft.imageStorageId, draft.image)) ?? draft.image,
        quantityLabel: `${draft.quantity} ${draft.quantityUnit}`,
        priceLabel: `${formatCurrencyIdr(draft.price)} / ${draft.priceUnit}`,
        statusLabel: draft.status[0]!.toUpperCase() + draft.status.slice(1),
      }))),
      myListings,
      threads: marketplaceThreads,
    }
  },
})

export const community = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    const users = await ctx.db.query('users').take(10)
    const posts = await ctx.db.query('communityPosts').withIndex('by_createdAt').order('desc').take(12)

    const postsWithCounts = await Promise.all(posts.map((post) => getCommunityPostView(ctx, post, user?._id)))

    const usersWithPoints = await Promise.all(
      users.map(async (user) => {
        const activities = await ctx.db.query('userActivities').withIndex('by_user', (q) => q.eq('userId', user._id)).collect()
        const activityPoints = activities.reduce((total, activity) => total + activity.points, 0)
        const plantPoints = await computeUserPlantPoints(ctx, user._id)
        const points = activityPoints + plantPoints
        return { ...user, points }
      }),
    )

    return {
      posts: postsWithCounts,
      leaderboard: usersWithPoints.sort((a, b) => b.points - a.points).slice(0, 3),
      fullLeaderboard: usersWithPoints.sort((a, b) => b.points - a.points).slice(0, 6),
      viewerId: user?._id ?? null,
    }
  },
})

export const updateUserTier = mutation({
  args: {
    userId: v.id('users'),
    tier: v.union(v.literal('basic'), v.literal('advanced')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    await ctx.db.patch(args.userId, { tier: args.tier, updatedAt: Date.now() })
    return { success: true }
  },
})

export const toggleCareSchedule = mutation({
  args: { scheduleId: v.id('careSchedules'), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) {
      throw new Error('Schedule not found')
    }

    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) {
      throw new Error('Plant not found')
    }

    const device = await ctx.db.get(plant.deviceId)
    if (!device || device.userId !== user._id) {
      throw new Error('Schedule not found')
    }

    await ctx.db.patch(args.scheduleId, { enabled: args.enabled })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_toggled',
      title: args.enabled ? 'Schedule enabled' : 'Schedule paused',
      detail: `${schedule.title} was ${args.enabled ? 'enabled' : 'paused'}.`,
      data: {
        enabled: args.enabled,
      },
      timestamp: Date.now(),
    })

    return { success: true }
  },
})

export const saveCareSchedule = mutation({
  args: {
    scheduleId: v.optional(v.id('careSchedules')),
    deviceId: v.optional(v.string()),
    title: v.string(),
    cadenceUnit: v.union(v.literal('hours'), v.literal('days')),
    cadenceValue: v.number(),
    timeOfDayMinutes: v.optional(v.number()),
    timezoneOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device || !device.plantId) {
      throw new Error('Device with active plant not found')
    }

    const plant = await ctx.db.get(device.plantId)
    if (!plant || plant.archived) {
      throw new Error('Plant not found')
    }

    const now = Date.now()
    const title = args.title.trim()
    if (!title) {
      throw new Error('Schedule title is required')
    }

    const cadence = normalizeScheduleCadence({
      cadenceUnit: args.cadenceUnit,
      cadenceValue: args.cadenceValue,
      timeOfDayMinutes: args.timeOfDayMinutes,
      timezoneOffsetMinutes: args.timezoneOffsetMinutes,
    })
    const legacy = getLegacyScheduleInterval(cadence)
    const nextRunAt = computeNextRunAtFromCadence(cadence, now)
    let scheduleId = args.scheduleId

    if (scheduleId) {
      const existing = await ctx.db.get(scheduleId)
      if (!existing || String(existing.plantId) !== String(plant._id)) {
        throw new Error('Schedule not found')
      }

      await ctx.db.patch(scheduleId, {
        title,
        cadenceUnit: cadence.unit,
        cadenceValue: cadence.value,
        timeOfDayMinutes: cadence.timeOfDayMinutes ?? undefined,
        timezoneOffsetMinutes: cadence.timezoneOffsetMinutes,
        intervalDays: legacy.intervalDays,
        intervalHours: legacy.intervalHours,
        nextRunAt,
      })
    } else {
      scheduleId = await ctx.db.insert('careSchedules', {
        plantId: plant._id,
        title,
        cadenceUnit: cadence.unit,
        cadenceValue: cadence.value,
        timeOfDayMinutes: cadence.timeOfDayMinutes ?? undefined,
        timezoneOffsetMinutes: cadence.timezoneOffsetMinutes,
        intervalDays: legacy.intervalDays,
        intervalHours: legacy.intervalHours,
        nextRunAt,
        enabled: true,
        createdAt: now,
      })
    }

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_saved',
      title: args.scheduleId ? 'Schedule updated' : 'Schedule created',
      detail: `${title} now runs ${formatScheduleCadence(cadence).toLowerCase()}.`,
      data: {
        cadenceValue: cadence.value,
        cadenceHours: cadence.unit === 'hours' ? cadence.value : cadence.value * 24,
        cadenceUnit: cadence.unit,
      },
      timestamp: now,
    })

    return { success: true, scheduleId }
  },
})

export const deleteCareSchedule = mutation({
  args: {
    scheduleId: v.id('careSchedules'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) {
      throw new Error('Schedule not found')
    }

    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) {
      throw new Error('Plant not found')
    }

    const device = await ctx.db.get(plant.deviceId)
    if (!device || device.userId !== user._id) {
      throw new Error('Schedule not found')
    }

    await ctx.db.delete(args.scheduleId)

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_saved',
      title: 'Schedule deleted',
      detail: `${schedule.title} was removed.`,
      timestamp: Date.now(),
    })

    return { success: true }
  },
})

export const completeCareScheduleRun = mutation({
  args: {
    scheduleId: v.id('careSchedules'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) {
      throw new Error('Schedule not found')
    }

    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) {
      throw new Error('Plant not found')
    }

    const device = await ctx.db.get(plant.deviceId)
    if (!device || device.userId !== user._id) {
      throw new Error('Schedule not found')
    }

    const now = Date.now()
    const cadence = normalizeScheduleCadence(schedule)
    const nextRunAt = computeNextRunAtFromCadence(cadence, Math.max(now, schedule.nextRunAt))

    await ctx.db.patch(args.scheduleId, {
      lastRunAt: now,
      nextRunAt,
    })

    await recordAutomationEvent(ctx, {
      deviceId: device.deviceId,
      plantId: plant._id,
      action: 'schedule_completed',
      timestamp: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_completed',
      title: 'Scheduled task completed',
      detail: `${schedule.title} was marked done and rolled forward.`,
      timestamp: now,
    })

    return { success: true, nextRunAt }
  },
})

export const triggerWatering = mutation({
  args: {
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const now = Date.now()

    await ctx.db.patch(device._id, {
      lastWatered: now,
      updatedAt: now,
    })

    if (plant && !plant.archived) {
        await recordAutomationEvent(ctx, {
          deviceId: device.deviceId,
          plantId: plant._id,
          action: 'manual_pump',
          duration: getDeviceWateringDuration(device),
          timestamp: now,
        })

      await recordGrowEvent(ctx, {
        deviceId: device._id,
        plantId: plant._id,
        userId: user._id,
        source: 'user',
        entityType: 'automation',
        eventType: 'manual_watering_triggered',
        title: 'Manual watering triggered',
        detail: `${device.name} started a manual watering cycle.`,
        data: {
          duration: getDeviceWateringDuration(device),
        },
        timestamp: now,
      })
    }

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Manual watering triggered',
      detail: `${device.name} started a manual watering cycle successfully.`,
      kind: 'system',
      read: false,
      createdAt: now,
    })
    return { success: true }
  },
})

export const triggerLighting = mutation({
  args: {
    deviceId: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const now = Date.now()

    await ctx.db.patch(device._id, {
      lightEnabled: args.enabled,
      lastLightChange: now,
      updatedAt: now,
    })

    if (plant && !plant.archived) {
      await recordAutomationEvent(ctx, {
        deviceId: device.deviceId,
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
        title: args.enabled ? 'Manual lighting enabled' : 'Manual lighting disabled',
        detail: `${device.name} grow light was manually ${args.enabled ? 'turned on' : 'turned off'}.`,
        data: {
          enabled: args.enabled,
        },
        timestamp: now,
      })
    }

    return { success: true, enabled: args.enabled }
  },
})

export const assistantTriggerWatering = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error('User not found')
    }

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const now = Date.now()

    await ctx.db.patch(device._id, {
      lastWatered: now,
      updatedAt: now,
    })

    if (plant && !plant.archived) {
      await recordAutomationEvent(ctx, {
        deviceId: device.deviceId,
        plantId: plant._id,
        action: 'manual_pump',
        duration: getDeviceWateringDuration(device),
        timestamp: now,
      })

      await recordGrowEvent(ctx, {
        deviceId: device._id,
        plantId: plant._id,
        userId: user._id,
        source: 'user',
        entityType: 'automation',
        eventType: 'manual_watering_triggered',
        title: 'Manual watering triggered',
        detail: `${device.name} started a manual watering cycle.`,
        data: {
          duration: getDeviceWateringDuration(device),
        },
        timestamp: now,
      })
    }

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Manual watering triggered',
      detail: `${device.name} started a manual watering cycle successfully.`,
      kind: 'system',
      read: false,
      createdAt: now,
    })

    return { success: true, deviceName: device.name }
  },
})

export const assistantTriggerLighting = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error('User not found')
    }

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const plant = device.plantId ? await ctx.db.get(device.plantId) : null
    const now = Date.now()

    await ctx.db.patch(device._id, {
      lightEnabled: args.enabled,
      lastLightChange: now,
      updatedAt: now,
    })

    if (plant && !plant.archived) {
      await recordAutomationEvent(ctx, {
        deviceId: device.deviceId,
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
        title: args.enabled ? 'Manual lighting enabled' : 'Manual lighting disabled',
        detail: `${device.name} grow light was manually ${args.enabled ? 'turned on' : 'turned off'}.`,
        data: {
          enabled: args.enabled,
        },
        timestamp: now,
      })
    }

    return { success: true, enabled: args.enabled, deviceName: device.name }
  },
})

export const assistantCreateSupportRequest = internalMutation({
  args: {
    userId: v.id('users'),
    topic: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error('User not found')
    }

    const topic = args.topic.trim()
    if (!topic) {
      throw new Error('Support topic is required')
    }

    const now = Date.now()
    const requestId = await ctx.db.insert('supportRequests', {
      userId: user._id,
      topic,
      status: 'open',
      priority: 'normal',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('supportMessages', {
      requestId,
      senderUserId: user._id,
      senderRole: 'user',
      body: topic,
      createdAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Support request opened',
      detail: `We queued your request about ${topic.toLowerCase()}.`,
      kind: 'assistant',
      read: false,
      createdAt: now,
    })

    return { success: true, requestId, topic }
  },
})

export const assistantToggleSchedule = internalMutation({
  args: {
    userId: v.id('users'),
    scheduleId: v.id('careSchedules'),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error('User not found')
    }

    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) {
      throw new Error('Schedule not found')
    }

    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) {
      throw new Error('Plant not found')
    }

    const device = await ctx.db.get(plant.deviceId)
    if (!device || String(device.userId) !== String(user._id)) {
      throw new Error('Schedule not found')
    }

    await ctx.db.patch(args.scheduleId, { enabled: args.enabled })
    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_toggled',
      title: args.enabled ? 'Schedule enabled' : 'Schedule paused',
      detail: `${schedule.title} was ${args.enabled ? 'enabled' : 'paused'}.`,
      data: { enabled: args.enabled },
      timestamp: Date.now(),
    })

    return { success: true, title: schedule.title, enabled: args.enabled }
  },
})

export const assistantDeleteSchedule = internalMutation({
  args: {
    userId: v.id('users'),
    scheduleId: v.id('careSchedules'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error('User not found')
    }

    const schedule = await ctx.db.get(args.scheduleId)
    if (!schedule) {
      throw new Error('Schedule not found')
    }
    const plant = await ctx.db.get(schedule.plantId)
    if (!plant) {
      throw new Error('Plant not found')
    }
    const device = await ctx.db.get(plant.deviceId)
    if (!device || String(device.userId) !== String(user._id)) {
      throw new Error('Schedule not found')
    }

    await ctx.db.delete(args.scheduleId)
    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_saved',
      title: 'Schedule deleted',
      detail: `${schedule.title} was removed.`,
      timestamp: Date.now(),
    })
    return { success: true, title: schedule.title }
  },
})

export const assistantCreateSchedule = internalMutation({
  args: {
    userId: v.id('users'),
    deviceId: v.optional(v.string()),
    title: v.string(),
    cadenceUnit: v.union(v.literal('hours'), v.literal('days')),
    cadenceValue: v.number(),
    timeOfDayMinutes: v.optional(v.number()),
    timezoneOffsetMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId)
    if (!user) {
      throw new Error('User not found')
    }
    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    if (!device || !device.plantId) {
      throw new Error('Device with active plant not found')
    }
    const plant = await ctx.db.get(device.plantId)
    if (!plant || plant.archived) {
      throw new Error('Plant not found')
    }
    const now = Date.now()
    const title = args.title.trim()
    if (!title) {
      throw new Error('Schedule title is required')
    }
    const cadence = normalizeScheduleCadence(args)
    const legacy = getLegacyScheduleInterval(cadence)
    const nextRunAt = computeNextRunAtFromCadence(cadence, now)
    const scheduleId = await ctx.db.insert('careSchedules', {
      plantId: plant._id,
      title,
      cadenceUnit: cadence.unit,
      cadenceValue: cadence.value,
      timeOfDayMinutes: cadence.timeOfDayMinutes ?? undefined,
      timezoneOffsetMinutes: cadence.timezoneOffsetMinutes,
      intervalDays: legacy.intervalDays,
      intervalHours: legacy.intervalHours,
      nextRunAt,
      enabled: true,
      createdAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: device._id,
      plantId: plant._id,
      userId: user._id,
      source: 'user',
      entityType: 'schedule',
      eventType: 'care_schedule_saved',
      title: 'Schedule created',
      detail: `${title} now runs ${formatScheduleCadence(cadence).toLowerCase()}.`,
      data: {
        cadenceValue: cadence.value,
        cadenceHours: cadence.unit === 'hours' ? cadence.value : cadence.value * 24,
        cadenceUnit: cadence.unit,
      },
      timestamp: now,
    })

    return { success: true, scheduleId, title, cadenceLabel: formatScheduleCadence(cadence) }
  },
})

export const sendAssistantMessage = mutation({
  args: {
    body: v.string(),
    deviceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()

    let thread = await getAssistantThread(ctx, user._id)
    if (!thread) {
      const threadId = await ctx.db.insert('assistantThreads', {
        userId: user._id,
        title: 'Floral Assistant Chat',
        createdAt: now,
        updatedAt: now,
      })
      thread = await ctx.db.get(threadId)
    }

    if (!thread) {
      throw new Error('Unable to start assistant thread')
    }

    const trimmedBody = args.body.trim()
    if (!trimmedBody) {
      throw new Error('Message cannot be empty')
    }

    const quota = await getAssistantUsage(ctx, thread._id, user.tier)
    if (quota.remainingToday <= 0) {
      throw new Error(`Daily assistant limit reached. ${quota.limit} messages per day on your current plan.`)
    }

    await ctx.db.insert('assistantMessages', {
      threadId: thread._id,
      role: 'user',
      body: trimmedBody,
      status: 'complete',
      createdAt: now,
    })

    const assistantMessageId = await ctx.db.insert('assistantMessages', {
      threadId: thread._id,
      role: 'assistant',
      body: '',
      status: 'streaming',
      createdAt: now + 1,
    })

    const device = await getSelectedDevice(ctx, user._id, args.deviceId)
    const plant = device?.plantId ? await ctx.db.get(device.plantId) : null
    const [chatHistory, assistantContext] = await Promise.all([
      getAssistantMessages(ctx, thread._id, 24),
      buildAssistantContext(ctx, user, device, plant),
    ])

    await ctx.scheduler.runAfter(0, internal.openai.generateAIResponse, {
      threadId: thread._id,
      assistantMessageId,
      userId: user._id,
      deviceId: device?.deviceId,
      chatHistory: chatHistory.map((message) => ({
        role: message.role,
        body: message.body,
        createdAt: message.createdAt,
      })),
      context: assistantContext,
    })

    await ctx.db.patch(thread._id, { updatedAt: now })
    return {
      success: true,
      quota: {
        usedToday: quota.usedToday + 1,
        limit: quota.limit,
        remainingToday: Math.max(0, quota.remainingToday - 1),
        resetsAt: quota.resetsAt,
      },
    }
  },
})

export const insertAIResponse = internalMutation({
  args: {
    assistantMessageId: v.id('assistantMessages'),
    body: v.string(),
    status: v.union(v.literal('streaming'), v.literal('complete'), v.literal('error')),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.assistantMessageId, {
      body: args.body,
      status: args.status,
    })
    return { success: true }
  },
})

export const resetAssistantThread = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const thread = await getAssistantThread(ctx, user._id)
    if (!thread) {
      return { success: true }
    }

    let batch = await ctx.db
      .query('assistantMessages')
      .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
      .take(64)

    while (batch.length > 0) {
      for (const message of batch) {
        await ctx.db.delete(message._id)
      }

      batch = await ctx.db
        .query('assistantMessages')
        .withIndex('by_thread', (q) => q.eq('threadId', thread._id))
        .take(64)
    }

    await ctx.db.delete(thread._id)
    return { success: true }
  },
})

export const saveMarketplaceDraft = mutation({
  args: {
    draftId: v.optional(v.id('listingDrafts')),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    quantity: v.number(),
    quantityUnit: v.string(),
    price: v.number(),
    priceUnit: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    locationLabel: v.string(),
    contactPreference: v.union(v.literal('chat'), v.literal('pickup'), v.literal('delivery')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()
    if (!args.title.trim() || !args.description.trim() || !args.category.trim()) {
      throw new Error('Title, description, and category are required')
    }
    if (args.quantity <= 0) {
      throw new Error('Quantity must be greater than zero')
    }
    if (args.price < 0) {
      throw new Error('Price cannot be negative')
    }
    let image = await resolveStoredImageUrl(ctx, args.imageStorageId)
    let imageStorageId = args.imageStorageId

    if (args.draftId) {
      const existing = await ctx.db.get(args.draftId)
      if (!existing || String(existing.userId) !== String(user._id)) {
        throw new Error('Draft not found')
      }
      image = image ?? existing.image
      imageStorageId = imageStorageId ?? existing.imageStorageId
    }

    if (!image) {
      throw new Error('Listing image is required')
    }

    const payload = {
      userId: user._id,
      title: args.title.trim(),
      description: args.description.trim(),
      category: args.category.trim(),
      quantity: args.quantity,
      quantityUnit: args.quantityUnit.trim(),
      price: args.price,
      priceUnit: args.priceUnit.trim(),
      image,
      imageStorageId,
      locationLabel: args.locationLabel.trim(),
      contactPreference: args.contactPreference,
      updatedAt: now,
    }

    if (args.draftId) {
      await ctx.db.patch(args.draftId, payload)
      return { success: true, draftId: args.draftId }
    }

    const draftId = await ctx.db.insert('listingDrafts', {
      ...payload,
      status: 'draft',
      createdAt: now,
    })
    return { success: true, draftId }
  },
})

export const publishMarketplaceDraft = mutation({
  args: { draftId: v.id('listingDrafts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const draft = await ctx.db.get(args.draftId)
    if (!draft || String(draft.userId) !== String(user._id)) {
      throw new Error('Draft not found')
    }
    if (draft.quantity <= 0) {
      throw new Error('Draft quantity must be greater than zero before publishing')
    }

    const now = Date.now()
    const productId = await ctx.db.insert('products', {
      title: draft.title,
      description: draft.description,
      price: draft.price,
      category: draft.category,
      type: 'community',
      sellerId: user._id,
      status: 'active',
      quantityAvailable: draft.quantity,
      quantityUnit: draft.quantityUnit,
      priceUnit: draft.priceUnit,
      locationLabel: draft.locationLabel,
      sellerNote: draft.description,
      contactPreference: draft.contactPreference,
      rating: 4.8,
      distanceMiles: undefined,
      image: draft.image,
      imageStorageId: draft.imageStorageId,
      featured: false,
      shopeeUrl: undefined,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(args.draftId, { status: 'published', updatedAt: now })

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Listing published',
      detail: `${draft.title} is now live in the marketplace.`,
      kind: 'commerce',
      read: false,
      createdAt: now,
    })

    return { success: true, productId }
  },
})

export const updateMarketplaceListingStatus = mutation({
  args: {
    productId: v.id('products'),
    status: v.union(v.literal('active'), v.literal('reserved'), v.literal('sold'), v.literal('archived')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || String(product.sellerId) !== String(user._id) || product.type !== 'community') {
      throw new Error('Listing not found')
    }

    await ctx.db.patch(args.productId, {
      status: args.status,
      updatedAt: Date.now(),
    })
    return { success: true }
  },
})

export const updateMarketplaceListing = mutation({
  args: {
    productId: v.id('products'),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    quantity: v.number(),
    quantityUnit: v.string(),
    price: v.number(),
    priceUnit: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    locationLabel: v.string(),
    contactPreference: v.union(v.literal('chat'), v.literal('pickup'), v.literal('delivery')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || String(product.sellerId) !== String(user._id) || product.type !== 'community') {
      throw new Error('Listing not found')
    }

    if (!args.title.trim() || !args.description.trim() || !args.category.trim()) {
      throw new Error('Title, description, and category are required')
    }
    if (args.quantity <= 0) {
      throw new Error('Quantity must be greater than zero')
    }
    if (args.price < 0) {
      throw new Error('Price cannot be negative')
    }

    const image = (await resolveStoredImageUrl(ctx, args.imageStorageId)) ?? product.image
    const imageStorageId = args.imageStorageId ?? product.imageStorageId

    await ctx.db.patch(args.productId, {
      title: args.title.trim(),
      description: args.description.trim(),
      category: args.category.trim(),
      quantityAvailable: args.quantity,
      quantityUnit: args.quantityUnit.trim(),
      price: args.price,
      priceUnit: args.priceUnit.trim(),
      image,
      imageStorageId,
      locationLabel: args.locationLabel.trim(),
      sellerNote: args.description.trim(),
      contactPreference: args.contactPreference,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const deleteMarketplaceDraft = mutation({
  args: { draftId: v.id('listingDrafts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const draft = await ctx.db.get(args.draftId)
    if (!draft || String(draft.userId) !== String(user._id)) {
      throw new Error('Draft not found')
    }

    await ctx.db.delete(args.draftId)
    return { success: true }
  },
})

export const deleteMarketplaceListing = mutation({
  args: { productId: v.id('products') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || String(product.sellerId) !== String(user._id) || product.type !== 'community') {
      throw new Error('Listing not found')
    }

    const threads = await ctx.db.query('marketplaceThreads').withIndex('by_product', (q) => q.eq('productId', args.productId)).take(64)
    for (const thread of threads) {
      const messages = await ctx.db.query('marketplaceMessages').withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id)).take(128)
      for (const message of messages) {
        await ctx.db.delete(message._id)
      }
      await ctx.db.delete(thread._id)
    }

    await ctx.db.delete(args.productId)
    return { success: true }
  },
})

export const createPost = mutation({
  args: { title: v.string(), body: v.string(), imageStorageId: v.optional(v.id('_storage')) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()
    const title = args.title.trim()
    const body = args.body.trim()
    if (!title || !body) {
      throw new Error('Title and body are required')
    }
    const image = await resolveStoredImageUrl(ctx, args.imageStorageId)
    const postId = await ctx.db.insert('communityPosts', {
      userId: user._id,
      title,
      body,
      image: image ?? undefined,
      imageStorageId: args.imageStorageId,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('userActivities', {
      userId: user._id,
      activityType: 'post_created',
      points: getActivityPoints('post_created'),
      relatedId: postId,
      createdAt: now,
    })

    return { success: true }
  },
})

export const likePost = mutation({
  args: { postId: v.id('communityPosts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const existing = await ctx.db.query('postLikes').withIndex('by_user_and_post', (q) => q.eq('userId', user._id).eq('postId', args.postId)).first()

    if (existing) {
      await ctx.db.delete(existing._id)
      return { success: true, liked: false }
    }

    const now = Date.now()
    await ctx.db.insert('postLikes', {
      postId: args.postId,
      userId: user._id,
      createdAt: now,
    })

    await ctx.db.insert('userActivities', {
      userId: user._id,
      activityType: 'post_liked',
      points: getActivityPoints('post_liked'),
      relatedId: args.postId,
      createdAt: now,
    })

    return { success: true, liked: true }
  },
})

export const createComment = mutation({
  args: { postId: v.id('communityPosts'), body: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()
    const body = args.body.trim()
    if (!body) {
      throw new Error('Comment cannot be empty')
    }
    const commentId = await ctx.db.insert('postComments', {
      postId: args.postId,
      userId: user._id,
      body,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('userActivities', {
      userId: user._id,
      activityType: 'comment_created',
      points: getActivityPoints('comment_created'),
      relatedId: commentId,
      createdAt: now,
    })

    return { success: true }
  },
})

export const deletePost = mutation({
  args: { postId: v.id('communityPosts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || String(post.userId) !== String(user._id)) {
      throw new Error('Post not found')
    }

    const [likes, comments] = await Promise.all([
      ctx.db.query('postLikes').withIndex('by_post', (q) => q.eq('postId', args.postId)).collect(),
      ctx.db.query('postComments').withIndex('by_post', (q) => q.eq('postId', args.postId)).collect(),
    ])

    for (const like of likes) {
      await ctx.db.delete(like._id)
    }

    for (const comment of comments) {
      await ctx.db.delete(comment._id)
    }

    await ctx.db.delete(args.postId)
    return { success: true }
  },
})

export const sharePost = mutation({
  args: { postId: v.id('communityPosts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const post = await ctx.db.get(args.postId)
    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Post shared',
      detail: `${post?.title ?? 'This post'} has been shared successfully.`,
      kind: 'social',
      read: false,
      createdAt: Date.now(),
    })
    return { success: true }
  },
})

export const createSupportRequest = mutation({
  args: {
    topic: v.string(),
    priority: v.optional(v.union(v.literal('low'), v.literal('normal'), v.literal('high'), v.literal('urgent'))),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const topic = args.topic.trim()
    if (!topic) {
      throw new Error('Support topic is required')
    }

    const now = Date.now()
    const requestId = await ctx.db.insert('supportRequests', {
      userId: user._id,
      topic,
      status: 'open',
      priority: args.priority ?? 'normal',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('supportMessages', {
      requestId,
      senderUserId: user._id,
      senderRole: 'user',
      body: topic,
      createdAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Support request opened',
      detail: `We queued your request about ${topic.toLowerCase()}.`,
      kind: 'assistant',
      read: false,
      createdAt: now,
    })

    return { success: true, requestId }
  },
})

export const sendSupportMessage = mutation({
  args: {
    requestId: v.id('supportRequests'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request) {
      throw new Error('Support request not found')
    }

    const isAdmin = user.role === 'admin'
    const isOwner = String(request.userId) === String(user._id)
    if (!isAdmin && !isOwner) {
      throw new Error('Support request not found')
    }

    const body = args.body.trim()
    if (!body) {
      throw new Error('Message cannot be empty')
    }

    const now = Date.now()
    await ctx.db.insert('supportMessages', {
      requestId: args.requestId,
      senderUserId: user._id,
      senderRole: isAdmin ? 'admin' : 'user',
      body,
      createdAt: now,
    })

    await ctx.db.patch(args.requestId, {
      updatedAt: now,
      status: isAdmin ? 'in_progress' : request.status === 'closed' ? 'open' : request.status,
      handledBy: isAdmin ? user._id : request.handledBy,
      respondedAt: isAdmin ? now : request.respondedAt,
      response: isAdmin ? body : request.response,
    })

    const receiverId = isAdmin ? request.userId : request.handledBy
    if (receiverId && String(receiverId) !== String(user._id)) {
      await ctx.db.insert('notifications', {
        userId: receiverId,
        title: isAdmin ? 'Support team replied' : 'New support reply',
        detail: isAdmin ? 'An admin responded to your support ticket.' : 'A new message was added to a support ticket.',
        kind: 'assistant',
        read: false,
        createdAt: now,
      })
    }

    return { success: true }
  },
})

export const closeSupportRequest = mutation({
  args: {
    requestId: v.id('supportRequests'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request || String(request.userId) !== String(user._id)) {
      throw new Error('Support request not found')
    }

    const now = Date.now()
    await ctx.db.patch(args.requestId, {
      status: 'closed',
      resolvedAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('supportMessages', {
      requestId: args.requestId,
      senderUserId: user._id,
      senderRole: 'system',
      body: 'Ticket closed by user.',
      createdAt: now,
    })

    if (request.handledBy) {
      await ctx.db.insert('notifications', {
        userId: request.handledBy,
        title: 'Support ticket closed',
        detail: `${user.name ?? 'A user'} closed their support ticket.`,
        kind: 'assistant',
        read: false,
        createdAt: now,
      })
    }

    return { success: true }
  },
})

export const sendMarketplaceMessage = mutation({
  args: {
    productId: v.id('products'),
    threadId: v.optional(v.id('marketplaceThreads')),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || product.type !== 'community') {
      throw new Error('Listing not found')
    }
    if (String(product.sellerId) === String(user._id)) {
      throw new Error('Sellers cannot start a thread with their own listing')
    }

    const now = Date.now()
    const body = args.body.trim()
    if (!body) {
      throw new Error('Message cannot be empty')
    }

    let thread = args.threadId ? await ctx.db.get(args.threadId) : null
    if (!thread) {
      thread = await ctx.db.query('marketplaceThreads').withIndex('by_product_and_buyer', (q) => q.eq('productId', args.productId).eq('buyerId', user._id)).first()
    }

    let threadId = thread?._id
    if (!threadId) {
      threadId = await ctx.db.insert('marketplaceThreads', {
        productId: args.productId,
        buyerId: user._id,
        sellerId: product.sellerId,
        lastMessagePreview: body.slice(0, 160),
        lastMessageAt: now,
        buyerUnreadCount: 0,
        sellerUnreadCount: 1,
        createdAt: now,
        updatedAt: now,
      })
    } else {
      await ctx.db.patch(threadId, {
        lastMessagePreview: body.slice(0, 160),
        lastMessageAt: now,
        sellerUnreadCount: (thread?.sellerUnreadCount ?? 0) + 1,
        updatedAt: now,
      })
    }

    await ctx.db.insert('marketplaceMessages', {
      threadId,
      senderId: user._id,
      body,
      createdAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: product.sellerId,
      title: 'New marketplace inquiry',
      detail: `${user.name ?? 'A buyer'} messaged you about ${product.title}.`,
      kind: 'commerce',
      read: false,
      createdAt: now,
    })

    return { success: true, threadId }
  },
})

export const replyMarketplaceThread = mutation({
  args: {
    threadId: v.id('marketplaceThreads'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const thread = await ctx.db.get(args.threadId)
    if (!thread) {
      throw new Error('Conversation not found')
    }
    if (String(thread.buyerId) !== String(user._id) && String(thread.sellerId) !== String(user._id)) {
      throw new Error('Conversation not found')
    }

    const now = Date.now()
    const body = args.body.trim()
    if (!body) {
      throw new Error('Message cannot be empty')
    }
    const isSeller = String(thread.sellerId) === String(user._id)
    const receiverId = isSeller ? thread.buyerId : thread.sellerId

    await ctx.db.insert('marketplaceMessages', {
      threadId: args.threadId,
      senderId: user._id,
      body,
      createdAt: now,
    })

    await ctx.db.patch(args.threadId, {
      lastMessagePreview: body.slice(0, 160),
      lastMessageAt: now,
      buyerUnreadCount: isSeller ? thread.buyerUnreadCount + 1 : 0,
      sellerUnreadCount: isSeller ? 0 : thread.sellerUnreadCount + 1,
      updatedAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: receiverId,
      title: 'New marketplace reply',
      detail: `${user.name ?? 'Someone'} replied in your marketplace conversation.`,
      kind: 'commerce',
      read: false,
      createdAt: now,
    })

    return { success: true }
  },
})

export const markMarketplaceThreadRead = mutation({
  args: { threadId: v.id('marketplaceThreads') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const thread = await ctx.db.get(args.threadId)
    if (!thread) {
      throw new Error('Conversation not found')
    }
    const now = Date.now()
    const isSeller = String(thread.sellerId) === String(user._id)
    const isBuyer = String(thread.buyerId) === String(user._id)
    if (!isSeller && !isBuyer) {
      throw new Error('Conversation not found')
    }

    await ctx.db.patch(args.threadId, {
      buyerUnreadCount: isBuyer ? 0 : thread.buyerUnreadCount,
      sellerUnreadCount: isSeller ? 0 : thread.sellerUnreadCount,
      updatedAt: now,
    })

    const messages = await ctx.db.query('marketplaceMessages').withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', args.threadId)).take(40)
    for (const message of messages) {
      if (String(message.senderId) !== String(user._id) && !message.readAt) {
        await ctx.db.patch(message._id, { readAt: now })
      }
    }

    return { success: true }
  },
})

export const markNotificationRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const notification = await ctx.db.get(args.notificationId)
    if (!notification || String(notification.userId) !== String(user._id)) {
      throw new Error('Notification not found')
    }

    if (!notification.read) {
      await ctx.db.patch(args.notificationId, {
        read: true,
        readAt: Date.now(),
      })
    }

    return { success: true }
  },
})

export const updateDeviceAutomation = mutation({
  args: {
    deviceId: v.string(),
    autoWatering: v.optional(v.boolean()),
    autoLighting: v.optional(v.boolean()),
    wateringThreshold: v.optional(v.number()),
    wateringDuration: v.optional(v.number()),
    wateringCooldown: v.optional(v.number()),
    lightingThreshold: v.optional(v.number()),
    lightingHysteresis: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const device = user.role === 'admin'
      ? await getDeviceByExternalId(ctx, args.deviceId)
      : await requireOwnedDevice(ctx, user._id, args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    const includesLowLevelAutomation =
      args.wateringThreshold !== undefined ||
      args.wateringDuration !== undefined ||
      args.wateringCooldown !== undefined ||
      args.lightingThreshold !== undefined ||
      args.lightingHysteresis !== undefined

    if (includesLowLevelAutomation && user.role !== 'admin') {
      throw new Error('Only admins can change device automation tuning')
    }

    const updates: Partial<Pick<DeviceDoc, DeviceAutomationKey>> = {}
    if (args.autoWatering !== undefined) updates.autoWatering = args.autoWatering
    if (args.autoLighting !== undefined) updates.autoLighting = args.autoLighting
    if (args.wateringThreshold !== undefined) updates.wateringThreshold = args.wateringThreshold
    if (args.wateringDuration !== undefined) updates.wateringDuration = args.wateringDuration
    if (args.wateringCooldown !== undefined) updates.wateringCooldown = args.wateringCooldown
    if (args.lightingThreshold !== undefined) updates.lightingThreshold = args.lightingThreshold
    if (args.lightingHysteresis !== undefined) updates.lightingHysteresis = args.lightingHysteresis

    const changedFields = Object.entries(updates).reduce<Record<string, string | number | boolean>>((acc, [rawKey, value]) => {
      const key = rawKey as DeviceAutomationKey
      if (device[key] !== value) {
        acc[`${key}Before`] = formatEventValue(device[key])
        acc[`${key}After`] = formatEventValue(value)
      }
      return acc
    }, {})

    const now = Date.now()

    await ctx.db.patch(device._id, { ...updates, updatedAt: now })

    if (Object.keys(changedFields).length > 0) {
      await recordGrowEvent(ctx, {
        deviceId: device._id,
        plantId: device.plantId,
        userId: user._id,
        source: 'user',
        entityType: 'automation',
        eventType: 'automation_settings_updated',
        title: 'Automation settings updated',
        detail: `${device.name} automation thresholds and modes changed.`,
        data: changedFields,
        timestamp: now,
      })
    }

    return { success: true }
  },
})

export const adminConsole = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx)
    const [devices, supportRequests, officialProducts, users, plants, communityPosts, allProducts, recentEvents, plantCatalog] = await Promise.all([
      ctx.db.query('devices').order('desc').take(40),
      ctx.db.query('supportRequests').order('desc').take(30),
      ctx.db.query('products').withIndex('by_type', (q) => q.eq('type', 'official')).order('desc').take(20),
      ctx.db.query('users').collect(),
      ctx.db.query('plants').collect(),
      ctx.db.query('communityPosts').collect(),
      ctx.db.query('products').collect(),
      ctx.db.query('growEvents').withIndex('by_timestamp').order('desc').take(10),
      ctx.db.query('plantCatalog').take(64),
    ])

    const deviceRows = await Promise.all(devices.map(async (device) => {
      const owner = device.userId ? await ctx.db.get(device.userId) : null
      const plant = device.plantId ? await ctx.db.get(device.plantId) : null
      return {
        _id: device._id,
        deviceId: device.deviceId,
        name: device.name,
        ownerName: owner?.name ?? null,
        ownerEmail: owner?.email ?? null,
        firmwareVersion: device.firmwareVersion ?? '',
        isClaimed: Boolean(device.userId),
        plantName: plant && !plant.archived ? plant.name : null,
        autoWatering: device.autoWatering,
        autoLighting: device.autoLighting,
        wateringThreshold: device.wateringThreshold,
        wateringDuration: getDeviceWateringDuration(device),
        wateringCooldown: getDeviceWateringCooldown(device),
        lightingThreshold: device.lightingThreshold,
        lightingHysteresis: getDeviceLightingHysteresis(device),
        lastSeen: device.lastSeen,
        lastSeenLabel: formatTimestamp(device.lastSeen),
        isOnline: isDeviceOnline(device.lastSeen),
      }
    }))

    const supportRows = await Promise.all(supportRequests.map(async (request) => {
      const owner = await ctx.db.get(request.userId)
      const handledBy = request.handledBy ? await ctx.db.get(request.handledBy) : null
      const messages = await getSupportMessages(ctx, request._id, 24)
      return {
        ...request,
        userName: owner?.name ?? owner?.email ?? 'Unknown user',
        userEmail: owner?.email ?? '',
        handledByName: handledBy?.name ?? null,
        createdAtLabel: formatTimestamp(request.createdAt),
        updatedAtLabel: formatTimestamp(request.updatedAt),
        messages: messages.map((message) => ({
          ...message,
          senderName: message.senderRole === 'admin'
            ? 'Admin'
            : message.senderRole === 'system'
              ? 'System'
              : owner?.name ?? owner?.email ?? 'User',
          createdAtLabel: formatTimestamp(message.createdAt),
        })),
      }
    }))

    const officialRows = await Promise.all(officialProducts.map((product) => enrichMarketplaceProduct(ctx, product, admin._id)))
    const plantCatalogRows = await Promise.all(plantCatalog.map(async (preset) => ({
      ...preset,
      image: (await resolveStoredImageUrl(ctx, preset.imageStorageId, preset.image)) ?? preset.image,
    })))
    const activePlants = plants.filter((plant) => !plant.archived)
    const claimedDevices = devices.filter((device) => Boolean(device.userId))
    const communityProducts = allProducts.filter((product) => product.type === 'community')
    const activeOfficialProducts = allProducts.filter((product) => product.type === 'official' && product.status === 'active')
    const recentEventRows = recentEvents.map((event) => ({
      ...event,
      timestampLabel: formatTimestamp(event.timestamp),
      relativeTime: getRelativeTime(event.timestamp),
    }))

    return {
      stats: {
        totalUsers: users.length,
        totalDevices: devices.length,
        claimedDevices: claimedDevices.length,
        activePlants: activePlants.length,
        openTickets: supportRows.filter((request) => request.status === 'open' || request.status === 'in_progress').length,
        officialProducts: activeOfficialProducts.length,
        communityListings: communityProducts.length,
        communityPosts: communityPosts.length,
      },
      devices: deviceRows,
      supportRequests: supportRows.sort((a, b) => b.updatedAt - a.updatedAt),
      officialProducts: officialRows,
      plantCatalog: plantCatalogRows.sort((a, b) => a.name.localeCompare(b.name)),
      recentEvents: recentEventRows,
      users: users
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, 24)
        .map((user) => ({
          _id: user._id,
          name: user.name ?? user.email ?? 'Unnamed user',
          email: user.email ?? '',
          handle: user.handle ?? '',
          tier: user.tier ?? 'basic',
          role: user.role ?? 'grower',
          setupComplete: Boolean(user.setupComplete),
        })),
    }
  },
})

export const adminSaveDevice = mutation({
  args: {
    existingDeviceId: v.optional(v.id('devices')),
    deviceId: v.string(),
    name: v.string(),
    firmwareVersion: v.optional(v.string()),
    autoWatering: v.boolean(),
    autoLighting: v.boolean(),
    wateringThreshold: v.number(),
    wateringDuration: v.number(),
    wateringCooldown: v.number(),
    lightingThreshold: v.number(),
    lightingHysteresis: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const now = Date.now()

    const existingByDeviceId = await getDeviceByExternalId(ctx, args.deviceId.trim())
    if (existingByDeviceId && String(existingByDeviceId._id) !== String(args.existingDeviceId)) {
      throw new Error('That device ID already exists')
    }

    const payload = {
      deviceId: args.deviceId.trim(),
      name: args.name.trim(),
      firmwareVersion: args.firmwareVersion?.trim() || undefined,
      autoWatering: args.autoWatering,
      autoLighting: args.autoLighting,
      wateringThreshold: args.wateringThreshold,
      wateringDuration: args.wateringDuration,
      wateringCooldown: args.wateringCooldown,
      lightingThreshold: args.lightingThreshold,
      lightingHysteresis: args.lightingHysteresis,
      updatedAt: now,
    }

    if (args.existingDeviceId) {
      const existing = await ctx.db.get(args.existingDeviceId)
      if (!existing) {
        throw new Error('Device not found')
      }

      await ctx.db.patch(args.existingDeviceId, payload)
      return { success: true, deviceId: args.existingDeviceId }
    }

    const deviceDocId = await ctx.db.insert('devices', {
      userId: undefined,
      plantId: undefined,
      pumpEnabled: false,
      lightEnabled: false,
      lastWatered: undefined,
      lastLightChange: undefined,
      lastSeen: now,
      createdAt: now,
      ...payload,
    })

    return { success: true, deviceId: deviceDocId }
  },
})

export const adminDeleteDevice = mutation({
  args: { deviceId: v.id('devices') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const device = await ctx.db.get(args.deviceId)
    if (!device) {
      throw new Error('Device not found')
    }
    if (device.userId || device.plantId) {
      throw new Error('Unclaim and detach the active plant before deleting this device')
    }

    await ctx.db.delete(args.deviceId)
    return { success: true }
  },
})

export const adminUpdateSupportRequest = mutation({
  args: {
    requestId: v.id('supportRequests'),
    status: v.union(v.literal('open'), v.literal('in_progress'), v.literal('resolved'), v.literal('closed')),
    priority: v.optional(v.union(v.literal('low'), v.literal('normal'), v.literal('high'), v.literal('urgent'))),
    response: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request) {
      throw new Error('Support request not found')
    }

    const now = Date.now()
    const response = args.response?.trim()
    await ctx.db.patch(args.requestId, {
      status: args.status,
      priority: args.priority ?? request.priority,
      response: response || request.response,
      handledBy: admin._id,
      respondedAt: response ? now : request.respondedAt,
      resolvedAt: args.status === 'resolved' || args.status === 'closed' ? now : undefined,
      updatedAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: request.userId,
      title: 'Support ticket updated',
      detail: response ? 'An admin responded to your support request.' : `Your support request is now ${args.status.replace('_', ' ')}.`,
      kind: 'assistant',
      read: false,
      createdAt: now,
    })

    return { success: true }
  },
})

export const adminSaveOfficialProduct = mutation({
  args: {
    productId: v.optional(v.id('products')),
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    quantityAvailable: v.number(),
    priceUnit: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    featured: v.boolean(),
    status: v.union(v.literal('active'), v.literal('reserved'), v.literal('sold'), v.literal('archived')),
    shopeeUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const now = Date.now()
    let image = await resolveStoredImageUrl(ctx, args.imageStorageId)
    let imageStorageId = args.imageStorageId

    if (args.productId) {
      const existing = await ctx.db.get(args.productId)
      if (!existing || existing.type !== 'official') {
        throw new Error('Official product not found')
      }

      image = image ?? existing.image
      imageStorageId = imageStorageId ?? existing.imageStorageId
    }

    if (!image) {
      throw new Error('Product image is required')
    }

    const payload = {
      title: args.title.trim(),
      description: args.description.trim(),
      price: args.price,
      category: args.category.trim(),
      type: 'official' as const,
      sellerId: admin._id,
      status: args.status,
      quantityAvailable: args.quantityAvailable,
      quantityUnit: undefined,
      priceUnit: args.priceUnit.trim(),
      locationLabel: 'Shopee',
      sellerNote: undefined,
      contactPreference: undefined,
      rating: 5,
      distanceMiles: undefined,
      image,
      imageStorageId,
      featured: args.featured,
      shopeeUrl: args.shopeeUrl?.trim() || undefined,
      updatedAt: now,
    }

    if (args.productId) {
      await ctx.db.patch(args.productId, payload)
      return { success: true, productId: args.productId }
    }

    const productId = await ctx.db.insert('products', {
      ...payload,
      createdAt: now,
    })

    return { success: true, productId }
  },
})

export const adminSavePlantPreset = mutation({
  args: {
    presetId: v.optional(v.id('plantCatalog')),
    key: v.optional(v.string()),
    name: v.string(),
    species: v.string(),
    growthStage: v.union(
      v.literal('seed_dormancy'),
      v.literal('germination'),
      v.literal('seedling_development'),
      v.literal('vegetative_growth'),
      v.literal('flowering_reproduction'),
      v.literal('maturity_senescence'),
    ),
    description: v.string(),
    location: v.string(),
    category: v.union(v.literal('herb'), v.literal('leafy'), v.literal('fruiting'), v.literal('houseplant'), v.literal('flower'), v.literal('microgreen')),
    difficulty: v.union(v.literal('easy'), v.literal('medium'), v.literal('advanced')),
    wateringThreshold: v.number(),
    lightingThreshold: v.number(),
    lifecycleProfile: v.object({
      seedDormancyDays: v.number(),
      germinationDays: v.number(),
      seedlingDevelopmentDays: v.number(),
      vegetativeGrowthDays: v.number(),
      floweringReproductionDays: v.number(),
      maturitySenescenceDays: v.number(),
    }),
    imageStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const now = Date.now()
    const key = normalizePlantPresetKey(args.key || args.name)
    if (!key) {
      throw new Error('Plant preset key is required')
    }

    const image = await resolveStoredImageUrl(ctx, args.imageStorageId)
    let existing = args.presetId ? await ctx.db.get(args.presetId) : null
    if (args.presetId && (!existing || existing._id !== args.presetId)) {
      throw new Error('Plant preset not found')
    }

    const duplicate = await ctx.db.query('plantCatalog').withIndex('by_key', (q) => q.eq('key', key)).first()
    if (duplicate && String(duplicate._id) !== String(args.presetId)) {
      throw new Error('A plant preset with this key already exists')
    }

    const finalImage = image ?? existing?.image
    const finalImageStorageId = args.imageStorageId ?? existing?.imageStorageId
    if (!finalImage) {
      throw new Error('Plant preset image is required')
    }

    const payload = {
      key,
      name: args.name.trim(),
      species: args.species.trim(),
      growthStage: args.growthStage,
      image: finalImage,
      imageStorageId: finalImageStorageId,
      description: args.description.trim(),
      location: args.location.trim(),
      category: args.category,
      difficulty: args.difficulty,
      wateringThreshold: args.wateringThreshold,
      lightingThreshold: args.lightingThreshold,
      lifecycleProfile: normalizeLifecycleProfile(args.lifecycleProfile),
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return { success: true, presetId: existing._id }
    }

    const presetId = await ctx.db.insert('plantCatalog', {
      ...payload,
      createdAt: now,
    })
    return { success: true, presetId }
  },
})

export const adminDeletePlantPreset = mutation({
  args: { presetId: v.id('plantCatalog') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const preset = await ctx.db.get(args.presetId)
    if (!preset) {
      throw new Error('Plant preset not found')
    }

    await ctx.db.delete(args.presetId)
    return { success: true }
  },
})

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const adminUpdateOfficialProductStatus = mutation({
  args: {
    productId: v.id('products'),
    status: v.union(v.literal('active'), v.literal('reserved'), v.literal('sold'), v.literal('archived')),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || product.type !== 'official') {
      throw new Error('Official product not found')
    }

    await ctx.db.patch(args.productId, {
      status: args.status,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const adminDeleteOfficialProduct = mutation({
  args: { productId: v.id('products') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || product.type !== 'official') {
      throw new Error('Official product not found')
    }

    await ctx.db.delete(args.productId)
    return { success: true }
  },
})

export const adminUpdateUserAccess = mutation({
  args: {
    userId: v.id('users'),
    tier: v.optional(v.union(v.literal('basic'), v.literal('advanced'))),
    role: v.optional(v.union(v.literal('grower'), v.literal('company'), v.literal('admin'))),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const target = await ctx.db.get(args.userId)
    if (!target) {
      throw new Error('User not found')
    }

    if (String(target._id) === String(admin._id) && args.role && args.role !== 'admin') {
      throw new Error('Admins cannot remove their own admin role here')
    }

    await ctx.db.patch(args.userId, {
      tier: args.tier ?? target.tier,
      role: args.role ?? target.role,
      updatedAt: Date.now(),
    })

    return { success: true }
  },
})

export const updateSensorData = mutation({
  args: {
    deviceId: v.string(),
    plantId: v.id('plants'),
    sensors: v.array(v.object({
      kind: v.union(v.literal('soil'), v.literal('light'), v.literal('temperature'), v.literal('air'), v.literal('water')),
      raw: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const plant = await ctx.db.get(args.plantId)
    if (!plant) {
      throw new Error('Plant not found')
    }

    const device = await ctx.db.query('devices').withIndex('by_deviceId', (q) => q.eq('deviceId', args.deviceId)).first()
    if (!device) {
      throw new Error('Device not found')
    }

    if (String(plant.deviceId) !== String(device._id)) {
      throw new Error('Plant does not belong to this device')
    }

    const currentSensors = await ctx.db
      .query('sensors')
      .withIndex('by_device', (q) => q.eq('deviceId', args.deviceId))
      .collect()

    const sensorState = new Map<string, { value: number; unit: string }>()
    for (const sensor of currentSensors) {
      sensorState.set(sensor.kind, { value: sensor.value, unit: sensor.unit })
    }

    const now = Date.now()
    let updated = 0
    let emittedSensorEvent = false

    for (const sensorUpdate of args.sensors) {
      const unit = sensorUpdate.kind === 'temperature' ? '°C' : '%'
      const value = sensorUpdate.kind === 'temperature'
        ? Math.round(sensorUpdate.raw * 10) / 10
        : Math.max(0, Math.min(100, Math.round((sensorUpdate.raw / 4095) * 100)))

      sensorState.set(sensorUpdate.kind, { value, unit })

      const existingSensor = await ctx.db
        .query('sensors')
        .withIndex('by_device_and_kind', (q) => q.eq('deviceId', args.deviceId).eq('kind', sensorUpdate.kind))
        .first()

      if (existingSensor) {
        await ctx.db.patch(existingSensor._id, {
          plantId: args.plantId,
          value,
          unit,
          measuredAt: now,
        })
      } else {
        await ctx.db.insert('sensors', {
          deviceId: args.deviceId,
          plantId: args.plantId,
          kind: sensorUpdate.kind,
          value,
          unit,
          measuredAt: now,
          createdAt: now,
        })
      }

      await ctx.db.insert('sensorReadings', {
        deviceId: args.deviceId,
        plantId: args.plantId,
        kind: sensorUpdate.kind,
        value,
        unit,
        measuredAt: now,
      })

      const previousValue = existingSensor?.value
      const shouldRecordSensorEvent = previousValue === undefined || Math.abs(previousValue - value) >= 5
      if (shouldRecordSensorEvent && !emittedSensorEvent) {
        await recordGrowEvent(ctx, {
          deviceId: device._id,
          plantId: args.plantId,
          source: 'device',
          entityType: 'sensor',
          eventType: 'sensor_recorded',
          title: 'Telemetry recorded',
          detail: `${sensorUpdate.kind} sensor updated to ${value}${unit}.`,
          data: {
            kind: sensorUpdate.kind,
            value,
            previousValue: previousValue ?? 'none',
          },
          timestamp: now,
        })
        emittedSensorEvent = true
      }

      updated += 1
    }

    const actions: Record<string, boolean | number> = {}
    const deviceUpdates: Record<string, boolean | number> = { lastSeen: now, updatedAt: now }

    const soilValue = sensorState.get('soil')?.value
    const lightValue = sensorState.get('light')?.value
    const waterLevel = sensorState.get('water')?.value

    if (
      device.autoWatering &&
      soilValue !== undefined &&
      soilValue < device.wateringThreshold &&
      (waterLevel === undefined || waterLevel > 5)
    ) {
      const cooldownMs = device.wateringCooldown * 1000
      const cooledDown = !device.lastWatered || now - device.lastWatered >= cooldownMs

      if (cooledDown) {
        deviceUpdates.lastWatered = now
        actions.pump = true
        actions.pumpDuration = device.wateringDuration

        await recordAutomationEvent(ctx, {
          deviceId: device.deviceId,
          plantId: plant._id,
          action: 'pump_enabled',
          soilValue,
          threshold: device.wateringThreshold,
          duration: device.wateringDuration,
          timestamp: now,
        })

        await recordAutomationEvent(ctx, {
          deviceId: device.deviceId,
          plantId: plant._id,
          action: 'pump_disabled',
          soilValue,
          threshold: device.wateringThreshold,
          duration: device.wateringDuration,
          timestamp: now + device.wateringDuration * 1000,
        })

        await recordGrowEvent(ctx, {
          deviceId: device._id,
          plantId: plant._id,
          source: 'automation',
          entityType: 'automation',
          eventType: 'automation_action_executed',
          title: 'Auto-watering executed',
          detail: `${device.name} triggered a watering pulse because soil moisture fell below threshold.`,
          data: {
            soilValue,
            threshold: device.wateringThreshold,
            duration: device.wateringDuration,
          },
          timestamp: now,
        })
      }
    }

    if (device.autoLighting && lightValue !== undefined) {
      const shouldEnableLight = !device.lightEnabled && lightValue < device.lightingThreshold
      const shouldDisableLight =
        device.lightEnabled && lightValue > device.lightingThreshold + device.lightingHysteresis

      if (shouldEnableLight || shouldDisableLight) {
        const nextLightEnabled = shouldEnableLight
        deviceUpdates.lightEnabled = nextLightEnabled
        deviceUpdates.lastLightChange = now
        actions.lightEnabled = nextLightEnabled

        await recordAutomationEvent(ctx, {
          deviceId: device.deviceId,
          plantId: plant._id,
          action: nextLightEnabled ? 'light_on' : 'light_off',
          lightValue,
          threshold: device.lightingThreshold,
          timestamp: now,
        })

        await recordGrowEvent(ctx, {
          deviceId: device._id,
          plantId: plant._id,
          source: 'automation',
          entityType: 'automation',
          eventType: 'automation_action_executed',
          title: nextLightEnabled ? 'Grow light enabled' : 'Grow light disabled',
          detail: nextLightEnabled
            ? `${device.name} enabled the grow light because ambient light is too low.`
            : `${device.name} disabled the grow light because ambient light recovered.`,
          data: {
            lightValue,
            threshold: device.lightingThreshold,
            hysteresis: device.lightingHysteresis,
          },
          timestamp: now,
        })
      }
    }

    await ctx.db.patch(device._id, deviceUpdates)

    return {
      success: true,
      updated,
      device: {
        name: device.name,
        plantName: plant.name,
      },
      actions,
      state: {
        pumpEnabled: false,
        lightEnabled: typeof deviceUpdates.lightEnabled === 'boolean' ? deviceUpdates.lightEnabled : device.lightEnabled,
        lastWatered: typeof deviceUpdates.lastWatered === 'number' ? deviceUpdates.lastWatered : device.lastWatered,
      },
    }
  },
})

export const updatePlantImage = mutation({
  args: {
    plantId: v.id('plants'),
    image: v.string(),
  },
  handler: async (ctx, args) => {
    const plant = await ctx.db.get(args.plantId)
    if (!plant) {
      throw new Error('Plant not found')
    }

    const now = Date.now()

    await ctx.db.patch(args.plantId, {
      image: args.image,
      updatedAt: now,
    })

    await recordPlantImage(ctx, {
      plantId: plant._id,
      deviceId: plant.deviceId,
      image: args.image,
      source: 'camera',
      capturedAt: now,
    })

    await recordGrowEvent(ctx, {
      deviceId: plant.deviceId,
      plantId: plant._id,
      source: 'device',
      entityType: 'plant',
      eventType: 'plant_image_updated',
      title: 'Plant image captured',
      detail: `${plant.name} received a new camera snapshot.`,
      timestamp: now,
    })

    return { success: true }
  },
})
