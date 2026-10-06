import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, UserDoc } from '../types'
import {
  MARKETPLACE_MESSAGES_PER_THREAD_CAP,
  overflowBeyondCap,
} from '../crons'

// Thread/message DB cores extracted from ../marketplace.ts (pre-alpha split,
// zero API change: api.marketplace.* exports stay identical thin delegates).
//
// Gate ownership: auth (requireUser), product checks (exists + community type
// + seller-may-not-initiate), thread membership checks, and body validation
// stay VISIBLE in the ../marketplace.ts delegates. Cores below perform pure
// DB reads/writes only and assume delegate-verified docs and input.
//
// trimMarketplaceThreadToCap is re-exported from ../marketplace.ts so the
// existing `convex/marketplace` import path keeps working.

export type MarketplaceThreadDoc = Doc<'marketplaceThreads'>

// Hard retention cap: 200 messages/thread, trim oldest. No grandfathering.
export async function trimMarketplaceThreadToCap(
  ctx: MutationCtx,
  threadId: Id<'marketplaceThreads'>,
) {
  while (true) {
    const newestFirst = await ctx.db
      .query('marketplaceMessages')
      .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', threadId))
      .order('desc')
      .take(500)
    const overflow = overflowBeyondCap(newestFirst, MARKETPLACE_MESSAGES_PER_THREAD_CAP)
    if (overflow.length === 0) break
    for (const message of overflow) {
      await ctx.db.delete(message._id)
    }
    if (newestFirst.length < 500) break
  }
}

export async function sendMessageCore(
  ctx: MutationCtx,
  user: UserDoc,
  product: Doc<'products'>,
  thread: MarketplaceThreadDoc | null,
  body: string,
  now: number,
) {
  // Preconditions (delegate-verified): product is community type, user is not
  // the seller, body trimmed non-empty, and the given thread (when provided)
  // belongs to this product + buyer.
  let current = thread
  if (!current) {
    current = await ctx.db
      .query('marketplaceThreads')
      .withIndex('by_product_and_buyer', (q) =>
        q.eq('productId', product._id).eq('buyerId', user._id),
      )
      .first()
  }

  let threadId = current?._id
  if (!threadId) {
    const [buyer, seller] = await Promise.all([
      ctx.db.get(user._id),
      ctx.db.get(product.sellerId),
    ])
    threadId = await ctx.db.insert('marketplaceThreads', {
      productId: product._id,
      buyerId: user._id,
      sellerId: product.sellerId,
      buyerName: buyer?.name,
      sellerName: seller?.name,
      productTitle: product.title,
      productImage: product.imageUrl,
      productStatus: product.status,
      lastMessagePreview: body.slice(0, 160),
      lastMessageAt: now,
      buyerUnreadCount: 0,
      sellerUnreadCount: 1,
      createdAt: now,
      updatedAt: now,
    })
  } else {
    await ctx.db.patch(threadId, {
      lastMessagePreview: body.slice(0, 160),
      lastMessageAt: now,
      sellerUnreadCount: (current?.sellerUnreadCount ?? 0) + 1,
      updatedAt: now,
    })
  }

  await ctx.db.insert('marketplaceMessages', {
    threadId,
    senderId: user._id,
    body,
    createdAt: now,
  })

  await trimMarketplaceThreadToCap(ctx, threadId)

  await ctx.db.insert('notifications', {
    userId: product.sellerId,
    title: 'Pertanyaan marketplace baru',
    detail: `${user.name ?? 'Seorang pembeli'} menghubungi Anda tentang ${product.title}.`,
    kind: 'commerce',
    read: false,
    createdAt: now,
  })

  return { success: true, threadId }
}

export async function replyThreadCore(
  ctx: MutationCtx,
  user: UserDoc,
  thread: MarketplaceThreadDoc,
  body: string,
  now: number,
) {
  // Precondition (delegate-verified): user is the buyer or seller of the thread.
  const isSeller = String(thread.sellerId) === String(user._id)
  const receiverId = isSeller ? thread.buyerId : thread.sellerId

  await ctx.db.insert('marketplaceMessages', {
    threadId: thread._id,
    senderId: user._id,
    body,
    createdAt: now,
  })

  await trimMarketplaceThreadToCap(ctx, thread._id)

  await ctx.db.patch(thread._id, {
    lastMessagePreview: body.slice(0, 160),
    lastMessageAt: now,
    buyerUnreadCount: isSeller ? thread.buyerUnreadCount + 1 : 0,
    sellerUnreadCount: isSeller ? 0 : thread.sellerUnreadCount + 1,
    updatedAt: now,
  })

  await ctx.db.insert('notifications', {
    userId: receiverId,
    title: 'Balasan marketplace baru',
    detail: `${user.name ?? 'Seseorang'} membalas percakapan marketplace Anda.`,
    kind: 'commerce',
    read: false,
    createdAt: now,
  })

  return { success: true }
}

export async function markThreadReadCore(
  ctx: MutationCtx,
  user: UserDoc,
  thread: MarketplaceThreadDoc,
  now: number,
) {
  // Precondition (delegate-verified): user is the buyer or seller of the thread.
  const isSeller = String(thread.sellerId) === String(user._id)
  const isBuyer = String(thread.buyerId) === String(user._id)

  await ctx.db.patch(thread._id, {
    buyerUnreadCount: isBuyer ? 0 : thread.buyerUnreadCount,
    sellerUnreadCount: isSeller ? 0 : thread.sellerUnreadCount,
    updatedAt: now,
  })

  // Paginated to cover all messages — no 40-row ceiling.
  let cursor: string | null = null
  while (true) {
    const page = await ctx.db
      .query('marketplaceMessages')
      .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id))
      .paginate({ cursor, numItems: 100 })
    for (const message of page.page) {
      if (String(message.senderId) !== String(user._id) && !message.readAt) {
        await ctx.db.patch(message._id, { readAt: now })
      }
    }
    if (page.isDone) break
    cursor = page.continueCursor
  }

  return { success: true }
}
