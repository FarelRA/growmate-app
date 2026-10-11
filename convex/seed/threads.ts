"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import usersData from "../seedData/users";
import threadsData from "../seedData/threads";

const day = 86400000;

// ─── Marketplace Threads + Messages ─────────────────────

export const threads = internalAction({
  handler: async (ctx) => {
    const emails = usersData.map((u) => u.email);
    let created = 0;
    let skipped = 0;

    for (const t of threadsData) {
      const product = await ctx.runQuery(
        internal.seedInternal.lookupCommunityProductByTitle,
        { title: t.productTitle },
      );
      if (!product) {
        console.log(`[seed] listing not found, skipping thread: ${t.productTitle}`);
        continue;
      }
      const buyerEmail = emails[t.buyerIndex % emails.length]!;
      const buyer = await ctx.runQuery(internal.users.adminLookupByEmail, { email: buyerEmail });
      const seller = await ctx.runQuery(internal.seedInternal.lookupUserById, {
        userId: product.sellerId,
      });
      if (!buyer || !seller || String(buyer._id) === String(seller._id)) continue;

      const existing = await ctx.runQuery(internal.seedInternal.lookupThreadByProductBuyer, {
        productId: product._id,
        buyerId: buyer._id,
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      const now = Date.now();
      await ctx.runMutation(internal.seedInternal.seedThread, {
        productId: product._id,
        buyerId: buyer._id,
        sellerId: product.sellerId,
        buyerName: buyer.name,
        sellerName: seller.name,
        productTitle: product.title,
        productImage: product.imageUrl,
        productStatus: product.status,
        messages: t.messages.map((m, i) => ({
          senderId: m.from === "buyer" ? buyer._id : product.sellerId,
          body: m.body,
          createdAt: now - m.dayAgo * day + i * 3600000,
        })),
      });
      created += 1;
    }

    console.log(`[seed] threads: ${created} created, ${skipped} already present`);
  },
});
