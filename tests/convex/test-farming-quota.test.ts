/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { likePost, createComment } from '../../convex/community'
import {
  sendAssistantMessage,
  getAssistantMessageLimit,
  getStartOfToday,
} from '../../convex/assistant'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Same gte-capable query upgrade + capturing scheduler as the sibling
 * assistant suites: covers `getAssistantUsage`'s `.gte('createdAt', …)` and
 * lets quota tests assert at-most-once AI actuation via `__schedulerCalls`.
 */
function withAssistantSupport(ctx: FakeCtx): FakeCtx {
  const calls: any[] = []
  ;(ctx as any).scheduler = {
    runAfter: async (...args: any[]) => {
      calls.push(args)
      return undefined
    },
  }
  ;(ctx as any).__schedulerCalls = calls
  const apply = (
    docs: any[],
    eq: { field: string; value: unknown }[],
    gte: { field: string; value: any }[],
  ) =>
    docs.filter(
      (d) => eq.every((f) => d[f.field] === f.value) && gte.every((f) => d[f.field] >= f.value),
    )
  const makeRunner = (
    docs: () => any[],
    eq: { field: string; value: unknown }[],
    gte: { field: string; value: any }[],
    desc: boolean,
  ) => {
    const run = () => {
      const out = apply(docs(), eq, gte)
      out.sort((a, b) => (desc ? b._seq - a._seq : a._seq - b._seq))
      return out
    }
    return {
      order: (dir: 'asc' | 'desc') => makeRunner(docs, eq, gte, dir === 'desc'),
      collect: async () => run(),
      first: async () => run()[0] ?? null,
      take: async (n: number) => run().slice(0, n),
      unique: async () => {
        const rows = run()
        if (rows.length > 1) throw new Error('unique() matched multiple docs')
        return rows[0] ?? null
      },
      paginate: async (opts: { cursor?: string | null; numItems?: number }) => {
        const rows = run()
        const numItems = opts.numItems ?? 100
        const offset = opts.cursor ? Number(opts.cursor) : 0
        const page = rows.slice(offset, offset + numItems)
        const next = offset + numItems
        return { page, isDone: next >= rows.length, continueCursor: String(next) }
      },
    }
  }
  ctx.db.query = ((table: string) => ({
    withIndex: (_name: string, fn: (q: any) => void) => {
      const eq: { field: string; value: unknown }[] = []
      const gte: { field: string; value: any }[] = []
      const q: any = {
        eq: (field: string, value: unknown) => {
          eq.push({ field, value })
          return q
        },
        gte: (field: string, value: any) => {
          gte.push({ field, value })
          return q
        },
      }
      fn(q)
      return makeRunner(() => ctx.db.all(table), eq, gte, false)
    },
    order: (dir: 'asc' | 'desc') => makeRunner(() => ctx.db.all(table), [], [], dir === 'desc'),
    collect: () => makeRunner(() => ctx.db.all(table), [], [], false).collect(),
    first: () => makeRunner(() => ctx.db.all(table), [], [], false).first(),
    take: (n: number) => makeRunner(() => ctx.db.all(table), [], [], false).take(n),
    paginate: (opts: { cursor?: string | null; numItems?: number }) =>
      makeRunner(() => ctx.db.all(table), [], [], false).paginate(opts),
  })) as any
  return ctx
}

function freshCtx(): FakeCtx {
  return withAssistantSupport(createFakeCtx())
}

function schedulerCalls(ctx: FakeCtx): any[] {
  return (ctx as any).__schedulerCalls as any[]
}

async function seedUser(
  ctx: FakeCtx,
  name: string,
  tier: 'basic' | 'advanced' = 'basic',
): Promise<string> {
  return await ctx.db.insert('users', { name, role: 'grower', tier })
}

async function userPoints(ctx: FakeCtx, userId: string): Promise<number> {
  const user = await ctx.db.get(userId)
  return user?.points ?? 0
}

async function seedPost(ctx: FakeCtx, authorId: string): Promise<string> {
  const now = Date.now()
  return await ctx.db.insert('communityPosts', {
    userId: authorId,
    title: 'Panen cabai',
    body: 'Tips panen cabai rawit',
    createdAt: now,
    updatedAt: now,
  })
}

async function seedThread(ctx: FakeCtx, userId: string): Promise<string> {
  const now = Date.now()
  return await ctx.db.insert('assistantThreads', {
    userId,
    title: 'Percakapan Floral Assistant',
    createdAt: now,
    updatedAt: now,
  })
}

async function seedUserMessages(
  ctx: FakeCtx,
  threadId: string,
  count: number,
  createdAt: number = Date.now(),
): Promise<void> {
  for (let i = 0; i < count; i++) {
    await ctx.db.insert('assistantMessages', {
      threadId,
      role: 'user',
      body: `pesan ${i + 1}`,
      status: 'complete',
      createdAt,
    })
  }
}

function quotaErrorOf(reason: unknown): string {
  return (reason as Error)?.message ?? String(reason)
}

