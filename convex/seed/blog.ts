"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import blogData from "../seedData/blog";
import { uploadSeedImageSet } from "./images";

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
}

// ─── Blog Posts ───────────────────────────────────────────

export const blog = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const bucket = env.RUSTFS_BUCKET_IMAGE ?? "growmate-images";
    const adminEmail = env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.log("[seed] ADMIN_EMAIL not set, skipping blog");
      return;
    }

    const admin = await ctx.runQuery(internal.users.adminLookupByEmail, {
      email: adminEmail,
    });
    if (!admin) {
      console.log("[seed] Admin user not found, skipping blog");
      return;
    }

    let created = 0;
    let skipped = 0;
    for (const post of blogData) {
      const existing = await ctx.runQuery(internal.seedInternal.lookupBlogPostByTitle, {
        title: post.title,
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const imageUrl = await uploadSeedImageSet(bucket, post.image.hash);

      await ctx.runMutation(internal.seedInternal.insertBlogPost, {
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        published: post.published,
        featured: post.featured,
        imageUrl,
        authorId: admin._id,
      });
      created += 1;
    }
    console.log(`[seed] blog: ${created} created, ${skipped} already present`);
  },
});
