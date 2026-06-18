import { ConvexHttpClient } from 'convex/browser'

type PublicConvexKey = string

let convexClient: ConvexHttpClient | null = null

function getConvexClient() {
  if (!convexClient) {
    const convexUrl = useRuntimeConfig().public.convexUrl
    if (!convexUrl) {
      throw new Error('NUXT_PUBLIC_CONVEX_URL is not configured')
    }
    convexClient = new ConvexHttpClient(convexUrl)
  }
  return convexClient
}

export async function fetchPublicConvexQuery<TArgs extends Record<string, unknown>, TResult>(
  query: unknown,
  args: TArgs,
) {
  const client = getConvexClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await client.query(query as any, args as any) as unknown as TResult
}

export function usePublicConvexQuery<TArgs extends Record<string, unknown>, TResult>(
  key: PublicConvexKey,
  query: unknown,
  args: TArgs,
) {
  return useAsyncData(key, () => fetchPublicConvexQuery<TArgs, TResult>(query, args), {
    server: true,
    lazy: false,
    default: () => null,
  })
}
