import { ConvexHttpClient } from 'convex/browser'

let _client: ConvexHttpClient | null = null

function getConvexUrl(): string {
  const url =
    process.env.NUXT_PUBLIC_CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? ''
  if (!url) throw new Error('NUXT_PUBLIC_CONVEX_URL is not configured')
  return url
}

export function useConvex(): ConvexHttpClient {
  if (!_client) {
    _client = new ConvexHttpClient(getConvexUrl())
  }
  return _client
}

export function useConvexAuth(token: string): ConvexHttpClient {
  const client = new ConvexHttpClient(getConvexUrl())
  client.setAuth(token)
  return client
}
