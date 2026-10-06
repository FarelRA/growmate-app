import type { FunctionReference } from 'convex/server'
import { runSharedConvexQuery } from '@/utils/auth'

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
  opts?: { timeoutMs?: number },
) {
  // SSR blocks the document on this query (lazy: false), so a hung backend
  // would hang the page forever. Fail soft to null past the timeout; the
  // page renders and reactive queries take over on hydration.
  // Default 8s keeps SSR snappy while tolerating a slow backend.
  const timeoutMs = opts?.timeoutMs ?? 8000
  return useAsyncData(key, async () => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        fetchPublicConvexQuery<TArgs, TResult>(query, args),
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), timeoutMs)
        }),
      ])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
    }
  }, {
    server: true,
    lazy: false,
    default: () => null,
  })
}
