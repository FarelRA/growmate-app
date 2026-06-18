import { httpRouter } from 'convex/server'
import { httpAction } from './_generated/server'
import { internal } from './_generated/api'
import { auth } from './auth'

const http = httpRouter()
const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}

auth.addHttpRoutes(http)

// Device telemetry endpoint: firmware reports sensor values and current actuator state.
http.route({
  path: '/api/sensors',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      const contentLength = request.headers.get('content-length')
      if (contentLength && Number(contentLength) > 1024 * 100) {
        return new Response(JSON.stringify({ error: 'Request body too large' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const body = await request.json()

      if (body.sensors) {
        for (const sensor of body.sensors) {
          if (typeof sensor.value === 'number' && (sensor.value < 0 || sensor.value > 100)) {
            return new Response(
              JSON.stringify({ error: `Sensor value for ${sensor.kind} must be between 0-100 (got ${sensor.value})` }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }
        }
      }

      // Validate API key (optional - check environment variable)
      const apiKey = request.headers.get('x-api-key')
      const expectedApiKey = env.SENSOR_API_KEY

      if (expectedApiKey && apiKey !== expectedApiKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Validate required fields
      if (!body.deviceId) {
        return new Response(JSON.stringify({ error: 'deviceId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Support both single sensor update and batch updates
      const sensors = body.sensors || [
        { kind: body.kind, value: body.value, unit: body.unit, raw: body.raw },
      ]

      // Validate sensors array
      for (const sensor of sensors) {
        if (!sensor.kind || sensor.value === undefined || !sensor.unit) {
          return new Response(
            JSON.stringify({ error: "Each sensor must have 'kind', 'value', and 'unit'" }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        if (sensor.raw !== undefined && ['soil', 'light', 'water'].includes(sensor.kind)) {
          if (sensor.raw < 0 || sensor.raw > 4095) {
            return new Response(
              JSON.stringify({
                error: `Raw value for ${sensor.kind} must be between 0-4095 (got ${sensor.raw})`,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }
        }
      }

      // Update sensors and get automation actions
      const result = await ctx.runMutation(internal.sensors.updateSensorData, {
        deviceId: body.deviceId,
        firmwareVersion: body.firmwareVersion,
        currentState: body.currentState,
        sensors: sensors,
      })

      if (result.commands.length > 0) {
        await ctx.runMutation(internal.sensors.clearDeliveredDeviceCommands, {
          deviceId: body.deviceId,
          commands: result.commands.map((command) => command.kind),
        })
      }

      return new Response(
        JSON.stringify({
          success: true,
          updated: result.updated,
          commands: result.commands,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }),
})

// Device camera snapshot endpoint.
http.route({
  path: '/api/camera',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    try {
      // Validate API key
      const apiKey = request.headers.get('x-api-key')
      const expectedApiKey = env.SENSOR_API_KEY

      if (expectedApiKey && apiKey !== expectedApiKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const deviceId = request.headers.get('x-device-id')?.trim()
      if (!deviceId) {
        return new Response(JSON.stringify({ error: 'deviceId is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const contentType = request.headers.get('content-type')?.trim() || 'image/jpeg'
      if (!contentType.startsWith('image/')) {
        return new Response(JSON.stringify({ error: 'content-type must be an image type' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const imageLength = request.headers.get('content-length')
      if (imageLength && Number(imageLength) > 20 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: 'Image too large (max 20MB)' }), {
          status: 413,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const imageBuffer = await request.arrayBuffer()
      if (imageBuffer.byteLength === 0) {
        return new Response(JSON.stringify({ error: 'image body is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      const imageStorageId = await ctx.storage.store(
        new Blob([imageBuffer], { type: contentType }),
      )

      // Update plant image
      await ctx.runMutation(internal.sensors.updatePlantImage, {
        deviceId,
        imageStorageId,
      })

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Camera image stored successfully',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal server error'
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }),
})

export default http
