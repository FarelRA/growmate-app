import type { Id } from '../_generated/dataModel'
import type { MutationCtx, UserDoc } from '../types'
import { addUserActivity } from '../helpers/generic'

// Post CRUD cores extracted from ../community.ts (pre-alpha split, zero API
// change: api.community.* exports stay identical thin delegates).
//
// Gate ownership: auth (requireUser), input validation, and the post-ownership
// check stay VISIBLE in the ../community.ts delegates. Cores below perform
// pure DB reads/writes only and assume authorized, validated input plus
// delegate-verified docs. Read/view helpers (counts, post view) stay in
// ../community.ts alongside the queries that use them.

export async function createPostCore(
  ctx: MutationCtx,
  user: UserDoc,
  title: string,
  body: string,
  imageUrl: string | undefined,
  now: number,
) {
  // Preconditions (delegate-verified): title/body trimmed non-empty.
  const postId = await ctx.db.insert('communityPosts', {
    userId: user._id,
    title,
    body,
    imageUrl: imageUrl ?? undefined,
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
}

export async function deletePostCore(ctx: MutationCtx, postId: Id<'communityPosts'>) {
  // Precondition (delegate-verified): post belongs to the caller.
  // Paginated deletes until exhausted — no silent orphans.
  while (true) {
    const likes = await ctx.db
      .query('postLikes')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .take(100)
    if (likes.length === 0) break
    for (const like of likes) {
      await ctx.db.delete(like._id)
    }
    if (likes.length < 100) break
  }

  while (true) {
    const comments = await ctx.db
      .query('postComments')
      .withIndex('by_post', (q) => q.eq('postId', postId))
      .take(100)
    if (comments.length === 0) break
    for (const comment of comments) {
      await ctx.db.delete(comment._id)
    }
    if (comments.length < 100) break
  }

  await ctx.db.delete(postId)
  return { success: true }
}
