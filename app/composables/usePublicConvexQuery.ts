import { ConvexHttpClient } from 'convex/browser'

type PublicConvexKey = string

export async function fetchPublicConvexQuery<TArgs extends Record<string, unknown>, TResult>(
  query: unknown,
  args: TArgs,
) {
  const convexUrl = useRuntimeConfig().public.convexUrl
  if (!convexUrl) {
    throw new Error('NUXT_PUBLIC_CONVEX_URL is not configured')
  }

  const client = new ConvexHttpClient(convexUrl)
  return await client.query(query as never, args as never) as TResult
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
