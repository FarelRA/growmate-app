import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  requireAdmin, enrichBlogPost, resolveStoredImageUrl,
} from './helpers'

export const publicBlog = query({
  args: {},
  handler: async (ctx) => {
    const posts = await ctx.db
      .query('blogPosts')
      .withIndex('by_published_and_createdAt', (q) => q.eq('published', true))
      .order('desc')
      .take(24)

    return await Promise.all(posts.map((post) => enrichBlogPost(ctx, post)))
  },
})

export const adminSaveBlogPost = mutation({
  args: {
    postId: v.optional(v.id('blogPosts')),
    title: v.string(),
    excerpt: v.string(),
    body: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    published: v.boolean(),
    featured: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)
    const now = Date.now()
    const existing = args.postId ? await ctx.db.get(args.postId) : null
    const image = await resolveStoredImageUrl(ctx, args.imageStorageId)
    const finalImage = image ?? existing?.image
    const finalImageStorageId = args.imageStorageId ?? existing?.imageStorageId

    if (args.postId && !existing) {
      throw new Error('Postingan blog tidak ditemukan')
    }

    if (!finalImage) {
      throw new Error('Gambar sampul blog wajib diisi')
    }

    const payload = {
      authorId: admin._id,
      title: args.title.trim(),
      excerpt: args.excerpt.trim(),
      body: args.body.trim(),
      image: finalImage,
      imageStorageId: finalImageStorageId,
      published: args.published,
      featured: args.featured,
      updatedAt: now,
    }

    if (existing) {
      await ctx.db.patch(existing._id, payload)
      return { success: true, postId: existing._id }
    }

    const postId = await ctx.db.insert('blogPosts', {
      ...payload,
      createdAt: now,
    })

    return { success: true, postId }
  },
})

export const adminDeleteBlogPost = mutation({
  args: { postId: v.id('blogPosts') },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)
    const post = await ctx.db.get(args.postId)
    if (!post) {
      throw new Error('Postingan blog tidak ditemukan')
    }

    await ctx.db.delete(args.postId)
    return { success: true }
  },
})
