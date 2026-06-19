import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'

const DEVICE_API_KEY = process.env.DEVICE_API_KEY

export default defineEventHandler(async (event) => {
  try {
    const contentLength = getHeader(event, 'content-length')
    if (contentLength && Number(contentLength) > 1024 * 100) {
      throw createError({ statusCode: 413, statusMessage: 'Request body too large' })
    }

    const body = await readBody(event)

    const apiKey = getHeader(event, 'x-api-key')
    if (DEVICE_API_KEY && apiKey !== DEVICE_API_KEY) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    if (!body.deviceId) {
      throw createError({ statusCode: 400, statusMessage: 'deviceId is required' })
    }

    const sensors = body.sensors || [
      { kind: body.kind, value: body.value, unit: body.unit, raw: body.raw },
    ]

    for (const sensor of sensors) {
      if (!sensor.kind || sensor.value === undefined || !sensor.unit) {
        throw createError({
          statusCode: 400,
          statusMessage: "Each sensor must have 'kind', 'value', and 'unit'",
        })
      }

      if (
        typeof sensor.value === 'number' &&
        (sensor.value < 0 || sensor.value > 100)
      ) {
        throw createError({
          statusCode: 400,
          statusMessage: `Sensor value for ${sensor.kind} must be between 0-100`,
        })
      }

      if (
        sensor.raw !== undefined &&
        ['soil', 'light', 'water'].includes(sensor.kind)
      ) {
        if (sensor.raw < 0 || sensor.raw > 4095) {
          throw createError({
            statusCode: 400,
            statusMessage: `Raw value for ${sensor.kind} must be between 0-4095`,
          })
        }
      }
    }

    const convex = useConvex()
    const result = await convex.mutation(api.sensors.ingestSensorData, {
      deviceId: body.deviceId,
      firmwareVersion: body.firmwareVersion,
      currentState: body.currentState,
      sensors,
    })

    if (result.commands.length > 0) {
      await convex.mutation(api.sensors.clearDeviceCommands, {
        deviceId: body.deviceId,
        commands: result.commands.map(
          (command: { kind: 'pump' | 'light' }) => command.kind,
        ),
      })
    }

    return { success: true, updated: result.updated, commands: result.commands }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    const message =
      error instanceof Error ? error.message : 'Internal server error'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
