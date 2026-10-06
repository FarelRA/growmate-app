import type { QueryCtx } from '../_generated/server'
import { enrichBlogPost } from '../helpers/blog'

// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates in
// ../admin.ts. Cores here perform pure DB logic.

// Blog core: cursor-paginated, enriched exactly like the legacy array query
// so the dashboard `data.blogPosts` array keeps its fields.
export async function fetchAdminBlogPostsPaginated(
  ctx: QueryCtx,
  paginationOpts: { cursor: string | null; numItems: number },
) {
  const result = await ctx.db
    .query('blogPosts')
    .withIndex('by_createdAt')
    .order('desc')
    .paginate(paginationOpts)
  const page = await Promise.all(result.page.map((post) => enrichBlogPost(ctx, post)))
  return { ...result, page }
}
