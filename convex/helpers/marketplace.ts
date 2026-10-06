import type { Ctx, ProductDoc } from '../types'
import type { Doc, Id } from '../_generated/dataModel'
import { ConvexError } from 'convex/values'
import { formatTimestamp, formatCurrencyIdr } from './generic'

function formatMarketplaceStatus(status: 'active' | 'reserved' | 'sold' | 'archived') {
  switch (status) {
    case 'active':
      return 'Tersedia'
    case 'reserved':
      return 'Dipesan'
    case 'sold':
      return 'Terjual'
    case 'archived':
      return 'Diarsipkan'
  }
}

export async function enrichMarketplaceProduct(ctx: Ctx, product: ProductDoc, viewerId?: Id<'users'>) {
  const enriched = await enrichMarketplaceProducts(ctx, [product], viewerId)
  const first = enriched[0]
  if (!first) throw new ConvexError('Penawaran tidak ditemukan')
  return first
}

export async function enrichMarketplaceProducts(
  ctx: Ctx,
  products: ProductDoc[],
  viewerId?: Id<'users'>,
) {
  // Batch seller gets: collect unique sellerIds, fetch once, then map.
  const sellerIds = [...new Set(products.map((p) => String(p.sellerId)))]
  const sellerDocs = await Promise.all(
    sellerIds.map((id) => ctx.db.get(id as Id<'users'>)),
  )
  const sellerMap = new Map(sellerIds.map((id, i) => [id, sellerDocs[i] ?? null]))

  // Batch thread lookups: collect-then-map, no await-in-loop.
  let threadMap = new Map<string, Doc<'marketplaceThreads'> | null>()
  if (viewerId) {
    const communityProducts = products.filter((p) => p.type === 'community')
    const threadDocs = await Promise.all(
      communityProducts.map((p) =>
        ctx.db
          .query('marketplaceThreads')
          .withIndex('by_product_and_buyer', (q) =>
            q.eq('productId', p._id).eq('buyerId', viewerId),
          )
          .first(),
      ),
    )
    threadMap = new Map(
      communityProducts.map((p, i) => [String(p._id), threadDocs[i] ?? null] as const),
    )
  }

  return products.map((product) => {
    const seller = sellerMap.get(String(product.sellerId))
    const thread = threadMap.get(String(product._id))
    return {
      ...product,
      sellerName: seller?.name ?? 'Penjual tidak diketahui',
      sellerAvatar: seller?.avatar ?? 'GM',
      sellerId: seller?._id,
      imageUrl: product.imageUrl ?? null,
      priceLabel: `${formatCurrencyIdr(product.price)} / ${product.priceUnit}`,
      quantityLabel: `${product.quantityAvailable} ${product.quantityUnit ?? 'item'}`,
      statusLabel: formatMarketplaceStatus(product.status),
      contactThreadId: thread?._id ?? null,
    }
  })
}

export async function getMarketplaceThreadsForUser(ctx: Ctx, userId: Id<'users'>) {
  const [buyerThreads, sellerThreads] = await Promise.all([
    ctx.db
      .query('marketplaceThreads')
      .withIndex('by_buyer_and_lastMessageAt', (q) => q.eq('buyerId', userId))
      .order('desc')
      .take(12),
    ctx.db
      .query('marketplaceThreads')
      .withIndex('by_seller_and_lastMessageAt', (q) => q.eq('sellerId', userId))
      .order('desc')
      .take(12),
  ])

  const uniqueThreads = [...buyerThreads, ...sellerThreads].filter(
    (thread, index, list) =>
      list.findIndex((item) => String(item._id) === String(thread._id)) === index,
  )

  const needsProduct = uniqueThreads.filter((t) => !t.productTitle)
  const needsBuyer = uniqueThreads.filter((t) => !t.buyerName)
  const needsSeller = uniqueThreads.filter((t) => !t.sellerName)

  const [productMap, buyerMap, sellerMap] = await Promise.all([
    needsProduct.length
      ? Promise.all(needsProduct.map((t) => ctx.db.get(t.productId))).then((docs) =>
          new Map(docs.filter((d): d is Doc<'products'> => d !== null).map((d) => [String(d._id), d])),
        )
      : Promise.resolve(new Map<string, Doc<'products'>>()),
    needsBuyer.length
      ? Promise.all(needsBuyer.map((t) => ctx.db.get(t.buyerId))).then((docs) =>
          new Map(docs.filter((d): d is Doc<'users'> => d !== null).map((d) => [String(d._id), d])),
        )
      : Promise.resolve(new Map<string, Doc<'users'>>()),
    needsSeller.length
      ? Promise.all(needsSeller.map((t) => ctx.db.get(t.sellerId))).then((docs) =>
          new Map(docs.filter((d): d is Doc<'users'> => d !== null).map((d) => [String(d._id), d])),
        )
      : Promise.resolve(new Map<string, Doc<'users'>>()),
  ])

  // Batch message reads: collect all pages first, then map (no await-in-loop).
  const messagesList = await Promise.all(
    uniqueThreads.map((thread) =>
      ctx.db
        .query('marketplaceMessages')
        .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id))
        .order('desc')
        .take(16),
    ),
  )

  return uniqueThreads.map((thread, index) => {
      const productTitle = thread.productTitle ?? productMap.get(String(thread.productId))?.title ?? 'Listing tidak diketahui'
      const productImage = thread.productImage ?? productMap.get(String(thread.productId))?.imageUrl
      const productStatus = thread.productStatus ?? productMap.get(String(thread.productId))?.status ?? 'archived'

      const buyerName = thread.buyerName ?? buyerMap.get(String(thread.buyerId))?.name ?? 'Pembeli'
      const buyerAvatar = buyerMap.get(String(thread.buyerId))?.avatar ?? 'BY'
      const sellerName = thread.sellerName ?? sellerMap.get(String(thread.sellerId))?.name ?? 'Penjual'
      const sellerAvatar = sellerMap.get(String(thread.sellerId))?.avatar ?? 'SL'

      const messages = messagesList[index] ?? []

      return {
        ...thread,
        role: String(thread.sellerId) === String(userId) ? 'seller' : 'buyer',
        productTitle,
        productImage,
        productStatus,
        participantName:
          String(thread.sellerId) === String(userId) ? buyerName : sellerName,
        participantAvatar:
          String(thread.sellerId) === String(userId) ? buyerAvatar : sellerAvatar,
        messages: messages.reverse().map((message) => ({
          ...message,
          createdAtLabel: formatTimestamp(message.createdAt),
          mine: String(message.senderId) === String(userId),
        })),
      }
    })
}
