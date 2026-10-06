/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import {
  sendAssistantMessage,
  resetAssistantThread,
  getAssistantMessageLimit,
} from '../../convex/assistant'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

/**
 * The shared fake's `withIndex` query builder only implements `eq`, but
 * `getAssistantUsage` (assistant.ts:99) chains `.gte('createdAt', …)` and
 * `sendAssistantMessage` needs `ctx.scheduler.runAfter`. Neither source file
 * may be touched, so this helper upgrades the fake ctx in place: a
 * gte-capable query layer over the same underlying tables plus a no-op
 * scheduler stub.
 */
function withAssistantSupport(ctx: FakeCtx): FakeCtx {
  ;(ctx as any).scheduler = { runAfter: async () => undefined }
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

async function seedUser(
  ctx: FakeCtx,
  name: string,
  tier: 'basic' | 'advanced' = 'basic',
): Promise<string> {
  return await ctx.db.insert('users', { name, role: 'grower', tier })
}

async function seedThread(ctx: FakeCtx, userId: string): Promise<string> {
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
  createdAt: number = now,
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

function freshCtx(): FakeCtx {
  return withAssistantSupport(createFakeCtx())
}

describe('sendAssistantMessage: quota and ownership', () => {
  it('enforces the basic daily quota (20/day) and writes nothing on rejection', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Basic')
    const threadId = await seedThread(ctx, userId)
    await seedUserMessages(ctx, threadId, getAssistantMessageLimit('basic'))
    ctx.__testUserId = userId

    await expect(callHandler(sendAssistantMessage, ctx, { body: 'halo' })).rejects.toThrow(
      'Batas penggunaan asisten harian sudah tercapai',
    )
    expect(ctx.db.all('assistantMessages')).toHaveLength(getAssistantMessageLimit('basic'))
  })

  it('allows sends below quota and returns the decremented quota', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Basic')
    const threadId = await seedThread(ctx, userId)
    const limit = getAssistantMessageLimit('basic')
    await seedUserMessages(ctx, threadId, limit - 1)
    ctx.__testUserId = userId

    const res = await callHandler(sendAssistantMessage, ctx, { body: 'halo' })
    expect(res.success).toBe(true)
    expect(res.quota).toMatchObject({ usedToday: limit, limit, remainingToday: 0 })
    // One user message + one assistant placeholder row.
    expect(ctx.db.all('assistantMessages')).toHaveLength(limit + 1)
  })

  it('advanced tier has a higher limit than basic', async () => {
    const limit = getAssistantMessageLimit('advanced')
    expect(limit).toBeGreaterThan(getAssistantMessageLimit('basic'))

    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Pro', 'advanced')
    const threadId = await seedThread(ctx, userId)
    await seedUserMessages(ctx, threadId, getAssistantMessageLimit('basic'))
    ctx.__testUserId = userId

    const res = await callHandler(sendAssistantMessage, ctx, { body: 'halo' })
    expect(res.success).toBe(true)
    expect(res.quota.limit).toBe(limit)
    expect(res.quota.remainingToday).toBe(limit - getAssistantMessageLimit('basic') - 1)
  })

  it('rejects a deviceId owned by another user', async () => {
    const ctx = freshCtx()
    const userA = await seedUser(ctx, 'A')
    const userB = await seedUser(ctx, 'B')
    await ctx.db.insert('devices', {
      deviceId: 'GM-B',
      name: 'Pod GM-B',
      userId: userB,
      createdAt: now,
      updatedAt: now,
    })
    ctx.__testUserId = userA

    await expect(
      callHandler(sendAssistantMessage, ctx, { body: 'halo', deviceId: 'GM-B' }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
  })

  it('rejects unauthenticated senders', async () => {
    const ctx = freshCtx()
    ctx.__testUserId = null
    await expect(callHandler(sendAssistantMessage, ctx, { body: 'halo' })).rejects.toThrow(
      'Autentikasi diperlukan',
    )
  })
})

describe('resetAssistantThread: per-user scoping', () => {
  it('deletes only the caller thread, leaving other users threads intact', async () => {
    const ctx = freshCtx()
    const userA = await seedUser(ctx, 'A')
    const userB = await seedUser(ctx, 'B')
    const threadA = await seedThread(ctx, userA)
    const threadB = await seedThread(ctx, userB)
    await seedUserMessages(ctx, threadA, 3)
    await seedUserMessages(ctx, threadB, 3)

    ctx.__testUserId = userA
    const res = await callHandler(resetAssistantThread, ctx, {})
    expect(res.success).toBe(true)

    expect(await ctx.db.get(threadA)).toBeNull()
    expect(ctx.db.all('assistantMessages').filter((m) => m.threadId === threadA)).toHaveLength(0)
    expect(await ctx.db.get(threadB)).not.toBeNull()
    expect(ctx.db.all('assistantMessages').filter((m) => m.threadId === threadB)).toHaveLength(3)
  })

  it('succeeds as a no-op when the caller has no thread', async () => {
    const ctx = freshCtx()
    const userId = await seedUser(ctx, 'Fresh')
    ctx.__testUserId = userId
    await expect(callHandler(resetAssistantThread, ctx, {})).resolves.toMatchObject({
      success: true,
    })
  })

  it('rejects unauthenticated reset', async () => {
    const ctx = freshCtx()
    ctx.__testUserId = null
    await expect(callHandler(resetAssistantThread, ctx, {})).rejects.toThrow(
      'Autentikasi diperlukan',
    )
  })
})
