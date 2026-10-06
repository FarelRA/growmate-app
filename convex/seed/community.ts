"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import usersData from "../seedData/users";
import communityListingsData from "../seedData/communityListings";
import communityPostsData from "../seedData/communityPosts";
import { ensureBucket, uploadFile } from "../seedData/storage";
import type { Id } from "../_generated/dataModel";

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

// ─── Community Listings ───────────────────────────────────

export const community = internalAction({
  handler: async (ctx) => {
    const userIds: Id<"users">[] = [];
    for (const u of usersData) {
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: u.email });
      if (user) userIds.push(user._id);
    }

    if (userIds.length < 20) {
      console.log("[seed] Not enough users for community data");
      return;
    }

    const env = getEnv();
    const bucket = env.MINIO_BUCKET_IMAGE ?? "growmate-images";
    await ensureBucket(bucket);

    for (let i = 0; i < communityListingsData.length; i++) {
      const listing = communityListingsData[i]!;
      const sellerId = userIds[listing.sellerIndex];

      if (!sellerId) {
        continue;
      }

      const imageUrl = await uploadSeedImages(
        bucket,
        listing.image.hash,
        listing.image.sizes,
      );

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

    }

    // Community posts + comments + likes
    for (let i = 0; i < communityPostsData.length; i++) {
      const post = communityPostsData[i]!;
      const authorId = userIds[post.userIndex];

      if (!authorId) {
        continue;
      }

      const postImageUrl = post.image
        ? await uploadSeedImages(bucket, post.image.hash, post.image.sizes)
        : undefined;

      const postId = await ctx.runMutation(internal.seedInternal.insertCommunityPost, {
        userId: authorId,
        title: post.title,
        body: post.body,
        imageUrl: postImageUrl,
      });

      // Add a like from another random user
      const likerIdx = (post.userIndex + 3) % 20;
      const likerId = userIds[likerIdx];
      if (likerId) {
        await ctx.runMutation(internal.seedInternal.insertPostLike, {
          postId,
          userId: likerId,
        });
      }

      // Add a comment on ~30% of posts
      if (i % 3 === 0) {
        const commenterIdx = (post.userIndex + 5) % 20;
        const commenterId = userIds[commenterIdx];
        if (commenterId) {
          const comments = [
            "Wah, terima kasih infonya! Sangat membantu.",
            "Saya juga pernah mengalami hal serupa. Ternyata solusinya mudah ya.",
            "Mantap! Hasil panennya kelihatan segar sekali.",
            "Good info! Langsung saya coba tipsnya.",
            "Baru tahu kalau ada cara semudah ini. Makasih sharingnya!",
            "Keren banget! Semoga saya bisa seperti ini suatu hari.",
            "Aku juga pakai GrowMate dan puas banget hasilnya.",
            "Wah saya baru mau coba, jadi tambah semangat!",
          ];
          const comment = comments[i % comments.length]!;

          await ctx.runMutation(internal.seedInternal.insertPostComment, {
            postId,
            userId: commenterId,
            body: comment,
          });
        }
      }

      if (i % 20 === 0) {
      }
    }

    console.log(`[seed] All ${communityPostsData.length} community posts seeded`);
  },
});
