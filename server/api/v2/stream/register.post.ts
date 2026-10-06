import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'
import { requireDeviceKey } from '~~/server/utils/requireDeviceKey'
import { streamManager } from '~~/server/utils/streamManager'
import { parseStreamUrl } from '~~/shared/utils/streamUrl'

const BLOCKED_SERVICE_NAMES = new Set(['minio', 'convex', 'traefik', 'growmate'])

const DNS_LABEL = '(?!-)[A-Za-z0-9-]{1,63}(?<!-)'
const DNS_NAME_RE = new RegExp(`^${DNS_LABEL}(\\.${DNS_LABEL})*\\.?$`)

/** All-numeric dotted/hex parts (inet_aton style: 2130706433, 0x7f.0.0.1, 0177.0.0.1, 127.1). */
const NUMERIC_IP_PART = /^(?:\d+|0[xX][0-9a-fA-F]+)$/

/**
 * True only for a plain IPv4/IPv6 literal or a plausible DNS hostname.
 * Rejects bracketed literals, non-IP colons, and decimal/hex/octal-shorthand
 * encodings that `net.isIP` does not recognise as an IP but the OS
 * resolver would still interpret as one (SSRF bypass).
 */
export function isPlainStreamHost(host: string): boolean {
  if (!host || host.length > 253) {
    return false
  }
  if (host.includes('[') || host.includes(']')) {
    return false
  }
  if (isIP(host) !== 0) {
    return true
  }
  if (host.includes(':')) {
    return false
  }
  const bare = host.endsWith('.') ? host.slice(0, -1) : host
  const labels = bare.split('.')
  if (labels.length === 0) {
    return false
  }
  if (labels.every((label) => NUMERIC_IP_PART.test(label))) {
    return false
  }
  return DNS_NAME_RE.test(host)
}

export function isBlockedStreamHost(host: string): string | null {
  const h = host.toLowerCase().replace(/\.$/, '')
  if (h === 'localhost' || h === 'local' || h.endsWith('.local')) {
    return 'local hostname'
  }
  if (h === '0.0.0.0' || h === '::1' || h === '::') {
    return 'non-routable address'
  }
  if (h.includes(':')) {
    if (h.startsWith('::ffff:')) {
      return 'ipv4-mapped address'
    }
    if (/^fe[89ab][0-9a-f]:/.test(h)) {
      return 'link-local address'
    }
    if (h.startsWith('fc') || h.startsWith('fd')) {
      return 'private range (unique-local)'
    }
    return null
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

  if (!isPlainStreamHost(parsed.host)) {
    console.warn(
      `Rejected stream registration for device ${body.deviceId}: suspicious host form ${parsed.host}`,
    )
    throw createError({ statusCode: 400, statusMessage: 'Stream host is not allowed' })
  }

  let resolvedHost: string
  try {
    resolvedHost = (await lookup(parsed.host)).address
  } catch {
    console.warn(
      `Rejected stream registration for device ${body.deviceId}: DNS resolution failed for ${parsed.host}`,
    )
    throw createError({ statusCode: 400, statusMessage: 'Stream host is not allowed' })
  }

  const resolvedBlockReason = isBlockedStreamHost(resolvedHost)
  if (resolvedBlockReason) {
    console.warn(
      `Rejected stream registration for device ${body.deviceId}: resolved host ${resolvedHost} (${resolvedBlockReason})`,
    )
    throw createError({ statusCode: 400, statusMessage: 'Stream host is not allowed' })
  }

  const convex = useConvex()
  await convex.mutation(api.streams.registerStream, {
    deviceId: body.deviceId,
    streamUrl: body.streamUrl,
    deviceKey,
  })

  await streamManager.connect(body.deviceId, resolvedHost, parsed.port)

  return { success: true, streamId: body.deviceId }
})
