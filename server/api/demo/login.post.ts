import { timingSafeEqual } from 'node:crypto'
import { api } from '~~/convex/_generated/api'
import { useConvex } from '~~/server/utils/convex'

// One-link demo login: POST { token } -> demo JWT pair. The token is a
// server-only secret (DEMO_ACCESS_TOKEN); the browser never sees the demo
// password. Unset secret and wrong tokens are indistinguishable (404) so
// the endpoint's existence can't be probed. Short brute-force window via a
// tiny per-IP attempt cap (10/min); the 32+ char token space does the rest.
const ATTEMPT_WINDOW_MS = 60_000
const ATTEMPT_MAX = 10
const attemptsByIp = new Map<string, number[]>()

function attemptAllowed(ip: string): boolean {
  const now = Date.now()
  const recent = (attemptsByIp.get(ip) ?? []).filter((t) => now - t < ATTEMPT_WINDOW_MS)
  if (recent.length >= ATTEMPT_MAX) {
    attemptsByIp.set(ip, recent)
    return false
  }
  recent.push(now)
  attemptsByIp.set(ip, recent)
  return true
}

function tokenMatches(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: unknown }>(event)
  const expected = process.env.DEMO_ACCESS_TOKEN
  const demoPassword = process.env.DEMO_PASSWORD
  if (!expected || !demoPassword || !tokenMatches(body?.token, expected)) {
    throw createError({ statusCode: 404, statusMessage: 'Tautan demo tidak valid' })
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  if (!attemptAllowed(ip)) {
    throw createError({ statusCode: 429, statusMessage: 'Terlalu banyak percobaan, coba lagi nanti' })
  }

  const demoEmail = process.env.DEMO_EMAIL ?? 'demo@growmate.bond'
  try {
    const result = await useConvex().action(api.auth.signIn, {
      provider: 'password',
      params: { email: demoEmail, password: demoPassword, flow: 'signIn' },
    })
    if (!result?.tokens) {
      throw new Error('demo sign-in returned no tokens')
    }
    return { token: result.tokens.token, refreshToken: result.tokens.refreshToken ?? null }
  } catch (error) {
    console.error('[demo-login] sign-in failed:', error)
    throw createError({ statusCode: 503, statusMessage: 'Login demo gagal, coba lagi nanti' })
  }
})
