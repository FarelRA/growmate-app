import type { Doc } from './_generated/dataModel'
import type { QueryCtx, MutationCtx } from './_generated/server'

export type { QueryCtx, MutationCtx }

export type Ctx = QueryCtx | MutationCtx

export type SensorKind = 'soil' | 'light' | 'temperature' | 'air' | 'water'
export type SensorStatus = 'low' | 'optimal' | 'high'
export type SensorRange = { min: number; max: number }
export type PlantSensorProfile = Record<SensorKind, SensorRange>
export type PlantHealth = 'excellent' | 'good' | 'fair' | 'poor'
export type UserDoc = Doc<'users'>
export type PlantDoc = Doc<'plants'>
export type DeviceDoc = Doc<'devices'>
export type SensorDoc = Doc<'sensors'>
export type CareScheduleDoc = Doc<'careSchedules'>
export type ProductDoc = Doc<'products'>
export type CommunityPostDoc = Doc<'communityPosts'>
export type BlogPostDoc = Doc<'blogPosts'>

export type GrowEventSource = 'user' | 'device' | 'system' | 'automation'
export type GrowEventEntity = 'device' | 'plant' | 'schedule' | 'automation' | 'sensor'
export type GrowEventType =
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
  | 'care_schedule_deleted'
  | 'manual_lighting_triggered'

export type MetricPoint = {
  value: number
  measuredAt: number
}

export type DeviceAutomationKey =
  | 'autoWatering'
  | 'autoLighting'
  | 'wateringThreshold'
  | 'wateringDuration'
  | 'wateringCooldown'
  | 'lightingThreshold'
  | 'lightingHysteresis'

export type ScheduleCadenceUnit = 'hours' | 'days'

export type ScheduleCadence = {
  unit: ScheduleCadenceUnit
  value: number
  timeOfDayMinutes: number | null
  timezoneOffsetMinutes: number
}

export type QueuedDeviceAction =
  | { kind: 'pump'; durationMs: number }
  | { kind: 'light'; enabled: boolean }

export type DeviceQueuedCommands = {
  pump: Extract<QueuedDeviceAction, { kind: 'pump' }> | null
  light: Extract<QueuedDeviceAction, { kind: 'light' }> | null
}

export type LifecycleProfile = {
  seedDormancyDays: number
  germinationDays: number
  seedlingDevelopmentDays: number
  vegetativeGrowthDays: number
  floweringReproductionDays: number
  maturitySenescenceDays: number
}

export type PlantStageValue =
  | 'seed_dormancy'
  | 'germination'
  | 'seedling_development'
  | 'vegetative_growth'
  | 'flowering_reproduction'
  | 'maturity_senescence'

export const defaultLifecycleProfile: LifecycleProfile = {
  seedDormancyDays: 7,
  germinationDays: 10,
  seedlingDevelopmentDays: 14,
  vegetativeGrowthDays: 30,
  floweringReproductionDays: 24,
  maturitySenescenceDays: 20,
}

export const lifecycleStages = [
  { key: 'seed_dormancy', label: 'Dormansi benih', durationKey: 'seedDormancyDays' as const },
  { key: 'germination', label: 'Perkecambahan', durationKey: 'germinationDays' as const },
  { key: 'seedling_development', label: 'Perkembangan bibit', durationKey: 'seedlingDevelopmentDays' as const },
  { key: 'vegetative_growth', label: 'Pertumbuhan vegetatif', durationKey: 'vegetativeGrowthDays' as const },
  { key: 'flowering_reproduction', label: 'Pembungaan / reproduksi', durationKey: 'floweringReproductionDays' as const },
  { key: 'maturity_senescence', label: 'Kematangan / senesens', durationKey: 'maturitySenescenceDays' as const },
] as const

export const sensorKinds: SensorKind[] = ['soil', 'light', 'temperature', 'air', 'water']

export const DEFAULT_WATERING_THRESHOLD = 35
export const DEFAULT_LIGHTING_THRESHOLD = 40
export const DEFAULT_WATERING_DURATION = 8
export const DEFAULT_WATERING_COOLDOWN = 6 * 60 * 60
export const DEFAULT_LIGHTING_HYSTERESIS = 8
export const ADC_RAW_MIN = 0
export const ADC_RAW_MAX = 4095

export const plantStagePoints: Record<PlantStageValue, number> = {
  seed_dormancy: 5,
  germination: 10,
  seedling_development: 20,
  vegetative_growth: 35,
  flowering_reproduction: 50,
  maturity_senescence: 65,
}
