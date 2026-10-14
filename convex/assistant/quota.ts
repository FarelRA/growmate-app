import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../types'

export function getAssistantMessageLimit(tier?: 'basic' | 'advanced') {
  return tier === 'advanced' ? 100 : 20
}

export const DAY_MS = 24 * 60 * 60 * 1000

// Quota days are bucketed in UTC so the day boundary is identical for every
// user regardless of server/user timezone. Server-local midnight
// (setHours(0,0,0,0)) shifts the quota window for non-server-TZ users.
export function getStartOfToday(now = Date.now()) {
  return Math.floor(now / DAY_MS) * DAY_MS
}

export async function getAssistantUsage(
  ctx: Ctx,
  threadId: Id<'assistantThreads'>,
  tier?: 'basic' | 'advanced',
) {
  const startOfToday = getStartOfToday()
  // Quota limits: basic 20/day, advanced 100/day (see getAssistantMessageLimit).
  // Indexed count over today's user messages — no take() ceiling, so usage
  // can never silently undercount when history exceeds the old 160-row cap.
  // Plain collect (per-thread-per-day scope is tiny): sendAssistantMessage
  // calls this twice per function (pre-check + post-insert recount), and
  // Convex allows only a single .paginate() per function (live 500).
  const todays = await ctx.db
    .query('assistantMessages')
    .withIndex('by_thread_role_createdAt', (q) =>
      q.eq('threadId', threadId).eq('role', 'user').gte('createdAt', startOfToday),
    )
    .collect()
  const usedToday = todays.length
  const limit = getAssistantMessageLimit(tier)

  return {
    usedToday,
    limit,
    remainingToday: Math.max(0, limit - usedToday),
    resetsAt: startOfToday + DAY_MS,
  }
}

export function quotaExceededMessage(limit: number) {
  return `Batas penggunaan asisten harian sudah tercapai. Paket Anda saat ini memiliki ${limit} pesan per hari.`
}

// Pre-check helper for sendAssistantMessage: fast-path rejection without
// writing anything. The post-insert recount (with rollback) stays at the call
// site because it owns the reservation rows; it reports via
// quotaExceededMessage so both gates stay byte-identical.
export function assertAssistantQuotaAvailable(quota: { remainingToday: number; limit: number }) {
  if (quota.remainingToday <= 0) {
    throw new ConvexError(quotaExceededMessage(quota.limit))
  }
}
