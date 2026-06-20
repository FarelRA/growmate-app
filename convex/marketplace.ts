import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser, requireUser, enrichMarketplaceProduct, getMarketplaceThreadsForUser, formatCurrencyIdr } from './helpers'

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
      Promise.all(
        officialProducts.map((product) => enrichMarketplaceProduct(ctx, product, user?._id)),
      ),
      Promise.all(
        communityProducts.map((product) => enrichMarketplaceProduct(ctx, product, user?._id)),
      ),
      Promise.all(userListings.map((product) => enrichMarketplaceProduct(ctx, product, user?._id))),
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
        statusLabel: draft.status[0]!.toUpperCase() + draft.status.slice(1),
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

    const payload = {
      userId: user._id,
      title: args.title.trim(),
      description: args.description.trim(),
      category: args.category.trim(),
      quantity: args.quantity,
      quantityUnit: args.quantityUnit.trim(),
      price: args.price,
      priceUnit: args.priceUnit.trim(),
      imageUrl,
      locationLabel: args.locationLabel.trim(),
      contactPreference: args.contactPreference,
      updatedAt: now,
    }

    if (args.draftId) {
      await ctx.db.patch(args.draftId, payload)
      return { success: true, draftId: args.draftId }
    }

    const draftId = await ctx.db.insert('listingDrafts', {
      ...payload,
      status: 'draft',
      createdAt: now,
    })
    return { success: true, draftId }
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
    const productId = await ctx.db.insert('products', {
      title: draft.title,
      description: draft.description,
      price: draft.price,
      category: draft.category,
      type: 'community',
      sellerId: user._id,
      status: 'active',
      quantityAvailable: draft.quantity,
      quantityUnit: draft.quantityUnit,
      priceUnit: draft.priceUnit,
      locationLabel: draft.locationLabel,
      contactPreference: draft.contactPreference,
      imageUrl: draft.imageUrl,
      featured: false,
      shopeeUrl: undefined,
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.patch(args.draftId, { status: 'published', updatedAt: now })

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Penawaran dipublikasikan',
      detail: `${draft.title} kini tampil di marketplace GrowMate.`,
      kind: 'commerce',
      read: false,
      createdAt: now,
    })

    return { success: true, productId }
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

    await ctx.db.patch(args.productId, {
      status: args.status,
      updatedAt: Date.now(),
    })
    return { success: true }
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

    await ctx.db.patch(args.productId, {
      title: args.title.trim(),
      description: args.description.trim(),
      category: args.category.trim(),
      quantityAvailable: args.quantity,
      quantityUnit: args.quantityUnit.trim(),
      price: args.price,
      priceUnit: args.priceUnit.trim(),
      imageUrl,
      locationLabel: args.locationLabel.trim(),
      contactPreference: args.contactPreference,
      updatedAt: Date.now(),
    })

    return { success: true }
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

    await ctx.db.delete(args.draftId)
    return { success: true }
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

    const threads = await ctx.db
      .query('marketplaceThreads')
      .withIndex('by_product', (q) => q.eq('productId', args.productId))
      .take(64)
    for (const thread of threads) {
      const messages = await ctx.db
        .query('marketplaceMessages')
        .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id))
        .take(128)
      for (const message of messages) {
        await ctx.db.delete(message._id)
      }
      await ctx.db.delete(thread._id)
    }

    await ctx.db.delete(args.productId)
    return { success: true }
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

    let thread = args.threadId ? await ctx.db.get(args.threadId) : null
    if (!thread) {
      thread = await ctx.db
        .query('marketplaceThreads')
        .withIndex('by_product_and_buyer', (q) =>
          q.eq('productId', args.productId).eq('buyerId', user._id),
        )
        .first()
    }

    let threadId = thread?._id
    if (!threadId) {
      const [buyer, seller] = await Promise.all([
        ctx.db.get(user._id),
        ctx.db.get(product.sellerId),
      ])
      threadId = await ctx.db.insert('marketplaceThreads', {
        productId: args.productId,
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
        sellerUnreadCount: (thread?.sellerUnreadCount ?? 0) + 1,
        updatedAt: now,
      })
    }

    await ctx.db.insert('marketplaceMessages', {
      threadId,
      senderId: user._id,
      body,
      createdAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: product.sellerId,
      title: 'Pertanyaan marketplace baru',
      detail: `${user.name ?? 'Seorang pembeli'} menghubungi Anda tentang ${product.title}.`,
      kind: 'commerce',
      read: false,
      createdAt: now,
    })

    return { success: true, threadId }
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
    const isSeller = String(thread.sellerId) === String(user._id)
    const receiverId = isSeller ? thread.buyerId : thread.sellerId

    await ctx.db.insert('marketplaceMessages', {
      threadId: args.threadId,
      senderId: user._id,
      body,
      createdAt: now,
    })

    await ctx.db.patch(args.threadId, {
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

    await ctx.db.patch(args.threadId, {
      buyerUnreadCount: isBuyer ? 0 : thread.buyerUnreadCount,
      sellerUnreadCount: isSeller ? 0 : thread.sellerUnreadCount,
      updatedAt: now,
    })

    const messages = await ctx.db
      .query('marketplaceMessages')
      .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', args.threadId))
      .take(40)
    for (const message of messages) {
      if (String(message.senderId) !== String(user._id) && !message.readAt) {
        await ctx.db.patch(message._id, { readAt: now })
      }
    }

    return { success: true }
  },
})
