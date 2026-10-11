"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import usersData from "../seedData/users";
import ticketsData from "../seedData/tickets";

const day = 86400000;

// ─── Support Tickets + Messages ─────────────────────────

export const support = internalAction({
  handler: async (ctx) => {
    const env = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env ?? {};
    const adminEmail = env.ADMIN_EMAIL;
    const admin = adminEmail
      ? await ctx.runQuery(internal.users.adminLookupByEmail, { email: adminEmail })
      : null;

    let created = 0;
    let skipped = 0;
    for (const t of ticketsData) {
      const entry = usersData[t.userIndex % usersData.length]!;
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: entry.email });
      if (!user) continue;
      if (await ctx.runQuery(internal.seedInternal.hasTicket, { userId: user._id, topic: t.topic })) {
        skipped += 1;
        continue;
      }

      const now = Date.now();
      const needsAdmin = t.status !== "open" && t.messages.some((m) => m.from === "admin");
      await ctx.runMutation(internal.seedInternal.seedTicket, {
        userId: user._id,
        topic: t.topic,
        status: t.status,
        priority: t.priority,
        handledBy: needsAdmin && admin ? admin._id : undefined,
        createdAt: now - t.dayAgo * day,
        messages: t.messages.map((m, i) => ({
          senderRole: m.from,
          senderUserId: m.from === "admin" ? admin?._id : user._id,
          body: m.body,
          createdAt: now - m.dayAgo * day + i * 3600000,
        })),
      });
      created += 1;
    }

    console.log(`[seed] support: ${created} created, ${skipped} already present`);
  },
});
