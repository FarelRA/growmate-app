import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser, requireUser } from './helpers/auth'
import { formatCurrencyIdr } from './helpers/generic'
import { enrichMarketplaceProduct, enrichMarketplaceProducts, getMarketplaceThreadsForUser } from './helpers/marketplace'
import {
  LISTING_DRAFTS_PER_USER_CAP,
} from './crons'
import {
  saveDraftCore,
  publishDraftCore,
  setListingStatusCore,
  updateListingCore,
  deleteDraftCore,
  deleteListingCore,
} from './marketplace/listings'
import {
  sendMessageCore,
  replyThreadCore,
  markThreadReadCore,
} from './marketplace/threads'

// Thin-delegate module: every export below keeps the api.marketplace.* surface
// identical. Auth/ownership/cap gates stay VISIBLE here; pure DB logic lives in
// ./marketplace/listings.ts (draft/listing CRUD) and ./marketplace/threads.ts
// (thread/message/read cores). Re-exported so the `convex/marketplace` import
// path keeps working (tests + internal callers).
export { trimMarketplaceThreadToCap } from './marketplace/threads'

export const marketplace = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    const [officialProducts, communityProducts, listingDrafts, userListings, marketplaceThreads] =
      user
        ? await Promise.all([
            ctx.db
              .query('products')
              .withIndex('by_type_and_status', (q) =>
                q.eq('type', 'official').eq('status', 'active'),
              )
              .take(8),
            ctx.db
              .query('products')
              .withIndex('by_type_and_status', (q) =>
                q.eq('type', 'community').eq('status', 'active'),
              )
              .take(24),
            ctx.db
              .query('listingDrafts')
              .withIndex('by_user', (q) => q.eq('userId', user._id))
              .take(6),
            ctx.db
              .query('products')
              .withIndex('by_seller_and_type', (q) =>
                q.eq('sellerId', user._id).eq('type', 'community'),
              )
              .take(12),
            getMarketplaceThreadsForUser(ctx, user._id),
          ])
        : [
            await ctx.db
              .query('products')
              .withIndex('by_type_and_status', (q) =>
                q.eq('type', 'official').eq('status', 'active'),
              )
              .take(8),
            await ctx.db
              .query('products')
              .withIndex('by_type_and_status', (q) =>
                q.eq('type', 'community').eq('status', 'active'),
              )
              .take(24),
            [],
            [],
            [],
          ]

    const [official, community, myListings] = await Promise.all([
      enrichMarketplaceProducts(ctx, officialProducts, user?._id),
      enrichMarketplaceProducts(ctx, communityProducts, user?._id),
      enrichMarketplaceProducts(ctx, userListings, user?._id),
    ])

    return {
      official,
      community,
      featured: official.find((product) => product.featured) ?? official[0] ?? null,
      listingDrafts: listingDrafts.map((draft) => ({
        ...draft,
        imageUrl: draft.imageUrl ?? null,
        quantityLabel: `${draft.quantity} ${draft.quantityUnit}`,
        priceLabel: `${formatCurrencyIdr(draft.price)} / ${draft.priceUnit}`,
        statusLabel: draft.status.charAt(0).toUpperCase() + draft.status.slice(1),
      })),
      myListings,
      threads: marketplaceThreads,
    }
  },
})

export const getProductById = query({
  args: { productId: v.id('products') },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId)
    if (!product) return null
    const user = await getCurrentUser(ctx)
    return enrichMarketplaceProduct(ctx, product, user?._id)
  },
})

