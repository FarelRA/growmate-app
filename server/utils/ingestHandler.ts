import type { H3Event, EventHandlerRequest } from 'h3'
import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { MAX_SENSORS_PER_POST } from '~~/convex/sensors'
import type { SensorKind } from '~~/convex/types'

export type SensorApiVersion = 'v1' | 'v2'

const RAW_SENSOR_KINDS = ['soil', 'light', 'water']
const KNOWN_SENSOR_KINDS: SensorKind[] = ['soil', 'light', 'temperature', 'air', 'water']

export const MAX_INGEST_BODY_BYTES = 1024 * 100

export interface IngestSensorInput {
  kind: string
  value: number
  unit: string
  raw?: number
}

export interface ValidatedSensorInput {
  kind: SensorKind
  value: number
  unit: string
  raw?: number
}

export interface IngestBody {
  deviceId?: string
  firmwareVersion?: string
  currentState?: {
    pumpEnabled: boolean
    lightEnabled: boolean
    fertilizerEnabled?: boolean
    pesticideEnabled?: boolean
    tankSwitchOpen?: boolean
    drawerSwitchOpen?: boolean
    batteryCurrent?: number
    batteryAccumulatedMah?: number
  }
  sensors?: IngestSensorInput[]
  kind?: string
  value?: number
  unit?: string
  raw?: number
}

function rawMaxFor(version: SensorApiVersion): number {
  return version === 'v1' ? 4095 : 65535
}

export function normalizeSensors(body: IngestBody): IngestSensorInput[] {
  const rawSensors = body.sensors || [
    {
      kind: body.kind,
      value: body.value,
      unit: body.unit,
      raw: body.raw,
    } as IngestSensorInput,
  ]
  return rawSensors
}

export function validateSensors(
  sensors: IngestSensorInput[],
  version: SensorApiVersion,
): asserts sensors is ValidatedSensorInput[] {
  if (sensors.length > MAX_SENSORS_PER_POST) {
    throw createError({
      statusCode: 400,
      statusMessage: `Too many sensors (max ${MAX_SENSORS_PER_POST})`,
    })
  }

  for (const sensor of sensors) {
    if (!sensor.kind || sensor.value === undefined || !sensor.unit) {
      throw createError({
        statusCode: 400,
        statusMessage: "Each sensor must have 'kind', 'value', and 'unit'",
      })
    }

    if (!(KNOWN_SENSOR_KINDS as string[]).includes(sensor.kind)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown sensor kind: ${sensor.kind}`,
      })
    }

    if (version === 'v2' && sensor.kind === 'temperature') {
      if (typeof sensor.value === 'number' && (sensor.value < -40 || sensor.value > 125)) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Temperature value must be between -40 and 125',
        })
      }
    } else if (
      typeof sensor.value === 'number' &&
      (sensor.value < 0 || sensor.value > 100)
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: `Sensor value for ${sensor.kind} must be between 0-100`,
      })
    }

    if (sensor.raw !== undefined && RAW_SENSOR_KINDS.includes(sensor.kind)) {
      const rawMax = rawMaxFor(version)
      if (sensor.raw < 0 || sensor.raw > rawMax) {
        throw createError({
          statusCode: 400,
          statusMessage: `Raw value for ${sensor.kind} must be between 0-${rawMax}`,
        })
      }
    }
  }
}

export default async function handleSensorIngest(event: H3Event<EventHandlerRequest>, version: SensorApiVersion) {
  try {
    const contentLength = getHeader(event, 'content-length')
    if (contentLength && Number(contentLength) > MAX_INGEST_BODY_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'Request body too large' })
    }

    const body = (await readBody(event)) as IngestBody

    const apiKey = getHeader(event, 'x-api-key')
    if (process.env.DEVICE_API_KEY && apiKey !== process.env.DEVICE_API_KEY) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    if (!body.deviceId) {
      throw createError({ statusCode: 400, statusMessage: 'deviceId is required' })
    }

    const sensors = normalizeSensors(body)
    validateSensors(sensors, version)

    const convex = useConvex()
    const result = await convex.mutation(api.sensors.ingestAndAckSensorData, {
      deviceId: body.deviceId,
      firmwareVersion: body.firmwareVersion,
      currentState: body.currentState,
      sensors,
    })

    return { success: true, updated: result.updated, commands: result.commands }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error(version === 'v2' ? 'V2 sensor ingestion failed:' : 'Sensor data ingestion failed:', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
}
