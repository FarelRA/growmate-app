import type { Ctx, ProductDoc } from '../types'
import type { Id } from '../_generated/dataModel'
import { resolveStoredImageUrl, formatTimestamp, formatCurrencyIdr } from './generic'

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
  const seller = await ctx.db.get(product.sellerId)
  const image = await resolveStoredImageUrl(ctx, product.imageStorageId, product.image)
  const thread =
    viewerId && product.type === 'community'
      ? await ctx.db
          .query('marketplaceThreads')
          .withIndex('by_product_and_buyer', (q) =>
            q.eq('productId', product._id).eq('buyerId', viewerId),
          )
          .first()
      : null

  return {
    ...product,
    sellerName: seller?.name ?? 'Penjual tidak diketahui',
    sellerAvatar: seller?.avatar ?? 'GM',
    sellerId: seller?._id,
    image,
    priceLabel: `${formatCurrencyIdr(product.price)} / ${product.priceUnit}`,
    quantityLabel: `${product.quantityAvailable} ${product.quantityUnit ?? 'item'}`,
    statusLabel: formatMarketplaceStatus(product.status),
    contactThreadId: thread?._id ?? null,
  }
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
          new Map(docs.filter(Boolean).map((d) => [String(d!._id), d!])),
        )
      : Promise.resolve(new Map()),
    needsBuyer.length
      ? Promise.all(needsBuyer.map((t) => ctx.db.get(t.buyerId))).then((docs) =>
          new Map(docs.filter(Boolean).map((d) => [String(d!._id), d!])),
        )
      : Promise.resolve(new Map()),
    needsSeller.length
      ? Promise.all(needsSeller.map((t) => ctx.db.get(t.sellerId))).then((docs) =>
          new Map(docs.filter(Boolean).map((d) => [String(d!._id), d!])),
        )
      : Promise.resolve(new Map()),
  ])

  return await Promise.all(
    uniqueThreads.map(async (thread) => {
      const productTitle = thread.productTitle ?? productMap.get(String(thread.productId))?.title ?? 'Listing tidak diketahui'
      const productImage = thread.productImage ?? productMap.get(String(thread.productId))?.image
      const productStatus = thread.productStatus ?? productMap.get(String(thread.productId))?.status ?? 'archived'

      const buyerName = thread.buyerName ?? buyerMap.get(String(thread.buyerId))?.name ?? 'Pembeli'
      const buyerAvatar = buyerMap.get(String(thread.buyerId))?.avatar ?? 'BY'
      const sellerName = thread.sellerName ?? sellerMap.get(String(thread.sellerId))?.name ?? 'Penjual'
      const sellerAvatar = sellerMap.get(String(thread.sellerId))?.avatar ?? 'SL'

      const messages = await ctx.db
        .query('marketplaceMessages')
        .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id))
        .order('desc')
        .take(16)

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
    }),
  )
}

export { formatCurrencyIdr } from './generic'
