import type { Ctx, BlogPostDoc } from '../types'
import { formatTimestamp, getRelativeTime } from './generic'

export async function enrichBlogPost(ctx: Ctx, post: BlogPostDoc) {
  const author = await ctx.db.get(post.authorId)

  return {
    ...post,
    imageUrl: post.imageUrl ?? null,
    authorName: author?.name ?? author?.email ?? 'GrowMate admin',
    createdAtLabel: formatTimestamp(post.createdAt),
    relativeTime: getRelativeTime(post.createdAt),
  }
}
