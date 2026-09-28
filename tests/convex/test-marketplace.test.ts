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
  saveMarketplaceDraft,
  publishMarketplaceDraft,
  deleteMarketplaceListing,
  sendMarketplaceMessage,
  replyMarketplaceThread,
  markMarketplaceThreadRead,
} from '../../convex/marketplace'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

const draftArgs = {
  title: 'Bibit Cabai',
  description: 'Bibit cabai rawit segar',
  category: 'benih',
  quantity: 10,
  quantityUnit: 'pack',
  price: 15000,
  priceUnit: 'pack',
  imageUrl: 'https://img.example/seed.jpg',
  locationLabel: 'Bandung',
  contactPreference: 'chat',
} as const

async function seedUsers(ctx: FakeCtx) {
  const seller = await ctx.db.insert('users', { name: 'Seller', role: 'user' })
  const buyer = await ctx.db.insert('users', { name: 'Buyer', role: 'user' })
  const outsider = await ctx.db.insert('users', { name: 'Outsider', role: 'user' })
  return { seller, buyer, outsider }
}

async function seedProduct(ctx: FakeCtx, seller: string) {
  ctx.__testUserId = seller
  const draft = await callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })
  const pub = await callHandler(publishMarketplaceDraft, ctx, { draftId: draft.draftId })
  return pub.productId as string
}

describe('marketplace draft -> publish', () => {
  let ctx: FakeCtx
  let seller: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    ;({ seller } = await seedUsers(ctx))
    ctx.__testUserId = seller
  })

  it('saves a draft and publishes it as an active community listing', async () => {
    const draft = await callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })
    expect(draft.success).toBe(true)
    const pub = await callHandler(publishMarketplaceDraft, ctx, { draftId: draft.draftId })
    expect(pub.success).toBe(true)
    const product = await ctx.db.get(pub.productId)
    expect(product!.type).toBe('community')
    expect(product!.status).toBe('active')
    expect(product!.quantityAvailable).toBe(10)
    expect((await ctx.db.get(draft.draftId))!.status).toBe('published')
    expect(ctx.db.all('notifications')).toHaveLength(1)
  })

  it('rejects drafts with zero quantity or missing image', async () => {
    await expect(
      callHandler(saveMarketplaceDraft, ctx, { ...draftArgs, quantity: 0 }),
    ).rejects.toThrow('Jumlah harus lebih besar dari nol')
    await expect(
      callHandler(saveMarketplaceDraft, ctx, { ...draftArgs, imageUrl: undefined }),
    ).rejects.toThrow('Gambar penawaran wajib diisi')
  })
})

describe('marketplace thread flow: create -> message -> read -> delete', () => {
  let ctx: FakeCtx
  let seller: string
  let buyer: string
  let outsider: string
  let productId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    ;({ seller, buyer, outsider } = await seedUsers(ctx))
    productId = await seedProduct(ctx, seller)
  })

  it('buyer creates a thread, both sides chat, reader marks read, seller deletes', async () => {
    ctx.__testUserId = buyer
    const first = await callHandler(sendMarketplaceMessage, ctx, {
      productId,
      body: 'Apakah masih tersedia?',
    })
    expect(first.success).toBe(true)
    const threadId = first.threadId as string
    let thread = await ctx.db.get(threadId)
    expect(thread!.sellerUnreadCount).toBe(1)
    expect(thread!.buyerUnreadCount).toBe(0)

    // Second message reuses the same thread and bumps the seller counter.
    const second = await callHandler(sendMarketplaceMessage, ctx, {
      productId,
      body: 'Bisa kirim ke Jakarta?',
    })
    expect(String(second.threadId)).toBe(String(threadId))
    thread = await ctx.db.get(threadId)
    expect(thread!.sellerUnreadCount).toBe(2)

    // Seller replies: buyer gets an unread, seller counter resets.
    ctx.__testUserId = seller
    await callHandler(replyMarketplaceThread, ctx, {
      threadId,
      body: 'Bisa, ongkir ditanggung pembeli.',
    })
    thread = await ctx.db.get(threadId)
    expect(thread!.buyerUnreadCount).toBe(1)
    expect(thread!.sellerUnreadCount).toBe(0)

    // Buyer marks the thread read: counter resets and seller messages get readAt.
    ctx.__testUserId = buyer
    await callHandler(markMarketplaceThreadRead, ctx, { threadId })
    thread = await ctx.db.get(threadId)
    expect(thread!.buyerUnreadCount).toBe(0)
    const messages = ctx.db.all('marketplaceMessages')
    expect(messages).toHaveLength(3)
    const sellerMessages = messages.filter((m) => String(m.senderId) === String(seller))
    expect(sellerMessages).toHaveLength(1)
    expect(sellerMessages[0]!.readAt).toBeDefined()

    // Seller deletes the listing: product, threads, and messages cascade.
    ctx.__testUserId = seller
    const del = await callHandler(deleteMarketplaceListing, ctx, { productId })
    expect(del.success).toBe(true)
    expect(await ctx.db.get(productId)).toBeNull()
    expect(ctx.db.all('marketplaceThreads')).toHaveLength(0)
    expect(ctx.db.all('marketplaceMessages')).toHaveLength(0)
  })

  it('marks all messages as read when a thread has more than 40', async () => {
    ctx.__testUserId = buyer
    const { threadId } = await callHandler(sendMarketplaceMessage, ctx, {
      productId,
      body: 'Halo, saya tertarik.',
    })
    // 45 seller messages arrive after the buyer's opener (46 total).
    for (let i = 0; i < 45; i++) {
      await ctx.db.insert('marketplaceMessages', {
        threadId,
        senderId: seller,
        body: `Pesan penjual #${i + 1}`,
        createdAt: now + i,
      })
    }
    await callHandler(markMarketplaceThreadRead, ctx, { threadId })
    const messages = ctx.db.all('marketplaceMessages')
    expect(messages).toHaveLength(46)
    const marked = messages.filter((m) => m.readAt !== undefined)
    const unmarked = messages.filter((m) => m.readAt === undefined)
    // Fixed behavior: paginated read covers all messages, so every seller
    // message is marked; only the buyer's own opener stays unmarked.
    expect(marked).toHaveLength(45)
    expect(unmarked).toHaveLength(1)
    expect((await ctx.db.get(threadId as string))!.buyerUnreadCount).toBe(0)
  })

  it('seller cannot start a conversation on their own listing', async () => {
    ctx.__testUserId = seller
    await expect(
      callHandler(sendMarketplaceMessage, ctx, { productId, body: 'Halo' }),
    ).rejects.toThrow('Penjual tidak dapat memulai percakapan')
  })

  it('rejects empty message bodies', async () => {
    ctx.__testUserId = buyer
    await expect(
      callHandler(sendMarketplaceMessage, ctx, { productId, body: '   ' }),
    ).rejects.toThrow('Pesan tidak boleh kosong')
  })

  it('rejects replies from users outside the thread', async () => {
    ctx.__testUserId = buyer
    const { threadId } = await callHandler(sendMarketplaceMessage, ctx, {
      productId,
      body: 'Halo',
    })
    ctx.__testUserId = outsider
    await expect(
      callHandler(replyMarketplaceThread, ctx, { threadId, body: 'Spam' }),
    ).rejects.toThrow('Percakapan tidak ditemukan')
  })

  it('rejects listing deletion by non-sellers', async () => {
    ctx.__testUserId = buyer
    await expect(callHandler(deleteMarketplaceListing, ctx, { productId })).rejects.toThrow(
      'Penawaran tidak ditemukan',
    )
  })
})
