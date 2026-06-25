import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { streamManager } from '~~/server/utils/streamManager'
import { parseStreamUrl } from '~~/convex/helpers/streams'

const DEVICE_API_KEY = process.env.DEVICE_API_KEY

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const apiKey = getHeader(event, 'x-api-key')
  if (DEVICE_API_KEY && apiKey !== DEVICE_API_KEY) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (!body.deviceId || !body.streamUrl) {
    throw createError({ statusCode: 400, statusMessage: 'deviceId and streamUrl are required' })
  }

  const parsed = parseStreamUrl(body.streamUrl)
  if (!parsed || parsed.protocol !== 'tcp') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid stream URL' })
  }
  if (!Number.isFinite(parsed.port) || parsed.port < 1 || parsed.port > 65535) {
    throw createError({ statusCode: 400, statusMessage: 'Stream URL must include a valid port number' })
  }

  const convex = useConvex()
  await convex.mutation(api.streams.registerStream, {
    deviceId: body.deviceId,
    streamUrl: body.streamUrl,
  })

  await streamManager.connect(body.deviceId, parsed.host, parsed.port)

  return { success: true, streamId: body.deviceId }
})
