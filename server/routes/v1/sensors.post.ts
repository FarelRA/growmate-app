import handleSensorIngest from '~~/server/utils/ingestHandler'

// Firmware-compiled path (APP_SENSOR_API_URL = https://api.growmate.bond/v1/sensors).
// Same handler as /api/v1/sensors (docs canonical path).
export default defineEventHandler(async (event) => {
  return await handleSensorIngest(event)
})
