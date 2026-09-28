import type { FunctionReference } from 'convex/server'
import { runSharedConvexQuery } from '@/lib/auth'

type PublicConvexKey = string

/**
 * Documented public-query helper wrapping the shared Convex HTTP client.
 *
 * This is the only sanctioned way to run one-off (SSR-friendly) Convex
 * queries outside the @convex-vue/core plugin: it delegates to
 * {@link runSharedConvexQuery}, so the current JWT is attached when present
 * (harmless for truly public queries, required for authenticated ones) and
 * token-refresh retry applies here exactly as on every other non-plugin
 * path. Do not construct `new ConvexHttpClient(...)` at call sites.
 */
export async function fetchPublicConvexQuery<TArgs extends Record<string, unknown>, TResult>(
  query: FunctionReference<'query', 'public', TArgs, TResult>,
  args: TArgs,
) {
  // Widen to the base args record so the rest-args tuple resolves; TResult
  // is preserved exactly from the query reference.
  return runSharedConvexQuery(
    query as FunctionReference<'query', 'public', Record<string, unknown>, TResult>,
    args,
  )
}

export function usePublicConvexQuery<TArgs extends Record<string, unknown>, TResult>(
  key: PublicConvexKey,
  query: FunctionReference<'query', 'public', TArgs, TResult>,
  args: TArgs,
) {
  return useAsyncData(key, () => fetchPublicConvexQuery<TArgs, TResult>(query, args), {
    server: true,
    lazy: false,
    default: () => null,
  })
}
