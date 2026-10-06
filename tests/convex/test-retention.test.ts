/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import {
  ASSISTANT_MESSAGES_PER_THREAD_CAP,
  ASSISTANT_MESSAGES_TTL_DAYS,
  SUPPORT_MESSAGES_PER_TICKET_CAP,
  MARKETPLACE_MESSAGES_PER_THREAD_CAP,
  LISTING_DRAFTS_PER_USER_CAP,
  CARE_SCHEDULES_PER_PLANT_CAP,
  retentionCutoff,
  overflowBeyondCap,
} from '../../convex/crons'
import { trimAssistantThreadToCap, assistantCreateSchedule } from '../../convex/assistant'
import { trimSupportTicketToCap, sendSupportMessage } from '../../convex/support'
import {
  trimMarketplaceThreadToCap,
  saveMarketplaceDraft,
  replyMarketplaceThread,
} from '../../convex/marketplace'
import { deletePost } from '../../convex/community'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const DAY_MS = 24 * 60 * 60 * 1000

describe('retention caps and TTL constants', () => {
  it('defines the hard caps', () => {
    expect(ASSISTANT_MESSAGES_PER_THREAD_CAP).toBe(200)
    expect(SUPPORT_MESSAGES_PER_TICKET_CAP).toBe(200)
    expect(MARKETPLACE_MESSAGES_PER_THREAD_CAP).toBe(200)
    expect(LISTING_DRAFTS_PER_USER_CAP).toBe(20)
    expect(CARE_SCHEDULES_PER_PLANT_CAP).toBe(20)
  })

  it('defines the 90-day assistant TTL', () => {
    expect(ASSISTANT_MESSAGES_TTL_DAYS).toBe(90)
  })

  it('computes the TTL cutoff as now minus ttl days', () => {
    const now = 1_700_000_000_000
    expect(retentionCutoff(now, 90)).toBe(now - 90 * DAY_MS)
    expect(retentionCutoff(now, ASSISTANT_MESSAGES_TTL_DAYS)).toBe(now - 90 * DAY_MS)
  })

  it('overflowBeyondCap keeps the newest cap rows and returns the oldest rest', () => {
    const newestFirst = [5, 4, 3, 2, 1]
    expect(overflowBeyondCap(newestFirst, 3)).toEqual([2, 1])
    expect(overflowBeyondCap(newestFirst, 5)).toEqual([])
    expect(overflowBeyondCap(newestFirst, 10)).toEqual([])
  })
})

describe('assistantMessages 200/thread trim', () => {
  it('trims oldest beyond 200, newest survive', async () => {
    const ctx = createFakeCtx()
    const user = await ctx.db.insert('users', { name: 'U' })
    const thread = await ctx.db.insert('assistantThreads', {
      userId: user,
      title: 't',
      createdAt: 1,
      updatedAt: 1,
    })
    for (let i = 0; i < 205; i++) {
      await ctx.db.insert('assistantMessages', {
        threadId: thread,
        role: i % 2 === 0 ? 'user' : 'assistant',
        body: `msg-${i}`,
        status: 'complete',
        createdAt: 1000 + i,
      })
    }
    await trimAssistantThreadToCap(ctx as any, thread as any)
    const remaining = ctx.db.all('assistantMessages')
    expect(remaining).toHaveLength(200)
    const bodies = new Set(remaining.map((m) => m.body))
    for (let i = 0; i < 5; i++) expect(bodies.has(`msg-${i}`)).toBe(false)
    for (let i = 5; i < 205; i++) expect(bodies.has(`msg-${i}`)).toBe(true)
  })

  it('is a no-op at or under cap', async () => {
    const ctx = createFakeCtx()
    const thread = await ctx.db.insert('assistantThreads', {
      userId: 'u',
      title: 't',
      createdAt: 1,
      updatedAt: 1,
    })
    for (let i = 0; i < 200; i++) {
      await ctx.db.insert('assistantMessages', {
        threadId: thread,
        role: 'user',
        body: `m-${i}`,
        status: 'complete',
        createdAt: 1000 + i,
      })
    }
    await trimAssistantThreadToCap(ctx as any, thread as any)
    expect(ctx.db.all('assistantMessages')).toHaveLength(200)
  })
})