describe('community: missing-post guards (no orphans, no farmed points)', () => {
  it('likePost on a missing post is rejected with zero rows and zero points', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Liker')
    const postId = await seedPost(ctx, userId)
    await ctx.db.delete(postId)
    ctx.__testUserId = userId

    await expect(callHandler(likePost, ctx, { postId })).rejects.toThrow(
      'Postingan tidak ditemukan',
    )
    expect(ctx.db.all('postLikes')).toHaveLength(0)
    expect(ctx.db.all('userActivities')).toHaveLength(0)
    expect(await userPoints(ctx, userId)).toBe(0)
  })

  it('createComment on a missing post is rejected with zero rows and zero points', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Commenter')
    const postId = await seedPost(ctx, userId)
    await ctx.db.delete(postId)
    ctx.__testUserId = userId

    await expect(callHandler(createComment, ctx, { postId, body: 'Mantap!' })).rejects.toThrow(
      'Postingan tidak ditemukan',
    )
    expect(ctx.db.all('postComments')).toHaveLength(0)
    expect(ctx.db.all('userActivities')).toHaveLength(0)
    expect(await userPoints(ctx, userId)).toBe(0)
  })
})

describe('community: like points awarded on first like only (no unlike→relike farming)', () => {
  it('first like +5, unlike +0, relike +0, repeated toggle loops +0', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Liker')
    const postId = await seedPost(ctx, userId)
    ctx.__testUserId = userId

    const liked = await callHandler(likePost, ctx, { postId })
    expect(liked).toMatchObject({ success: true, liked: true })
    expect(await userPoints(ctx, userId)).toBe(5)

    const unliked = await callHandler(likePost, ctx, { postId })
    expect(unliked).toMatchObject({ success: true, liked: false })
    expect(await userPoints(ctx, userId)).toBe(5)

    const reliked = await callHandler(likePost, ctx, { postId })
    expect(reliked).toMatchObject({ success: true, liked: true })
    expect(await userPoints(ctx, userId)).toBe(5)

    // Unlike→relike farming loop: three more full cycles award nothing.
    for (let i = 0; i < 3; i++) {
      await callHandler(likePost, ctx, { postId })
      await callHandler(likePost, ctx, { postId })
    }
    expect(await userPoints(ctx, userId)).toBe(5)
    expect(
      ctx.db.all('userActivities').filter((a) => a.activityType === 'post_liked'),
    ).toHaveLength(1)
    expect(ctx.db.all('postLikes')).toHaveLength(1)
  })

  it('first like is per-user: another user liking the same post earns their own +5', async () => {
    const ctx = freshCtx()
    const userA = await seedUser(ctx, 'A')
    const userB = await seedUser(ctx, 'B')
    const postId = await seedPost(ctx, userA)

    ctx.__testUserId = userA
    await callHandler(likePost, ctx, { postId })
    ctx.__testUserId = userB
    await callHandler(likePost, ctx, { postId })

    expect(await userPoints(ctx, userA)).toBe(5)
    expect(await userPoints(ctx, userB)).toBe(5)
  })

  it('comment on an existing post still awards +10 (no over-correction)', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Commenter')
    const postId = await seedPost(ctx, userId)
    ctx.__testUserId = userId

    const res = await callHandler(createComment, ctx, { postId, body: 'Mantap!' })
    expect(res).toMatchObject({ success: true })
    expect(ctx.db.all('postComments')).toHaveLength(1)
    expect(await userPoints(ctx, userId)).toBe(10)
  })
})

