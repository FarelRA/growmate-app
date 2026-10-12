import { ConvexHttpClient } from 'convex/browser'

/**
 * Default in-cluster Convex API endpoint (compose service `convex`, port 3210).
 * Prefer reaching Convex directly instead of hairpinning through Traefik + TLS
 * + public DNS. Set CONVEX_INTERNAL_URL to this value in compose deployments.
 */
export const CONVEX_INTERNAL_DEFAULT_URL = 'http://convex:3210'

/**
 * Default per-call budget for Convex calls made through the shared clients.
 *
 * NOTE on mechanism: the installed convex version's ConvexHttpClient does not
 * accept an AbortSignal — `query`/`mutation`/`action` take only
 * `(functionRef, ...args)` and `setFetchOptions` only supports `{ cache }`.
 * Timeouts are therefore enforced client-side via Promise.race (see
 * `withConvexTimeout`) instead of AbortSignal.timeout.
 */
export const CONVEX_DEFAULT_TIMEOUT_MS = 8000

export class ConvexTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Convex call timed out after ${timeoutMs}ms`)
    this.name = 'ConvexTimeoutError'
  }
}

/** Timeout budget in ms; CONVEX_TIMEOUT_MS overrides the default when valid. */
export function resolveConvexTimeoutMs(): number {
  const raw = process.env.CONVEX_TIMEOUT_MS
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : CONVEX_DEFAULT_TIMEOUT_MS
}

/**
 * Race a Convex promise against a timeout. Rejects with ConvexTimeoutError.
 *
 * NOTE: timing out only settles the caller's promise — a mutation/action may
 * still complete server-side. Keep mutations idempotent where it matters.
 */
export function withConvexTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = resolveConvexTimeoutMs(),
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ConvexTimeoutError(timeoutMs)), timeoutMs)
    // Don't hold the process open just for a timeout handle (Node only).
    if (
      typeof timer === 'object' &&
      timer !== null &&
      'unref' in timer &&
      typeof timer.unref === 'function'
    ) {
      timer.unref()
    }
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

function getPublicConvexUrl(): string {
  return process.env.NUXT_PUBLIC_CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? ''
}

/**
 * Server-side Convex URL: prefer the in-cluster address to avoid the
 * public hairpin, fall back to the public URL for non-compose environments.
 *
 * Throws when nothing is configured (preserves the previous contract — a
 * silent default would mask misconfiguration outside compose).
 */
export function getServerConvexUrl(): string {
  if (process.env.CONVEX_INTERNAL_URL) return process.env.CONVEX_INTERNAL_URL
  const publicUrl = getPublicConvexUrl()
  if (!publicUrl) throw new Error('NUXT_PUBLIC_CONVEX_URL is not configured')
  return publicUrl
}

const TIMED_METHODS = new Set(['query', 'mutation', 'action'])

/**
 * Wrap a client so query/mutation/action calls reject after the timeout
 * budget. All other members (setAuth, url, ...) are forwarded untouched.
 * Safe for `instanceof ConvexHttpClient` checks (prototype chain intact).
 */
function withCallTimeout(client: ConvexHttpClient): ConvexHttpClient {
  return new Proxy(client, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value
      if (typeof prop === 'string' && TIMED_METHODS.has(prop)) {
        const fn = value as (...args: unknown[]) => Promise<unknown>
        // Preserve `this`: the client methods read instance state
        // (auth headers, fetch impl). A detached call fails closed here.
        return (...args: unknown[]) => withConvexTimeout(fn.apply(target, args))
      }
      return (value as (...args: unknown[]) => unknown).bind(target)
    },
  })
}

let _client: ConvexHttpClient | null = null

export function useConvex(): ConvexHttpClient {
  if (!_client) {
    _client = withCallTimeout(new ConvexHttpClient(getServerConvexUrl()))
  }
  return _client
}

export function useConvexAuth(token: string): ConvexHttpClient {
  const client = new ConvexHttpClient(getServerConvexUrl())
  client.setAuth(token)
  return withCallTimeout(client)
}
