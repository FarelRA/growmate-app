export type { SensorKind, PlantHealth } from '../types'

export { getCurrentUser, requireUser, requireAdmin } from './auth'

export {
  defaultPlantSensorProfile,
  normalizePlantSensorProfile,
  getSensorRange,
  getSensorStatus,
  getSensorTarget,
  getSensorLabel,
  getSensorAccent,
  getSensorSort,
  computePlantHealth,
  computePlantHealthScore,
  generateAlerts,
  getSensorHistory,
  getPlantImageHistory,
} from './sensors'
export type { Alert } from './sensors'

export {
  computeWaterReservoirDays,
  getDeviceWateringDuration,
  getDeviceWateringCooldown,
  getDeviceLightingHysteresis,
  getQueuedDeviceCommands,
  buildDeviceCommandList,
  buildQueuedPumpAction,
  buildQueuedLightAction,
  getDeviceByExternalId,
  getDefaultDeviceName,
  ensureDeviceExists,
  getUserDevices,
  requireOwnedDevice,
  getSelectedDevice,
  archivePlant,
  buildDeviceSummary,
  executeManualWatering,
  executeManualLighting,
} from './devices'

export {
  normalizeLifecycleProfile,
  formatPlantStage,
  computePlantProgress,
  buildPlantView,
  getHealthComputationGuide,
} from './plants'

export {
  recordGrowEvent,
  recordPlantImage,
  recordAutomationEvent,
  getRecentGrowEvents,
  getRecentAutomationLogs,
  getSupportMessages,
} from './events'

export {
  enrichMarketplaceProduct,
  getMarketplaceThreadsForUser,
  formatCurrencyIdr,
} from './marketplace'

export { enrichBlogPost } from './blog'

export {
  formatTimestamp,
  getRelativeTime,
  clampPercent,
  normalizeRawSensorValue,
  formatEventValue,
  getAutomationModeLabel,
  resolveStoredImageUrl,
  isDeviceOnline,
  ACTIVITY_POINTS,
  getActivityPoints,
  addUserActivity,
  computeUserPlantPoints,
} from './generic'
