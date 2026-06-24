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
  getDeviceFertilizingDuration,
  getDevicePesticideDuration,
  getDeviceFertilizingCooldown,
  getDevicePesticideCooldown,
  getQueuedDeviceCommands,
  buildDeviceCommandList,
  buildQueuedPumpAction,
  buildQueuedLightAction,
  buildQueuedFertilizerAction,
  buildQueuedPesticideAction,
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
  executeManualFertilizing,
  executeManualPesticide,
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
} from './marketplace'

export { formatCurrencyIdr } from './generic'

export { enrichBlogPost } from './blog'

export {
  formatTimestamp,
  getRelativeTime,
  clampPercent,
  normalizeRawSensorValue,
  formatEventValue,
  getAutomationModeLabel,
  isDeviceOnline,
  ACTIVITY_POINTS,
  getActivityPoints,
  addUserActivity,
  computeUserPlantPoints,
} from './generic'

export {
  evaluateFertilizingRule,
  evaluatePesticideRule,
  estimateBatterySoC,
} from './v2sensors'

export { parseStreamUrl } from './streams'
