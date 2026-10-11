import type { QueryCtx, DeviceDoc, PlantDoc } from '../types'
import { getRecentGrowEvents, getRecentAutomationLogs } from '../helpers/events'
import { formatTimestamp } from '../helpers/generic'
import { getSensorHistory, getPlantImageHistory } from '../helpers/sensors'
import { buildPlantView, formatPlantStage, computePlantProgress } from '../helpers/plants'
import { formatDeviceDetail } from '../helpers/devices'

// deviceHistory core for convex/devices.ts. The delegate owns the ownership
// gate (getSelectedDevice, visible there) plus the cursor-paginated archived
// read window; this core owns page mapping + assembly.
export type ArchivedPlantsPage = {
  page: PlantDoc[]
  isDone: boolean
  continueCursor: string
}

export const GALLERY_IMAGES_CAP = 100

export async function deviceGalleryImagesCore(
  ctx: QueryCtx,
  device: DeviceDoc,
  limit: number,
) {
  const take = Math.min(Math.max(Math.floor(limit) || 0, 1), GALLERY_IMAGES_CAP)
  const images = await ctx.db
    .query('plantImages')
    .withIndex('by_device', (q) => q.eq('deviceId', device._id))
    .order('desc')
    .take(take)
  return images.map((image) => ({
    _id: image._id,
    imageUrl: image.imageUrl ?? null,
    source: image.source,
    capturedAt: image.capturedAt,
    capturedAtLabel: formatTimestamp(image.capturedAt),
  }))
}

export async function deviceHistoryCore(
  ctx: QueryCtx,
  device: DeviceDoc,
  archivedPage: ArchivedPlantsPage,
) {
  const currentPlant = device.plantId ? await ctx.db.get(device.plantId) : null
  const archivedPlants = {
    ...archivedPage,
    page: archivedPage.page
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
  }

  const [timeline, imageHistory] = await Promise.all([
    getRecentGrowEvents(ctx, device._id, 5),
    currentPlant && !currentPlant.archived
      ? getPlantImageHistory(ctx, currentPlant._id, 16)
      : Promise.resolve([]),
  ])

  const recordings = await ctx.db
    .query('videoRecordings')
    .withIndex('by_device', (q) => q.eq('deviceId', device._id))
    .order('desc')
    .take(20)

  if (!currentPlant || currentPlant.archived) {
    return {
      device: {
        ...(await formatDeviceDetail(ctx, device)),
      },
      currentPlant: null,
      archivedPlants,
      metricHistory: {},
      automationLogs: [],
      timeline,
      imageHistory,
      recordings: recordings.map((r) => ({
        _id: r._id,
        fileName: r.fileName,
        path: r.path,
        size: r.size,
        durationMs: r.durationMs,
        capturedAt: r.capturedAt,
        capturedAtLabel: formatTimestamp(r.capturedAt),
      })),
    }
  }

  const [metricHistory, automationLogs] = await Promise.all([
    getSensorHistory(ctx, currentPlant._id, 60),
    getRecentAutomationLogs(ctx, currentPlant._id, 20),
  ])

  return {
    device: {
      ...(await formatDeviceDetail(ctx, device)),
    },
    currentPlant: {
      ...(await buildPlantView(ctx, currentPlant)),
      plantedAtLabel: formatTimestamp(currentPlant.plantedAt),
      growthStageLabel: formatPlantStage(currentPlant.growthStage),
      progress: computePlantProgress(currentPlant),
    },
    archivedPlants,
    metricHistory,
    automationLogs,
    timeline,
    imageHistory,
    recordings: recordings.map((r) => ({
      _id: r._id,
      fileName: r.fileName,
      path: r.path,
      size: r.size,
      durationMs: r.durationMs,
      capturedAt: r.capturedAt,
      capturedAtLabel: formatTimestamp(r.capturedAt),
    })),
  }
}
