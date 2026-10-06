import type { QueryCtx } from '../_generated/server'
import { enrichBlogPost } from '../helpers/blog'

// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates in
// ../admin.ts. Cores here perform pure DB logic.

// Blog core (moved verbatim from ../admin.ts).
export async function fetchAdminBlogPosts(ctx: QueryCtx) {
  const blogPosts = await ctx.db.query('blogPosts').withIndex('by_createdAt').order('desc').take(24)
  return Promise.all(blogPosts.map((post) => enrichBlogPost(ctx, post)))
}
