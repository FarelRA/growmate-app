"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import productsData from "../seedData/products";
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

// ─── Official Products ────────────────────────────────────

export const products = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";
    const adminEmail = env.ADMIN_EMAIL;

    if (!adminEmail) {
      console.log("[seed] ADMIN_EMAIL not set, skipping products");
      return;
    }

    const admin = await ctx.runQuery(internal.users.adminLookupByEmail, {
      email: adminEmail,
    });
    if (!admin) {
      console.log("[seed] Admin user not found, skipping products");
      return;
    }

    await ensureBucket(bucket);

    for (const product of productsData) {
      const existing = await ctx.runQuery(
        internal.seedInternal.lookupOfficialProductByTitle,
        { title: product.title },
      );
      if (existing) {
        continue;
      }

      const imageUrl = await uploadSeedImages(
        bucket,
        product.image.hash,
        product.image.sizes,
      );

      await ctx.runMutation(internal.seedInternal.insertOfficialProduct, {
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        quantityAvailable: product.quantityAvailable,
        priceUnit: product.priceUnit,
        featured: product.featured,
        shopeeUrl: product.shopeeUrl,
        imageUrl,
        sellerId: admin._id,
      });

    }
  },
});
