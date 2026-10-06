import type { Id } from '../_generated/dataModel'
import type { MutationCtx, UserDoc } from '../types'
import { addUserActivity } from '../helpers/generic'

// Like/comment cores extracted from ../community.ts (pre-alpha split, zero
// API change: api.community.* exports stay identical thin delegates).
//
// Gate ownership: auth (requireUser) and the post-exists guard
// ('Postingan tidak ditemukan') stay VISIBLE in the ../community.ts delegates.
// Cores below assume delegate-verified posts. First-like-only reward semantics
// are preserved EXACTLY: post_liked points are awarded on the FIRST like only —
// unlike awards nothing, and relike after unlike awards nothing, so
// unlike→relike loops can never farm leaderboard points. Comments always
// award comment_created on the inserted comment.

export async function toggleLikeCore(
  ctx: MutationCtx,
  user: UserDoc,
  postId: Id<'communityPosts'>,
) {
  // Precondition (delegate-verified): post exists — never create orphan
  // likes/activity on a missing post.
  const existing = await ctx.db
    .query('postLikes')
    .withIndex('by_user_and_post', (q) => q.eq('userId', user._id).eq('postId', postId))
    .first()

  if (existing) {
    await ctx.db.delete(existing._id)
    return { success: true, liked: false }
  }

  const now = Date.now()
  await ctx.db.insert('postLikes', {
    postId,
    userId: user._id,
    createdAt: now,
  })

  // Likes are a toggle: award post_liked points on the FIRST like only.
  // Unlike awards nothing, and relike after unlike awards nothing, so
  // unlike→relike loops can never farm leaderboard points.
  const pastLikes = await ctx.db
    .query('userActivities')
    .withIndex('by_user', (q) => q.eq('userId', user._id))
    .collect()
  const alreadyRewarded = pastLikes.some(
    (activity) =>
      activity.activityType === 'post_liked' && String(activity.relatedId) === String(postId),
  )
  if (!alreadyRewarded) {
    await addUserActivity(ctx, {
      userId: user._id,
      activityType: 'post_liked',
      relatedId: postId,
      createdAt: now,
    })
  }

  return { success: true, liked: true }
}

export async function createCommentCore(
  ctx: MutationCtx,
  user: UserDoc,
  postId: Id<'communityPosts'>,
  body: string,
  now: number,
) {
  // Preconditions (delegate-verified): post exists — never create orphan
  // comments/activity on a missing post; body trimmed non-empty.
  const commentId = await ctx.db.insert('postComments', {
    postId,
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
}
