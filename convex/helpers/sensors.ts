import type { Ctx, SensorKind, SensorStatus, SensorRange, PlantSensorProfile, PlantHealth, MetricPoint } from '../types'
import { sensorKinds } from '../types'
import type { Id } from '../_generated/dataModel'
import { formatTimestamp, resolveStoredImageUrl, isDeviceOnline } from './generic'

interface SensorData {
  kind: SensorKind
  value: number
}

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
