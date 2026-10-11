"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import productsData from "../seedData/products";
import { uploadSeedImageSet } from "./images";

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
}

// ─── Official Products ────────────────────────────────────

export const products = internalAction({
  handler: async (ctx) => {
    const env = getEnv();
    const bucket = env.RUSTFS_BUCKET_IMAGE ?? "growmate-images";
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

    let created = 0;
    let skipped = 0;
    for (const product of productsData) {
      const existing = await ctx.runQuery(
        internal.seedInternal.lookupOfficialProductByTitle,
        { title: product.title },
      );
      if (existing) {
        skipped += 1;
        continue;
      }

      const imageUrl = await uploadSeedImageSet(bucket, product.image.hash);

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
      created += 1;
    }
    console.log(`[seed] products: ${created} created, ${skipped} already present`);
  },
});
