import { v, ConvexError } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { Ctx, CommunityPostDoc } from './types'
import { getCurrentUser, requireUser } from './helpers/auth'
import { getRelativeTime } from './helpers/generic'
import { createPostCore, deletePostCore } from './community/posts'
import { toggleLikeCore, createCommentCore } from './community/engagement'

// Thin-delegate module: every export below keeps the api.community.* surface
// identical. Auth (requireUser), input validation, post-exists guards, and the
// post-ownership check stay VISIBLE here; pure DB logic lives in
// ./community/posts.ts (post CRUD cores) and ./community/engagement.ts
// (like/comment cores, incl. first-like-only reward semantics).

const COMMUNITY_COMMENT_PAGE = 20
const COMMUNITY_COMMENT_SHOWN = 6

async function countPostLikes(ctx: Ctx, postId: Id<'communityPosts'>) {
  // Per-post scope (a handful of rows): plain collect. Must NOT paginate —
  // getCommunityPostView counts likes AND comments in one function, and
  // Convex allows only a single .paginate() per function (live 500).
  const likes = await ctx.db
    .query('postLikes')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect()
  return likes.length
}

async function countPostComments(ctx: Ctx, postId: Id<'communityPosts'>) {
  // Same single-paginate rule as countPostLikes above.
  const comments = await ctx.db
    .query('postComments')
    .withIndex('by_post', (q) => q.eq('postId', postId))
    .collect()
  return comments.length
}

async function getCommunityPostView(ctx: Ctx, post: CommunityPostDoc, viewerId?: Id<'users'>) {
  const [likeCount, commentCount, postUser, viewerLike] = await Promise.all([
    countPostLikes(ctx, post._id),
    countPostComments(ctx, post._id),
    ctx.db.get(post.userId),
    viewerId
      ? ctx.db
          .query('postLikes')
          .withIndex('by_user_and_post', (q) => q.eq('userId', viewerId).eq('postId', post._id))
          .first()
      : Promise.resolve(null),
  ])
  // Latest comments page (20) via indexed read, show newest 6 in chronological order.
  const latestComments = await ctx.db
    .query('postComments')
    .withIndex('by_post_createdAt', (q) => q.eq('postId', post._id))
    .order('desc')
    .take(COMMUNITY_COMMENT_PAGE)
  const shownComments = latestComments
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-COMMUNITY_COMMENT_SHOWN)
  const uniqueIds = [...new Set(shownComments.map((c) => c.userId))] as Id<'users'>[]
  const commentUsers = new Map<string, Doc<'users'> | null>()
  const userDocs = await Promise.all(uniqueIds.map((id) => ctx.db.get(id)))
  uniqueIds.forEach((id, i) => commentUsers.set(String(id), userDocs[i] ?? null))

  return {
    ...post,
    imageUrl: post.imageUrl ?? null,
    user: postUser,
    likeCount,
    commentCount,
    viewerHasLiked: Boolean(viewerLike),
    timestamp: getRelativeTime(post.createdAt),
    comments: shownComments.map((comment) => ({
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
    // Indexed desc read: the old query('users').take(10) full-scan returned an
    // arbitrary 10 users, so in-memory top-3 was wrong past 10 users.
    // by_points is on optional points; docs missing points are skipped by the
    // index, so this covers ranked users. take(6) feeds both leaderboard (3)
    // and fullLeaderboard (6).
    const topUsers = await ctx.db.query('users').withIndex('by_points').order('desc').take(6)
    const posts = await ctx.db
      .query('communityPosts')
      .withIndex('by_createdAt')
      .order('desc')
      .take(12)

    const postsWithCounts = await Promise.all(
      posts.map((post) => getCommunityPostView(ctx, post, user?._id)),
    )

    const usersWithPoints = topUsers.map((u) => ({ ...u, points: u.points ?? 0 }))

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
    return createPostCore(ctx, user, title, body, args.imageUrl, now)
  },
})

export const likePost = mutation({
  args: { postId: v.id('communityPosts') },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    // Existence first: never create orphan likes/activity on a missing post.
    const post = await ctx.db.get(args.postId)
    if (!post) {
      throw new ConvexError('Postingan tidak ditemukan')
    }
    return toggleLikeCore(ctx, user, args.postId)
  },
})

export const createComment = mutation({
  args: { postId: v.id('communityPosts'), body: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx)
    // Existence first: never create orphan comments/activity on a missing post.
    const post = await ctx.db.get(args.postId)
    if (!post) {
      throw new ConvexError('Postingan tidak ditemukan')
    }
    const now = Date.now()
    const body = args.body.trim()
    if (!body) {
      throw new ConvexError('Komentar tidak boleh kosong')
    }
    return createCommentCore(ctx, user, args.postId, body, now)
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

    return deletePostCore(ctx, args.postId)
  },
})
