import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireUser, requireAdmin, formatTimestamp, getSupportMessages } from './helpers'

export const supportInbox = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx)
    const supportRequests = await ctx.db
      .query('supportRequests')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .take(50)

    const supportThreads = await Promise.all(
      supportRequests
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map(async (request) => ({
          ...request,
          createdAtLabel: formatTimestamp(request.createdAt),
          updatedAtLabel: formatTimestamp(request.updatedAt),
          messages: (await getSupportMessages(ctx, request._id, 40)).map((message) => ({
            ...message,
            createdAtLabel: formatTimestamp(message.createdAt),
            mine: String(message.senderUserId) === String(user._id),
          })),
        })),
    )

    return {
      requests: supportThreads,
      activeCount: supportThreads.filter(
        (request) => request.status !== 'resolved' && request.status !== 'closed',
      ).length,
    }
  },
})

export const createSupportRequest = mutation({
  args: {
    topic: v.string(),
    priority: v.optional(
      v.union(v.literal('low'), v.literal('normal'), v.literal('high'), v.literal('urgent')),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const topic = args.topic.trim()
    if (!topic) {
      throw new Error('Topik dukungan wajib diisi')
    }

    const now = Date.now()
    const requestId = await ctx.db.insert('supportRequests', {
      userId: user._id,
      topic,
      status: 'open',
      priority: args.priority ?? 'normal',
      createdAt: now,
      updatedAt: now,
    })

    await ctx.db.insert('supportMessages', {
      requestId,
      senderUserId: user._id,
      senderRole: 'user',
      body: topic,
      createdAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: user._id,
      title: 'Permintaan dukungan dibuka',
      detail: `Permintaan Anda tentang ${topic.toLowerCase()} sudah kami catat dan masuk ke antrean dukungan.`,
      kind: 'assistant',
      read: false,
      createdAt: now,
    })

    return { success: true, requestId }
  },
})

export const sendSupportMessage = mutation({
  args: {
    requestId: v.id('supportRequests'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request) {
      throw new Error('Permintaan dukungan tidak ditemukan')
    }

    const isAdmin = user.role === 'admin'
    const isOwner = String(request.userId) === String(user._id)
    if (!isAdmin && !isOwner) {
      throw new Error('Permintaan dukungan tidak ditemukan')
    }

    const body = args.body.trim()
    if (!body) {
      throw new Error('Pesan tidak boleh kosong')
    }

    const now = Date.now()
    await ctx.db.insert('supportMessages', {
      requestId: args.requestId,
      senderUserId: user._id,
      senderRole: isAdmin ? 'admin' : 'user',
      body,
      createdAt: now,
    })

    await ctx.db.patch(args.requestId, {
      updatedAt: now,
      status: isAdmin ? 'in_progress' : request.status === 'closed' ? 'open' : request.status,
      handledBy: isAdmin ? user._id : request.handledBy,
    })

    const receiverId = isAdmin ? request.userId : request.handledBy
    if (receiverId && String(receiverId) !== String(user._id)) {
      await ctx.db.insert('notifications', {
        userId: receiverId,
        title: isAdmin ? 'Tim dukungan membalas' : 'Balasan dukungan baru',
        detail: isAdmin
          ? 'Tim dukungan telah membalas tiket Anda.'
          : 'Ada pesan baru pada tiket dukungan Anda.',
        kind: 'assistant',
        read: false,
        createdAt: now,
      })
    }

    return { success: true }
  },
})

export const closeSupportRequest = mutation({
  args: {
    requestId: v.id('supportRequests'),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request || String(request.userId) !== String(user._id)) {
      throw new Error('Permintaan dukungan tidak ditemukan')
    }

    const now = Date.now()
    await ctx.db.patch(args.requestId, {
      status: 'closed',
      updatedAt: now,
    })

    await ctx.db.insert('supportMessages', {
      requestId: args.requestId,
      senderUserId: user._id,
      senderRole: 'system',
      body: 'Tiket ditutup oleh pengguna.',
      createdAt: now,
    })

    if (request.handledBy) {
      await ctx.db.insert('notifications', {
        userId: request.handledBy,
        title: 'Tiket dukungan ditutup',
        detail: `${user.name ?? 'Seorang pengguna'} menutup tiket dukungannya.`,
        kind: 'assistant',
        read: false,
        createdAt: now,
      })
    }

    return { success: true }
  },
})

export const adminUpdateSupportRequest = mutation({
  args: {
    requestId: v.id('supportRequests'),
    status: v.union(
      v.literal('open'),
      v.literal('in_progress'),
      v.literal('resolved'),
      v.literal('closed'),
    ),
    priority: v.optional(
      v.union(v.literal('low'), v.literal('normal'), v.literal('high'), v.literal('urgent')),
    ),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const request = await ctx.db.get(args.requestId)
    if (!request) {
       throw new Error('Permintaan dukungan tidak ditemukan')
    }

    const now = Date.now()
    await ctx.db.patch(args.requestId, {
      status: args.status,
      priority: args.priority ?? request.priority,
      handledBy: admin._id,
      updatedAt: now,
    })

    await ctx.db.insert('notifications', {
      userId: request.userId,
      title: 'Tiket dukungan diperbarui',
      detail: `Permintaan dukungan Anda sekarang ${args.status.replace('_', ' ')}.`,
      kind: 'assistant',
      read: false,
      createdAt: now,
    })

    return { success: true }
  },
})
