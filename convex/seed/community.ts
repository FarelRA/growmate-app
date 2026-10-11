"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import usersData from "../seedData/users";
import communityListingsData from "../seedData/communityListings";
import communityPostsData from "../seedData/communityPosts";
import { uploadSeedImageSet } from "./images";
import type { Id } from "../_generated/dataModel";

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
}

const POST_COMMENTS = [
  "Wah, terima kasih infonya! Sangat membantu.",
  "Saya juga pernah mengalami hal serupa. Ternyata solusinya mudah ya.",
  "Mantap! Hasil panennya kelihatan segar sekali.",
  "Good info! Langsung saya coba tipsnya.",
  "Baru tahu kalau ada cara semudah ini. Makasih sharingnya!",
  "Keren banget! Semoga saya bisa seperti ini suatu hari.",
  "Aku juga pakai GrowMate dan puas banget hasilnya.",
  "Wah saya baru mau coba, jadi tambah semangat!",
];

// ─── Community Listings ───────────────────────────────────

export const community = internalAction({
  handler: async (ctx) => {
    const userIds: Id<"users">[] = [];
    for (const u of usersData) {
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: u.email });
      if (user) userIds.push(user._id);
    }

    if (userIds.length === 0) {
      console.log("[seed] No users found, skipping community data");
      return;
    }

    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";

    let listings = 0;
    for (const listing of communityListingsData) {
      const sellerId = userIds[listing.sellerIndex % userIds.length];
      if (!sellerId) continue;

      const imageUrl = await uploadSeedImageSet(bucket, listing.image.hash);

      await ctx.runMutation(internal.seedInternal.insertCommunityListing, {
        title: listing.title,
        description: listing.description,
        price: listing.price,
        category: listing.category,
        quantityAvailable: listing.quantityAvailable,
        priceUnit: listing.priceUnit,
        sellerId,
        imageUrl,
        locationLabel: listing.locationLabel,
        contactPreference: listing.contactPreference,
      });
      listings += 1;
    }

    // Community posts + comments + likes
    let posts = 0;
    for (let i = 0; i < communityPostsData.length; i++) {
      const post = communityPostsData[i]!;
      const authorId = userIds[post.userIndex % userIds.length];
      if (!authorId) continue;

      const postImageUrl = post.image
        ? await uploadSeedImageSet(bucket, post.image.hash)
        : undefined;

      const postId = await ctx.runMutation(internal.seedInternal.insertCommunityPost, {
        userId: authorId,
        title: post.title,
        body: post.body,
        imageUrl: postImageUrl,
      });
      posts += 1;

      // Add a like from another user (never the author)
      const likerId = userIds[(post.userIndex + 3) % userIds.length];
      if (likerId && likerId !== authorId) {
        await ctx.runMutation(internal.seedInternal.insertPostLike, {
          postId,
          userId: likerId,
        });
      }

      // Add a comment on ~30% of posts
      if (i % 3 === 0) {
        const commenterId = userIds[(post.userIndex + 5) % userIds.length];
        if (commenterId) {
          await ctx.runMutation(internal.seedInternal.insertPostComment, {
            postId,
            userId: commenterId,
            body: POST_COMMENTS[i % POST_COMMENTS.length]!,
          });
        }
      }
    }

    console.log(`[seed] community: ${listings} listings, ${posts} posts`);
  },
});