describe('supportMessages 200/ticket trim', () => {
  let ctx: FakeCtx
  let user: string
  let requestId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    user = await ctx.db.insert('users', { name: 'U', role: 'grower' })
    ctx.__testUserId = user
    requestId = await ctx.db.insert('supportRequests', {
      userId: user,
      topic: 'help',
      status: 'open',
      priority: 'normal',
      createdAt: 1,
      updatedAt: 1,
    })
  })

  it('sendSupportMessage trims oldest beyond 200', async () => {
    for (let i = 0; i < 200; i++) {
      await ctx.db.insert('supportMessages', {
        requestId,
        senderUserId: user,
        senderRole: 'user',
        body: `old-${i}`,
        createdAt: 1000 + i,
      })
    }
    const res = await callHandler(sendSupportMessage, ctx, {
      requestId,
      body: 'one more',
    })
    expect(res.success).toBe(true)
    const remaining = ctx.db.all('supportMessages')
    expect(remaining).toHaveLength(200)
    const bodies = new Set(remaining.map((m) => m.body))
    expect(bodies.has('one more')).toBe(true)
    expect(bodies.has('old-0')).toBe(false)
    expect(bodies.has('old-199')).toBe(true)
  })

  it('trim helper is a no-op under cap', async () => {
    await ctx.db.insert('supportMessages', {
      requestId,
      senderUserId: user,
      senderRole: 'user',
      body: 'hi',
      createdAt: 1,
    })
    await trimSupportTicketToCap(ctx as any, requestId as any)
    expect(ctx.db.all('supportMessages')).toHaveLength(1)
  })
})

