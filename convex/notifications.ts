import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import { getCurrentUser, requireUser, formatTimestamp, getRelativeTime } from './helpers'

export const headerNotifications = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) {
      return { items: [], unreadCount: 0 }
    }

    const items = await ctx.db
      .query('notifications')
      .withIndex('by_user', (q) => q.eq('userId', user._id))
      .order('desc')
      .take(8)

    return {
      items: items.map((notification) => ({
        ...notification,
        createdAtLabel: formatTimestamp(notification.createdAt),
        relativeTime: getRelativeTime(notification.createdAt),
      })),
      unreadCount: items.filter((notification) => !notification.read).length,
    }
  },
})

export const markNotificationRead = mutation({
  args: { notificationId: v.id('notifications') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const notification = await ctx.db.get(args.notificationId)
    if (!notification || String(notification.userId) !== String(user._id)) {
      throw new ConvexError('Notifikasi tidak ditemukan')
    }

    if (!notification.read) {
      await ctx.db.patch(args.notificationId, {
        read: true,
        readAt: Date.now(),
      })
    }

    return { success: true }
  },
})
