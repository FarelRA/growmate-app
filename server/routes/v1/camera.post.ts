import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import { checkCameraRateLimit } from '~~/server/utils/deviceProtocol'
import { runUploadPipeline, deleteUploadedKeys, IMAGE_BUCKET } from '~~/server/utils/uploadPipeline'
import { defineFirmwareHandler } from '~~/server/utils/firmwareRoute'
import { convexErrorToH3Status, isH3Error } from '~~/server/utils/convexErrors'

// Firmware frame cap (tech 06-api §POST camera + 08 §7: reject bodies over
// ~1MB with 400; pods frames are 20-100KB so the same cap serves both).
export const MAX_DEVICE_FRAME_BYTES = 1024 * 1024

// Device frame ingest (pods APP_CAMERA_API_URL + tech camera_url:
// https://api.growmate.bond/v1/camera). This is the only implementation;
// the old /api/v1/* firmware route is deleted, not aliased. Errors stay
// JSON via defineFirmwareHandler (devices cannot parse Nuxt error pages).
export default defineFirmwareHandler(async (event) => {
  try {
    const deviceKey = requireDeviceKey(event)

    const deviceId = getHeader(event, 'x-device-id')?.trim()
    if (!deviceId) {
      throw createError({ statusCode: 400, statusMessage: 'deviceId is required' })
    }

    const contentType = getHeader(event, 'content-type')?.trim() || 'image/jpeg'
    if (!contentType.startsWith('image/')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'content-type must be an image type',
      })
    }

    // Rate-check before buffering: throttled devices must not make us hold
    // a megabyte while we decide to 429 them.
    checkCameraRateLimit(event, deviceId)

    // Optional forward-compat identity: current firmware sends only
    // X-Device-Id on frames, so resolution falls back to open intake;
    // a future firmware sending X-Hardware-Id gets hardware-first
    // rename handling in ingestCameraImage instead of a row fork.
    const hardwareId = getHeader(event, 'x-hardware-id')?.trim() || undefined

    const contentLength = getHeader(event, 'content-length')
    if (contentLength !== undefined) {
      const parsedLength = Number(contentLength)
      if (!Number.isFinite(parsedLength) || parsedLength < 0) {
        throw createError({ statusCode: 400, statusMessage: 'invalid content-length' })
      }
      if (parsedLength > MAX_DEVICE_FRAME_BYTES) {
        throw createError({
          statusCode: 400,
          statusMessage: 'frame over 1MB',
        })
      }
    }

    // h3 returns a utf8 string by default: binary JPEG bytes must be read
    // raw (false), otherwise Buffer.from mangles every byte >= 0x80 and
    // sharp rejects the frame as an unsupported format.
    const rawBody = await readRawBody(event, false)
    if (!rawBody || rawBody.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Image body is required' })
    }

    const input = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)
    if (input.length > MAX_DEVICE_FRAME_BYTES) {
      throw createError({
        statusCode: 400,
        statusMessage: 'frame over 1MB',
      })
    }

    const { path: pathPrefix, keys } = await runUploadPipeline(input)

    const convex = useConvex()
    try {
      await convex.mutation(api.sensors.ingestCameraImage, {
        deviceId,
        hardwareId,
        imageUrl: pathPrefix,
        capturedAt: Date.now(),
        deviceKey,
      })
    } catch (error: unknown) {
      await deleteUploadedKeys(IMAGE_BUCKET, keys)
      throw error
    }

    return { success: true, path: pathPrefix }
  } catch (error: unknown) {
    if (isH3Error(error)) throw error
    // Coded Convex failures map back (a claimed unit reporting its new id
    // must not 500); only true server faults are logged here — the
    // firmware boundary logs with the request id either way.
    const { statusCode, statusMessage } = convexErrorToH3Status(error)
    if (statusCode >= 500) {
      console.error(`[camera ${String(event.context.requestId ?? 'noid')}] ingest failed:`, error)
    }
    throw createError({ statusCode, statusMessage })
  }
})
