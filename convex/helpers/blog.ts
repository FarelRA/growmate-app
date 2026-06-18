import type { Ctx, BlogPostDoc } from '../types'
import { resolveStoredImageUrl, formatTimestamp, getRelativeTime } from './generic'

export async function enrichBlogPost(ctx: Ctx, post: BlogPostDoc) {
  const [author, image] = await Promise.all([
    ctx.db.get(post.authorId),
    resolveStoredImageUrl(ctx, post.imageStorageId, post.image),
  ])

  return {
    ...post,
    image,
    authorName: author?.name ?? author?.email ?? 'GrowMate admin',
    createdAtLabel: formatTimestamp(post.createdAt),
    relativeTime: getRelativeTime(post.createdAt),
  }
}
