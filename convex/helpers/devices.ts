import type { Ctx, DeviceDoc } from '../types'
import {
  getDeviceWateringDuration,
  getDeviceWateringCooldown,
  getDeviceLightingHysteresis,
} from './devices/defaults'
import { formatTimestamp, isDeviceOnline } from './generic'
import { formatPlantStage } from './plants'
import { getRecentGrowEvents } from './events'

// Thin core (pre-alpha split): everything else moved verbatim into
// ./devices/{defaults,queued,summaries,triggers} and is re-exported below.
// Dependency direction is one-directional — triggers → {defaults, queued};
// defaults/queued/summaries import only types, sibling helpers, and events —
// so re-exporting from this barrel introduces no import cycle.
// buildDeviceSummary + formatDeviceDetail stay defined HERE (not in
// ./devices/summaries.ts) because tests/convex/test-dose-triggers.test.ts
// pins their source text to this file (export async function … with
// .take(4) / .slice(0, 3) and no .collect()).
export * from './devices/defaults'
export * from './devices/queued'
export * from './devices/summaries'
export * from './devices/triggers'

export async function buildDeviceSummary(ctx: Ctx, device: DeviceDoc) {
  const currentPlant = device.plantId ? await ctx.db.get(device.plantId) : null
  // Mini-list only (full archives paginate via deviceHistory): bound the
  // read to one more than the 3 displayed rows, then slice to most recent.
  const archivedPlants = await ctx.db
    .query('plants')
    .withIndex('by_device_archived', (q) => q.eq('deviceId', device._id).eq('archived', true))
    .take(4)
  const recentEvents = await getRecentGrowEvents(ctx, device._id, 4)

  const plantImageUrl =
    currentPlant && !currentPlant.archived
      ? currentPlant.imageUrl ?? null
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
    lastStreaming: device.lastStreaming ?? false,
    lastStreamFps: device.lastStreamFps ?? 0,
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
            imageUrl: plantImageUrl,
            plantedAt: currentPlant.plantedAt,
          }
        : null,
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

export async function formatDeviceDetail(ctx: Ctx, device: DeviceDoc) {
  return {
    ...(await buildDeviceSummary(ctx, device)),
    version: device.version ?? 'v1',
    autoFertilizing: device.autoFertilizing,
    autoPesticide: device.autoPesticide,
    fertilizingThreshold: device.fertilizingThreshold,
    fertilizingDuration: device.fertilizingDuration,
    fertilizingCooldown: device.fertilizingCooldown,
    pesticideThreshold: device.pesticideThreshold,
    pesticideDuration: device.pesticideDuration,
    pesticideCooldown: device.pesticideCooldown,
    lastFertilized: device.lastFertilized,
    lastPesticideApplied: device.lastPesticideApplied,
    lastStreaming: device.lastStreaming ?? false,
    lastStreamFps: device.lastStreamFps ?? 0,
    tankCapacity: device.tankCapacity,
    tankMinLevel: device.tankMinLevel,
    batterySoC: device.batterySoC,
    batteryCurrent: device.batteryCurrent,
    batteryCapacityAh: device.batteryCapacityAh,
    batteryLastFullCharge: device.batteryLastFullCharge,
    hasModem: device.hasModem,
    hasSolarPanel: device.hasSolarPanel,
    modemImei: device.modemImei,
    solarPanelWatts: device.solarPanelWatts,
  }
}
