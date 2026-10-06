import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import { streamManager } from '~~/server/utils/streamManager'
import { parseStreamUrl } from '~~/shared/utils/streamUrl'

const BLOCKED_SERVICE_NAMES = new Set(['minio', 'convex', 'traefik', 'growmate'])

export function isBlockedStreamHost(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, '')
  if (h === 'localhost' || h === 'local' || h.endsWith('.local')) {
    return 'local hostname'
  }
  if (h === '0.0.0.0' || h === '::1' || h === '::') {
    return 'non-routable address'
  }
  if (h.startsWith('127.')) {
    return 'loopback address'
  }
  if (h === '169.254.169.254') {
    return 'cloud metadata address'
  }
  if (h.startsWith('10.')) {
    return 'private range (10/8)'
  }
  if (h.startsWith('192.168.')) {
    return 'private range (192.168/16)'
  }
  const m = h.match(/^172\.(\d+)\./)
  if (m) {
    const second = Number(m[1])
    if (second >= 16 && second <= 31) {
      return 'private range (172.16/12)'
    }
  }
  const firstLabel = h.split('.')[0] ?? h
  if (BLOCKED_SERVICE_NAMES.has(h) || BLOCKED_SERVICE_NAMES.has(firstLabel)) {
    return 'internal service name'
  }
  return null
}

export default defineEventHandler(async (event) => {
  const deviceKey = requireDeviceKey(event)

  const body = await readBody(event)

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

  const blockReason = isBlockedStreamHost(parsed.host)
  if (blockReason) {
    console.warn(
      `Rejected stream registration for device ${body.deviceId}: blocked host ${parsed.host} (${blockReason})`,
    )
    throw createError({ statusCode: 400, statusMessage: 'Stream host is not allowed' })
  }

  const convex = useConvex()
  await convex.mutation(api.streams.registerStream, {
    deviceId: body.deviceId,
    streamUrl: body.streamUrl,
    deviceKey,
  })

  await streamManager.connect(body.deviceId, parsed.host, parsed.port)

  return { success: true, streamId: body.deviceId }
})
