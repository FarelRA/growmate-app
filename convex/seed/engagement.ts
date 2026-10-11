"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getActivityPoints } from "../helpers/generic";
import usersData, { demoUser } from "../seedData/users";
import communityPostsData from "../seedData/communityPosts";
import draftsData from "../seedData/drafts";
import type { Id } from "../_generated/dataModel";

const day = 86400000;

// ─── Engagement: notifications, drafts, community activities ───

export const engagement = internalAction({
  handler: async (ctx) => {
    const allUsers = [...usersData, demoUser];
    const ids: Id<"users">[] = [];
    for (const u of allUsers) {
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: u.email });
      if (user) ids.push(user._id);
    }
    if (ids.length === 0) return;

    // 1. Notifications: one system + one social per user, alternating read.
    let notifications = 0;
    for (let i = 0; i < ids.length; i++) {
      const userId = ids[i]!;
      const pair: Array<{ title: string; detail: string; kind: "system" | "social"; dayAgo: number }> = [
        {
          title: "Perangkat tersambung kembali",
          detail: "Perangkat Anda kembali online dan melanjutkan penyiraman otomatis.",
          kind: "system",
          dayAgo: 2 + (i % 5),
        },
        {
          title: "Postingan Anda mendapat suka baru",
          detail: "Anggota komunitas menyukai postingan Anda. Terus berbagi ya!",
          kind: "social",
          dayAgo: 1 + (i % 4),
        },
      ];
      for (let k = 0; k < pair.length; k++) {
        const n = pair[k]!;
        if (await ctx.runQuery(internal.seedInternal.hasNotification, { userId, title: n.title })) {
          continue;
        }
        const read = (i + k) % 2 === 0;
        const createdAt = Date.now() - n.dayAgo * day;
        await ctx.runMutation(internal.seedInternal.seedNotification, {
          userId,
          title: n.title,
          detail: n.detail,
          kind: n.kind,
          read,
          readAt: read ? createdAt + 3600000 : undefined,
          createdAt,
        });
        notifications += 1;
      }
    }

    // 2. Listing drafts.
    let drafts = 0;
    for (const d of draftsData) {
      const entry = usersData[d.userIndex % usersData.length]!;
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: entry.email });
      if (!user) continue;
      if (await ctx.runQuery(internal.seedInternal.hasDraft, { userId: user._id, title: d.title })) {
        continue;
      }
      const createdAt = Date.now() - d.dayAgo * day;
      await ctx.runMutation(internal.seedInternal.seedDraft, {
        userId: user._id,
        title: d.title,
        description: d.description,
        category: d.category,
        quantity: d.quantity,
        quantityUnit: d.quantityUnit,
        price: d.price,
        priceUnit: d.priceUnit,
        locationLabel: d.locationLabel,
        contactPreference: d.contactPreference,
        status: d.status,
        createdAt,
      });
      drafts += 1;
    }

    // 3. Community activities with canonical points (leaderboard depth).
    const resolve = async (index: number) => {
      const entry = usersData[index % usersData.length]!;
      return ctx.runQuery(internal.users.adminLookupByEmail, { email: entry.email });
    };
    let activities = 0;
    for (let i = 0; i < communityPostsData.length; i++) {
      const post = communityPostsData[i]!;
      const author = await resolve(post.userIndex);
      if (author) {
        const relatedId = `seed-post-${i}`;
        if (!(await ctx.runQuery(internal.seedInternal.hasActivity, {
          userId: author._id, activityType: "post_created", relatedId,
        }))) {
          await ctx.runMutation(internal.seedInternal.insertUserActivity, {
            userId: author._id,
            activityType: "post_created",
            points: getActivityPoints("post_created"),
            relatedId,
          });
          activities += 1;
        }
      }
      for (let j = 0; j < post.comments.length; j++) {
        const commenter = await resolve(post.comments[j]!.userIndex);
        if (!commenter) continue;
        const relatedId = `seed-comment-${i}-${j}`;
        if (await ctx.runQuery(internal.seedInternal.hasActivity, {
          userId: commenter._id, activityType: "comment_created", relatedId,
        })) {
          continue;
        }
        await ctx.runMutation(internal.seedInternal.insertUserActivity, {
          userId: commenter._id,
          activityType: "comment_created",
          points: getActivityPoints("comment_created"),
          relatedId,
        });
        activities += 1;
      }
      for (let k = 0; k < post.likes.length; k++) {
        const liker = await resolve(post.likes[k]!);
        if (!liker) continue;
        const relatedId = `seed-like-${i}-${k}`;
        if (await ctx.runQuery(internal.seedInternal.hasActivity, {
          userId: liker._id, activityType: "post_liked", relatedId,
        })) {
          continue;
        }
        await ctx.runMutation(internal.seedInternal.insertUserActivity, {
          userId: liker._id,
          activityType: "post_liked",
          points: getActivityPoints("post_liked"),
          relatedId,
        });
        activities += 1;
      }
    }

    console.log(`[seed] engagement: ${notifications} notifications, ${drafts} drafts, ${activities} activities`);
  },
});
