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
    const bucket = env.RUSTFS_BUCKET_IMAGE ?? "growmate-images";

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

    // Community posts + comments + likes (all explicit in dataset)
    let posts = 0;
    for (const post of communityPostsData) {
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

      for (const likerIndex of post.likes) {
        const likerId = userIds[likerIndex % userIds.length];
        if (!likerId || likerId === authorId) continue;
        await ctx.runMutation(internal.seedInternal.insertPostLike, {
          postId,
          userId: likerId,
        });
      }

      for (const comment of post.comments.slice(0, 6)) {
        const commenterId = userIds[comment.userIndex % userIds.length];
        if (!commenterId) continue;
        await ctx.runMutation(internal.seedInternal.insertPostComment, {
          postId,
          userId: commenterId,
          body: comment.body,
        });
      }
    }

    console.log(`[seed] community: ${listings} listings, ${posts} posts`);
  },
});
