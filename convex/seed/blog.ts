"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import blogData from "../seedData/blog";
import { ensureBucket, uploadFile } from "../seedData/storage";

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
}

function parseDataUri(uri: string): Buffer {
  const base64 = uri.split(",")[1]!;
  return Buffer.from(base64, "base64");
}

const IMAGE_SIZES_FOR_SEED = ["50w", "200w", "400w", "800w", "1200w"] as const;

async function uploadSeedImages(
  bucket: string,
  hash: string,
  sizes: Record<string, string>,
): Promise<string> {
  for (const size of IMAGE_SIZES_FOR_SEED) {
    const uri = sizes[size];
    if (!uri) continue;
    const buffer = parseDataUri(uri);
    await uploadFile(bucket, `${hash}/${size}.webp`, buffer, "image/webp");
  }
  return hash;
}

// ─── Blog Posts ───────────────────────────────────────────

export const blog = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";
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

    await ensureBucket(bucket);

    for (const post of blogData) {
      const existing = await ctx.runQuery(internal.seedInternal.lookupBlogPostByTitle, {
        title: post.title,
      });
      if (existing) {
        continue;
      }

      const imageUrl = await uploadSeedImages(
        bucket,
        post.image.hash,
        post.image.sizes,
      );

      await ctx.runMutation(internal.seedInternal.insertBlogPost, {
        title: post.title,
        excerpt: post.excerpt,
        body: post.body,
        published: post.published,
        featured: post.featured,
        imageUrl,
        authorId: admin._id,
      });

    }
  },
});
