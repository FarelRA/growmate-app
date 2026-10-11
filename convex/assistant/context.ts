import type {
  Ctx,
  UserDoc,
  DeviceDoc,
  PlantDoc,
  SensorDoc,
  CareScheduleDoc,
  SensorKind,
} from '../types'
import {
  getDeviceWateringDuration,
  getDeviceWateringCooldown,
  getDeviceLightingHysteresis,
  getDeviceFertilizingDuration,
  getDevicePesticideDuration,
  getDeviceFertilizingCooldown,
  getDevicePesticideCooldown,
} from '../helpers/devices'
import { getRecentGrowEvents, getRecentAutomationLogs } from '../helpers/events'
import { formatPlantStage, computePlantProgress } from '../helpers/plants'
import {
  normalizePlantSensorProfile,
  getSensorStatus,
  getSensorLabel,
  getSensorTarget,
  computePlantHealth,
} from '../helpers/sensors'
import { formatTimestamp } from '../helpers/generic'
import { formatScheduleSummary } from '../care'

export async function buildAssistantContext(
  ctx: Ctx,
  user: UserDoc,
  device: DeviceDoc | null,
  plant: PlantDoc | null,
  clientTimezoneOffsetMinutes?: number,
) {
  const activePlant = plant && !plant.archived ? plant : null
  const deviceWithPlant = plant && !plant.archived && device ? device : null
  let sensors: SensorDoc[] = []
  let schedules: CareScheduleDoc[] = []
  let recentEvents: Awaited<ReturnType<typeof getRecentGrowEvents>> = []
  let automationLogs: Awaited<ReturnType<typeof getRecentAutomationLogs>> = []

  if (deviceWithPlant && activePlant) {
    ;[sensors, schedules, recentEvents, automationLogs] = await Promise.all([
      // Hard bound: exactly one row per sensor kind (≤6 rows). take(10)
      // freezes the invariant with headroom — never an unbounded read.
      ctx.db
        .query('sensors')
        .withIndex('by_plant', (q) => q.eq('plantId', activePlant._id))
        .take(10),
      ctx.db
        .query('careSchedules')
        .withIndex('by_plant', (q) => q.eq('plantId', activePlant._id))
        .take(5),
      getRecentGrowEvents(ctx, deviceWithPlant._id, 8),
      getRecentAutomationLogs(ctx, activePlant._id, 6),
    ])
  } else {
    recentEvents = device ? await getRecentGrowEvents(ctx, device._id, 8) : []
  }

  const sensorProfile = activePlant ? normalizePlantSensorProfile(activePlant.sensorProfile) : null

  const sensorSummaries = sensors.map((sensor) => ({
    kind: sensor.kind,
    label: getSensorLabel(sensor.kind as SensorKind, device?.version as 'v1' | 'v2' | undefined),
    value: sensor.value,
    unit: sensor.unit,
    status: getSensorStatus(sensor.kind as SensorKind, sensor.value, sensorProfile),
    target: getSensorTarget(
      sensor.kind as SensorKind,
      sensor.value,
      getSensorStatus(sensor.kind as SensorKind, sensor.value, sensorProfile),
      sensorProfile,
    ),
  }))

  return {
    user: {
      name: user.name ?? 'Pengguna GrowMate',
      tier: user.tier ?? 'basic',
    },
    activeDevice: device
      ? {
          name: device.name,
          deviceId: device.deviceId,
          version: device.version ?? 'v1',
          autoWatering: device.autoWatering,
          autoLighting: device.autoLighting,
          wateringThreshold: device.wateringThreshold,
          wateringDuration: getDeviceWateringDuration(device),
          wateringCooldown: getDeviceWateringCooldown(device),
          lightingThreshold: device.lightingThreshold,
          lightingHysteresis: getDeviceLightingHysteresis(device),
          lightEnabled: device.lightEnabled,
          autoFertilizing: device.autoFertilizing,
          autoPesticide: device.autoPesticide,
          fertilizingThreshold: device.fertilizingThreshold,
          fertilizingDuration: getDeviceFertilizingDuration(device),
          fertilizingCooldown: getDeviceFertilizingCooldown(device),
          pesticideThreshold: device.pesticideThreshold,
          pesticideDuration: getDevicePesticideDuration(device),
          pesticideCooldown: getDevicePesticideCooldown(device),
          lastFertilized: device.lastFertilized ? formatTimestamp(device.lastFertilized) : null,
          lastPesticideApplied: device.lastPesticideApplied
            ? formatTimestamp(device.lastPesticideApplied)
            : null,
          lastSeen: formatTimestamp(device.lastSeen),
          lastStreaming: device.lastStreaming ?? false,
          lastStreamFps: device.lastStreamFps ?? 0,
          tankCapacity: device.tankCapacity,
          tankMinLevel: device.tankMinLevel,
          batterySoC: device.batterySoC,
          batteryCurrent: device.batteryCurrent,
          batteryCapacityAh: device.batteryCapacityAh,
          reportedTankSwitchOpen: device.reportedTankSwitchOpen,
          reportedDrawerSwitchOpen: device.reportedDrawerSwitchOpen,
          hasModem: device.hasModem,
          hasSolarPanel: device.hasSolarPanel,
          modemImei: device.modemImei,
          solarPanelWatts: device.solarPanelWatts,
        }
      : null,
    activePlant:
      plant && !plant.archived
        ? {
            name: plant.name,
            species: plant.species,
            health: computePlantHealth(
              sensorSummaries.map((sensor) => ({ kind: sensor.kind as SensorKind, value: sensor.value })),
              sensorProfile,
            ),
            growthStage: formatPlantStage(plant.growthStage),
            location: plant.location,
            wateringThreshold: plant.wateringThreshold,
            lightingThreshold: plant.lightingThreshold,
            sensorProfile,
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
    ...(typeof clientTimezoneOffsetMinutes === 'number' && Number.isFinite(clientTimezoneOffsetMinutes)
      ? { clientTimezoneOffsetMinutes: Math.round(clientTimezoneOffsetMinutes) }
      : {}),
  }
}