export const saveMarketplaceDraft = mutation({
  args: {
    draftId: v.optional(v.id('listingDrafts')),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    quantity: v.number(),
    quantityUnit: v.string(),
    price: v.number(),
    priceUnit: v.string(),
    imageUrl: v.optional(v.string()),
    locationLabel: v.string(),
    contactPreference: v.union(v.literal('chat'), v.literal('pickup'), v.literal('delivery')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()
    if (!args.title.trim() || !args.description.trim() || !args.category.trim()) {
      throw new ConvexError('Judul, deskripsi, dan kategori wajib diisi')
    }
    if (args.quantity <= 0) {
      throw new ConvexError('Jumlah harus lebih besar dari nol')
    }
    if (args.price < 0) {
      throw new ConvexError('Harga tidak boleh bernilai negatif')
    }
    let imageUrl = args.imageUrl

    if (args.draftId) {
      const existing = await ctx.db.get(args.draftId)
      if (!existing || String(existing.userId) !== String(user._id)) {
        throw new ConvexError('Draft tidak ditemukan')
      }
      imageUrl = imageUrl ?? existing.imageUrl
    }

    if (!imageUrl) {
      throw new ConvexError('Gambar penawaran wajib diisi')
    }

    if (args.draftId) {
      return saveDraftCore(ctx, user, args, imageUrl, now, args.draftId)
    }

    // Hard cap: 20 drafts/user — reject over cap, no grandfathering.
    const existing = await ctx.db
      .query('listingDrafts')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .take(LISTING_DRAFTS_PER_USER_CAP + 1)
    if (existing.length >= LISTING_DRAFTS_PER_USER_CAP) {
      throw new ConvexError(
        'Batas draft listing tercapai (maksimal 20 per pengguna). Publikasikan atau hapus draft yang tidak dipakai sebelum menambah.',
      )
    }

    return saveDraftCore(ctx, user, args, imageUrl, now)
  },
})

export const publishMarketplaceDraft = mutation({
  args: { draftId: v.id('listingDrafts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const draft = await ctx.db.get(args.draftId)
    if (!draft || String(draft.userId) !== String(user._id)) {
      throw new ConvexError('Draft tidak ditemukan')
    }
    if (draft.quantity <= 0) {
      throw new ConvexError('Jumlah pada draft harus lebih besar dari nol sebelum dipublikasikan')
    }

    const now = Date.now()
    return publishDraftCore(ctx, user, draft, now)
  },
})

export const updateMarketplaceListingStatus = mutation({
  args: {
    productId: v.id('products'),
    status: v.union(
      v.literal('active'),
      v.literal('reserved'),
      v.literal('sold'),
      v.literal('archived'),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || String(product.sellerId) !== String(user._id) || product.type !== 'community') {
      throw new ConvexError('Penawaran tidak ditemukan')
    }

    return setListingStatusCore(ctx, args.productId, args.status, Date.now())
  },
})

export const updateMarketplaceListing = mutation({
  args: {
    productId: v.id('products'),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    quantity: v.number(),
    quantityUnit: v.string(),
    price: v.number(),
    priceUnit: v.string(),
    imageUrl: v.optional(v.string()),
    locationLabel: v.string(),
    contactPreference: v.union(v.literal('chat'), v.literal('pickup'), v.literal('delivery')),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || String(product.sellerId) !== String(user._id) || product.type !== 'community') {
      throw new ConvexError('Penawaran tidak ditemukan')
    }

    if (!args.title.trim() || !args.description.trim() || !args.category.trim()) {
      throw new ConvexError('Judul, deskripsi, dan kategori wajib diisi')
    }
    if (args.quantity <= 0) {
      throw new ConvexError('Jumlah harus lebih besar dari nol')
    }
    if (args.price < 0) {
      throw new ConvexError('Harga tidak boleh bernilai negatif')
    }

    const imageUrl = args.imageUrl ?? product.imageUrl

    return updateListingCore(ctx, args.productId, args, imageUrl, Date.now())
  },
})

export const deleteMarketplaceDraft = mutation({
  args: { draftId: v.id('listingDrafts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const draft = await ctx.db.get(args.draftId)
    if (!draft || String(draft.userId) !== String(user._id)) {
      throw new ConvexError('Draft tidak ditemukan')
    }

    return deleteDraftCore(ctx, args.draftId)
  },
})

export const deleteMarketplaceListing = mutation({
  args: { productId: v.id('products') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || String(product.sellerId) !== String(user._id) || product.type !== 'community') {
      throw new ConvexError('Penawaran tidak ditemukan')
    }

    return deleteListingCore(ctx, args.productId)
  },
})

export const sendMarketplaceMessage = mutation({
  args: {
    productId: v.id('products'),
    threadId: v.optional(v.id('marketplaceThreads')),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const product = await ctx.db.get(args.productId)
    if (!product || product.type !== 'community') {
      throw new ConvexError('Penawaran tidak ditemukan')
    }
    if (String(product.sellerId) === String(user._id)) {
      throw new ConvexError('Penjual tidak dapat memulai percakapan pada listing miliknya sendiri')
    }

    const now = Date.now()
    const body = args.body.trim()
    if (!body) {
      throw new ConvexError('Pesan tidak boleh kosong')
    }

    const thread = args.threadId ? await ctx.db.get(args.threadId) : null
    if (thread) {
      if (
        String(thread.productId) !== String(args.productId) ||
        String(thread.buyerId) !== String(user._id)
      ) {
        throw new ConvexError('Percakapan tidak ditemukan')
      }
    }

    return sendMessageCore(ctx, user, product, thread, body, now)
  },
})

export const replyMarketplaceThread = mutation({
  args: {
    threadId: v.id('marketplaceThreads'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const thread = await ctx.db.get(args.threadId)
    if (!thread) {
      throw new ConvexError('Percakapan tidak ditemukan')
    }
    if (
      String(thread.buyerId) !== String(user._id) &&
      String(thread.sellerId) !== String(user._id)
    ) {
      throw new ConvexError('Percakapan tidak ditemukan')
    }

    const now = Date.now()
    const body = args.body.trim()
    if (!body) {
      throw new ConvexError('Pesan tidak boleh kosong')
    }

    return replyThreadCore(ctx, user, thread, body, now)
  },
})

export const markMarketplaceThreadRead = mutation({
  args: { threadId: v.id('marketplaceThreads') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const thread = await ctx.db.get(args.threadId)
    if (!thread) {
      throw new ConvexError('Percakapan tidak ditemukan')
    }
    const now = Date.now()
    const isSeller = String(thread.sellerId) === String(user._id)
    const isBuyer = String(thread.buyerId) === String(user._id)
    if (!isSeller && !isBuyer) {
      throw new ConvexError('Percakapan tidak ditemukan')
    }

    return markThreadReadCore(ctx, user, thread, now)
  },
})