describe('assistant quota: single-flight (at most one winner, never over limit)', () => {
  it('quota limits are unchanged (basic 20/day, advanced 100/day)', () => {
    expect(getAssistantMessageLimit('basic')).toBe(20)
    expect(getAssistantMessageLimit()).toBe(20)
    expect(getAssistantMessageLimit('advanced')).toBe(100)
  })

  it('double-send with 1 quota left: exactly one succeeds, loser leaves no rows', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Racer')
    const threadId = await seedThread(ctx, userId)
    const limit = getAssistantMessageLimit('basic')
    await seedUserMessages(ctx, threadId, limit - 1)
    ctx.__testUserId = userId

    const first = await callHandler(sendAssistantMessage, ctx, { body: 'pesan pertama' })
    expect(first.success).toBe(true)
    expect(first.quota).toMatchObject({ usedToday: limit, limit, remainingToday: 0 })

    await expect(callHandler(sendAssistantMessage, ctx, { body: 'pesan kedua' })).rejects.toThrow(
      'Batas penggunaan asisten harian sudah tercapai',
    )

    // Exactly one winner: one user message + one assistant placeholder on top
    // of the 19 seeded, and a single AI actuation.
    expect(
      ctx.db.all('assistantMessages').filter((m) => m.threadId === threadId && m.role === 'user'),
    ).toHaveLength(limit)
    expect(ctx.db.all('assistantMessages').filter((m) => m.threadId === threadId)).toHaveLength(
      limit + 1,
    )
    expect(schedulerCalls(ctx)).toHaveLength(1)
  })

  it('concurrent double-send never exceeds quota and actuates AI at most once', async () => {
    // NOTE: the in-memory fake executes overlapping mutations against shared
    // tables with no OCC/retry, so two flights that both pass the pre-check
    // can both observe each other's reservation rows and both roll back.
    // Production Convex serializes via OCC: the loser retries, fails the
    // pre-check, and exactly one succeeds. This test locks the invariants
    // that hold in BOTH worlds: quota never exceeded, no orphan rows, no
    // double actuation.
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Racer')
    const threadId = await seedThread(ctx, userId)
    const limit = getAssistantMessageLimit('basic')
    await seedUserMessages(ctx, threadId, limit - 1)
    ctx.__testUserId = userId

    const outcomes = await Promise.allSettled([
      callHandler(sendAssistantMessage, ctx, { body: 'tab A' }),
      callHandler(sendAssistantMessage, ctx, { body: 'tab B' }),
    ])
    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled')
    const rejected = outcomes.filter((o) => o.status === 'rejected')
    for (const r of rejected) {
      expect(quotaErrorOf((r as PromiseRejectedResult).reason)).toContain('Batas penggunaan')
    }

    const usersToday = ctx.db
      .all('assistantMessages')
      .filter((m) => m.threadId === threadId && m.role === 'user')
    expect(usersToday.length).toBeLessThanOrEqual(limit)
    // Rows come in winner pairs (user + assistant placeholder) or are fully
    // rolled back: total is seeded 19, or 19 + exactly one pair.
    const total = ctx.db.all('assistantMessages').filter((m) => m.threadId === threadId).length
    expect([limit - 1, limit + 1]).toContain(total)
    expect(usersToday.length).toBe(total === limit + 1 ? limit : limit - 1)
    // At most one winner → at most one AI actuation, and winners agree.
    expect(schedulerCalls(ctx).length).toBeLessThanOrEqual(1)
    expect(fulfilled.length).toBe(schedulerCalls(ctx).length)
    expect(fulfilled.length + rejected.length).toBe(2)
  })

  it('send at quota writes nothing and schedules nothing', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Capped')
    const threadId = await seedThread(ctx, userId)
    const limit = getAssistantMessageLimit('basic')
    await seedUserMessages(ctx, threadId, limit)
    ctx.__testUserId = userId

    await expect(callHandler(sendAssistantMessage, ctx, { body: 'halo' })).rejects.toThrow(
      'Batas penggunaan asisten harian sudah tercapai',
    )
    expect(ctx.db.all('assistantMessages').filter((m) => m.threadId === threadId)).toHaveLength(
      limit,
    )
    expect(schedulerCalls(ctx)).toHaveLength(0)
  })
})

describe('assistant quota: UTC day boundary', () => {
  it('getStartOfToday buckets in UTC (midnight UTC), independent of server TZ', () => {
    // 2026-06-15T23:30Z is 2026-06-16 06:30 in UTC+7: server-local midnight
    // would return 17:00Z, UTC bucketing returns 00:00Z.
    expect(getStartOfToday(Date.UTC(2026, 5, 15, 23, 30, 0))).toBe(Date.UTC(2026, 5, 15, 0, 0, 0))
    expect(getStartOfToday(Date.UTC(2026, 5, 16, 0, 0, 0))).toBe(Date.UTC(2026, 5, 16, 0, 0, 0))
    expect(getStartOfToday(Date.UTC(2026, 5, 16, 0, 0, 0, 1))).toBe(Date.UTC(2026, 5, 16, 0, 0, 0))
    expect(getStartOfToday(Date.now()) % DAY_MS).toBe(0)
  })

  it('a message from the previous UTC day does not consume today quota', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'TzUser')
    const threadId = await seedThread(ctx, userId)
    const now = Date.now()
    const utcStart = Math.floor(now / DAY_MS) * DAY_MS
    // 1ms before UTC midnight: previous UTC day, but still "today" under a
    // UTC+7 server-local bucketing — must NOT count.
    await seedUserMessages(ctx, threadId, 1, utcStart - 1)
    ctx.__testUserId = userId

    const res = await callHandler(sendAssistantMessage, ctx, { body: 'halo' })
    expect(res.success).toBe(true)
    expect(res.quota.usedToday).toBe(1)
    expect(res.quota.resetsAt).toBe(utcStart + DAY_MS)
  })

  it('resetsAt is the next UTC midnight', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'ResetUser')
    await seedThread(ctx, userId)
    ctx.__testUserId = userId

    const now = Date.now()
    const utcStart = Math.floor(now / DAY_MS) * DAY_MS
    const res = await callHandler(sendAssistantMessage, ctx, { body: 'halo' })
    expect(res.quota.resetsAt).toBe(utcStart + DAY_MS)
    expect(res.quota.resetsAt % DAY_MS).toBe(0)
  })
})
