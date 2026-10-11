import type { H3Event, EventHandlerRequest } from 'h3'
import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import {
  validateDeviceEnvelope,
  checkSensorRateLimit,
  fitResponseBytes,
} from '~~/server/utils/deviceProtocol'

export const MAX_INGEST_BODY_BYTES = 1024 * 100

/**
 * Device telemetry ingest. Accepts exactly the firmware envelope
 * (pods api_client.c + tech api_client.py `build_envelope`, docs 06-api)
 * and returns exactly the firmware response
 * ({commands, config?, claim?, minFirmware?, firmwareUrl?}).
 */
export default async function handleSensorIngest(event: H3Event<EventHandlerRequest>) {
  try {
    // Auth before buffering: unauthenticated callers get 401 without a
    // body-validation oracle, and their bytes are never buffered.
    const deviceKey = requireDeviceKey(event)

    const contentLength = getHeader(event, 'content-length')
    if (contentLength !== undefined) {
      const parsedLength = Number(contentLength)
      if (!Number.isFinite(parsedLength) || parsedLength < 0) {
        throw createError({ statusCode: 400, statusMessage: 'invalid content-length' })
      }
      if (parsedLength > MAX_INGEST_BODY_BYTES) {
        throw createError({ statusCode: 413, statusMessage: 'Request body too large' })
      }
    }

    // Firmware posts JSON (pods api_client.c, tech api_client.py `_headers`).
    const contentType = getHeader(event, 'content-type')
    if (contentType && !contentType.includes('application/json')) {
      throw createError({ statusCode: 400, statusMessage: 'content-type must be application/json' })
    }

    let body: unknown
    try {
      body = await readBody(event)
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 400, statusMessage: 'malformed JSON body' })
    }
    const envelope = validateDeviceEnvelope(body)

    checkSensorRateLimit(event, envelope.deviceId)

    const convex = useConvex()
    const result = await convex.mutation(api.sensors.ingestAndAckSensorData, {
      deviceId: envelope.deviceId,
      firmwareVersion: envelope.firmwareVersion,
      hardwareId: envelope.hardwareId,
      variant: envelope.variant,
      snapshotId: envelope.snapshotId,
      ageMs: envelope.ageMs,
      appliedConfigRev: envelope.appliedConfigRev,
      acceptedCommandIds: envelope.acceptedCommandIds,
      currentState: envelope.currentState as never,
      health: envelope.health as never,
      sensors: envelope.sensors as never,
      deviceKey,
    })

    return fitResponseBytes(result as { commands: unknown[] })
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Sensor data ingestion failed:', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
}