describe('marketplaceMessages 200/thread trim', () => {
  it('replyMarketplaceThread trims oldest beyond 200', async () => {
    const ctx = createFakeCtx()
    const seller = await ctx.db.insert('users', { name: 'S' })
    const buyer = await ctx.db.insert('users', { name: 'B' })
    const product = await ctx.db.insert('products', { title: 'p', type: 'community' })
    const thread = await ctx.db.insert('marketplaceThreads', {
      productId: product,
      buyerId: buyer,
      sellerId: seller,
      lastMessagePreview: 'hi',
      lastMessageAt: 1,
      buyerUnreadCount: 0,
      sellerUnreadCount: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    for (let i = 0; i < 200; i++) {
      await ctx.db.insert('marketplaceMessages', {
        threadId: thread,
        senderId: i % 2 === 0 ? buyer : seller,
        body: `m-${i}`,
        createdAt: 1000 + i,
      })
    }
    ctx.__testUserId = buyer
    const res = await callHandler(replyMarketplaceThread, ctx, {
      threadId: thread,
      body: 'newest reply',
    })
    expect(res.success).toBe(true)
    const remaining = ctx.db.all('marketplaceMessages')
    expect(remaining).toHaveLength(200)
    const bodies = new Set(remaining.map((m) => m.body))
    expect(bodies.has('newest reply')).toBe(true)
    expect(bodies.has('m-0')).toBe(false)
    expect(bodies.has('m-199')).toBe(true)
  })

  it('trim helper is a no-op under cap', async () => {
    const ctx = createFakeCtx()
    const thread = await ctx.db.insert('marketplaceThreads', {
      productId: 'p',
      buyerId: 'b',
      sellerId: 's',
      lastMessagePreview: 'hi',
      lastMessageAt: 1,
      buyerUnreadCount: 0,
      sellerUnreadCount: 0,
      createdAt: 1,
      updatedAt: 1,
    })
    await trimMarketplaceThreadToCap(ctx as any, thread as any)
    expect(ctx.db.all('marketplaceMessages')).toHaveLength(0)
  })
})

const draftArgs = {
  title: 'Bibit',
  description: 'Bibit segar',
  category: 'benih',
  quantity: 5,
  quantityUnit: 'pack',
  price: 10000,
  priceUnit: 'pack',
  imageUrl: 'https://img.example/x.jpg',
  locationLabel: 'Bandung',
  contactPreference: 'chat',
} as const

describe('listingDrafts 20/user hard cap', () => {
  let ctx: FakeCtx
  beforeEach(async () => {
    ctx = createFakeCtx()
    const user = await ctx.db.insert('users', { name: 'U' })
    ctx.__testUserId = user
  })

  it('allows 20 drafts and rejects the 21st', async () => {
    for (let i = 0; i < 20; i++) {
      const res = await callHandler(saveMarketplaceDraft, ctx, {
        ...draftArgs,
        title: `Draft ${i}`,
      })
      expect(res.success).toBe(true)
    }
    await expect(
      callHandler(saveMarketplaceDraft, ctx, { ...draftArgs, title: 'Draft 21' }),
    ).rejects.toThrow('Batas draft listing tercapai')
    expect(ctx.db.all('listingDrafts')).toHaveLength(20)
  })

  it('updating an existing draft at cap still works', async () => {
    let firstId = ''
    for (let i = 0; i < 20; i++) {
      const res = await callHandler(saveMarketplaceDraft, ctx, {
        ...draftArgs,
        title: `D${i}`,
      })
      if (i === 0) firstId = res.draftId
    }
    const res = await callHandler(saveMarketplaceDraft, ctx, {
      ...draftArgs,
      draftId: firstId,
      title: 'Renamed',
    })
    expect(res.success).toBe(true)
    expect(ctx.db.all('listingDrafts')).toHaveLength(20)
  })
})

describe('careSchedules 20/plant hard cap', () => {
  it('allows 20 schedules and rejects the 21st', async () => {
    const ctx = createFakeCtx()
    const user = await ctx.db.insert('users', { name: 'U' })
    const device = await ctx.db.insert('devices', {
      userId: user,
      deviceId: 'dev-1',
      name: 'Pod',
      updatedAt: 1,
    })
    const plant = await ctx.db.insert('plants', {
      deviceId: device,
      name: 'Cabai',
      archived: false,
    })
    await ctx.db.patch(device, { plantId: plant })
    const args = {
      userId: user,
      title: 'Siram',
      cadenceUnit: 'days',
      cadenceValue: 1,
    } as const
    for (let i = 0; i < 20; i++) {
      const res = await callHandler(assistantCreateSchedule, ctx, {
        ...args,
        title: `Jadwal ${i}`,
      })
      expect(res.success).toBe(true)
    }
    await expect(
      callHandler(assistantCreateSchedule, ctx, { ...args, title: 'Jadwal 21' }),
    ).rejects.toThrow('Batas jadwal perawatan tercapai')
    expect(ctx.db.all('careSchedules')).toHaveLength(20)
  })
})

describe('deletePost beyond 100 likes/comments', () => {
  it('deletes all likes and comments when each exceeds 100', async () => {
    const ctx = createFakeCtx()
    const user = await ctx.db.insert('users', { name: 'U' })
    ctx.__testUserId = user
    const post = await ctx.db.insert('communityPosts', {
      userId: user,
      title: 'Panen',
      body: 'Panen raya',
      createdAt: 1,
      updatedAt: 1,
    })
    for (let i = 0; i < 150; i++) {
      const liker = await ctx.db.insert('users', { name: `L${i}` })
      await ctx.db.insert('postLikes', { postId: post, userId: liker, createdAt: i })
      await ctx.db.insert('postComments', {
        postId: post,
        userId: user,
        body: `komentar ${i}`,
        createdAt: i,
        updatedAt: i,
      })
    }
    expect(ctx.db.all('postLikes')).toHaveLength(150)
    expect(ctx.db.all('postComments')).toHaveLength(150)
    const res = await callHandler(deletePost, ctx, { postId: post })
    expect(res.success).toBe(true)
    expect(ctx.db.all('postLikes')).toHaveLength(0)
    expect(ctx.db.all('postComments')).toHaveLength(0)
    expect(await ctx.db.get(post)).toBeNull()
  })
})
