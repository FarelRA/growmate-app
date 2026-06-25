import { api } from '~~/convex/_generated/api'
import { useConvexAuth } from '~~/server/utils/convex'
import { streamManager } from '~~/server/utils/streamManager'

export default defineWebSocketHandler({
  async upgrade(request) {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response('Missing authentication token', { status: 401 })
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

    return undefined
  },
  open(peer) {
    const url = peer.request?.url ? new URL(peer.request.url) : null
    if (!url) {
      peer.close(4000, 'Missing request URL')
      return
    }
    const match = url.pathname.match(/\/api\/v2\/stream\/([^/]+)\/live/)
    const deviceId = match?.[1]
    if (!deviceId) {
      peer.close(4000, 'Missing deviceId')
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
