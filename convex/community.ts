import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { Ctx, CommunityPostDoc } from './types'
import {
  getCurrentUser, requireUser, getRelativeTime,
  addUserActivity,
} from './helpers'

async function getCommunityPostView(ctx: Ctx, post: CommunityPostDoc, viewerId?: Id<'users'>) {
  const [likes, comments, postUser] = await Promise.all([
    ctx.db
      .query('postLikes')
      .withIndex('by_post', (q) => q.eq('postId', post._id))
      .collect(),
    ctx.db
      .query('postComments')
      .withIndex('by_post', (q) => q.eq('postId', post._id))
      .collect(),
    ctx.db.get(post.userId),
  ])
  const uniqueIds = [...new Set(comments.map((c) => c.userId))] as Id<'users'>[]
  const commentUsers = new Map<string, Doc<'users'> | null>()
  await Promise.all(
    uniqueIds.map(async (id) => {
      commentUsers.set(String(id), (await ctx.db.get(id)) ?? null)
    }),
  )

  return {
    ...post,
    imageUrl: post.imageUrl ?? null,
    user: postUser,
    likeCount: likes.length,
    commentCount: comments.length,
    viewerHasLiked: viewerId
      ? likes.some((like) => String(like.userId) === String(viewerId))
      : false,
    timestamp: getRelativeTime(post.createdAt),
    comments: comments
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-6)
      .map((comment) => ({
        ...comment,
        user: commentUsers.get(String(comment.userId)),
        createdAtLabel: getRelativeTime(comment.createdAt),
      })),
  }
}

export const community = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    const users = await ctx.db.query('users').take(10)
    const posts = await ctx.db
      .query('communityPosts')
      .withIndex('by_createdAt')
      .order('desc')
      .take(12)

    const postsWithCounts = await Promise.all(
      posts.map((post) => getCommunityPostView(ctx, post, user?._id)),
    )

    const usersWithPoints = users
      .map((u) => ({ ...u, points: u.points ?? 0 }))
      .sort((a, b) => b.points - a.points)

    return {
      posts: postsWithCounts,
      leaderboard: usersWithPoints.slice(0, 3),
      fullLeaderboard: usersWithPoints.slice(0, 6),
      viewerId: user?._id ?? null,
    }
  },
})

export const getPostById = query({
  args: { postId: v.id('communityPosts') },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post) return null
    return getCommunityPostView(ctx, post, user?._id)
  },
})

export const createPost = mutation({
  args: { title: v.string(), body: v.string(), imageUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()
    const title = args.title.trim()
    const body = args.body.trim()
    if (!title || !body) {
      throw new ConvexError('Judul dan isi postingan wajib diisi')
    }
    const postId = await ctx.db.insert('communityPosts', {
      userId: user._id,
      title,
      body,
      imageUrl: args.imageUrl ?? undefined,
      createdAt: now,
      updatedAt: now,
    })

    await addUserActivity(ctx, {
      userId: user._id,
      activityType: 'post_created',
      relatedId: postId,
      createdAt: now,
    })

    return { success: true }
  },
})

export const likePost = mutation({
  args: { postId: v.id('communityPosts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const existing = await ctx.db
      .query('postLikes')
      .withIndex('by_user_and_post', (q) => q.eq('userId', user._id).eq('postId', args.postId))
      .first()

    if (existing) {
      await ctx.db.delete(existing._id)
      return { success: true, liked: false }
    }

    const now = Date.now()
    await ctx.db.insert('postLikes', {
      postId: args.postId,
      userId: user._id,
      createdAt: now,
    })

    await addUserActivity(ctx, {
      userId: user._id,
      activityType: 'post_liked',
      relatedId: args.postId,
      createdAt: now,
    })

    return { success: true, liked: true }
  },
})

export const createComment = mutation({
  args: { postId: v.id('communityPosts'), body: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const now = Date.now()
    const body = args.body.trim()
    if (!body) {
      throw new ConvexError('Komentar tidak boleh kosong')
    }
    const commentId = await ctx.db.insert('postComments', {
      postId: args.postId,
      userId: user._id,
      body,
      createdAt: now,
      updatedAt: now,
    })

    await addUserActivity(ctx, {
      userId: user._id,
      activityType: 'comment_created',
      relatedId: commentId,
      createdAt: now,
    })

    return { success: true }
  },
})

export const deletePost = mutation({
  args: { postId: v.id('communityPosts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post || String(post.userId) !== String(user._id)) {
      throw new ConvexError('Postingan tidak ditemukan')
    }

    const [likes, comments] = await Promise.all([
      ctx.db
        .query('postLikes')
        .withIndex('by_post', (q) => q.eq('postId', args.postId))
        .collect(),
      ctx.db
        .query('postComments')
        .withIndex('by_post', (q) => q.eq('postId', args.postId))
        .collect(),
    ])

    for (const like of likes) {
      await ctx.db.delete(like._id)
    }

    for (const comment of comments) {
      await ctx.db.delete(comment._id)
    }

    await ctx.db.delete(args.postId)
    return { success: true }
  },
})
