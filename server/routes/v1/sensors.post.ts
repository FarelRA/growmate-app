import handleSensorIngest from '~~/server/utils/ingestHandler'
import { defineFirmwareHandler } from '~~/server/utils/firmwareRoute'

// Device telemetry ingest (pods APP_SENSOR_API_URL + tech sensor_url:
// https://api.growmate.bond/v1/sensors). This is the only implementation;
// the old /api/v1/* firmware routes are deleted, not aliased.
export default defineFirmwareHandler(async (event) => {
  return await handleSensorIngest(event)
})
