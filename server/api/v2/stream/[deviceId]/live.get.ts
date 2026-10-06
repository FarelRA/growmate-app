import { api } from '~~/convex/_generated/api'
import { useConvexAuth } from '~~/server/utils/convex'
import { streamManager } from '~~/server/utils/streamManager'

const LIVE_PATH_RE = /\/api\/v2\/stream\/([^/]+)\/live/

function deviceIdFromPath(pathname: string): string | null {
  return pathname.match(LIVE_PATH_RE)?.[1] ?? null
}

export default defineWebSocketHandler({
  async upgrade(request) {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response('Missing authentication token', { status: 401 })
    }

    const deviceId = deviceIdFromPath(url.pathname)
    if (!deviceId) {
      return new Response('Missing deviceId', { status: 404 })
    }

    const convex = useConvexAuth(token)
    try {
      const authenticated = await convex.query(api.auth.isAuthenticated, {})
      if (!authenticated) {
        return new Response('Unauthorized', { status: 401 })
      }
    } catch {
      return new Response('Authentication failed', { status: 401 })
    }

    let device: unknown = null
    try {
      device = await convex.query(api.streams.getOwnedDevice, { deviceId })
    } catch {
      return new Response('Authentication failed', { status: 401 })
    }
    if (!device) {
      return new Response('Device not found', { status: 404 })
    }

    return { context: { deviceId } }
  },
  open(peer) {
    const deviceId = peer.context?.deviceId
    if (typeof deviceId !== 'string' || deviceId.length === 0) {
      peer.close(4000, 'Unauthorized')
      return
    }
    streamManager.addViewer(deviceId, peer)
  },
  message(_peer, _message) {
  },
  close(peer) {
    streamManager.removeViewer(peer)
  },
  error(_peer, error) {
    console.error('[WS] Error:', error)
  },
})
