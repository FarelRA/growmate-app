"use node";

import { internalAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

export const ensureAdmin = internalAction({
  handler: async (ctx) => {
    const env = (
      globalThis as { process?: { env?: Record<string, string | undefined> } }
    ).process?.env ?? {};
    const email = env.ADMIN_EMAIL;
    const password = env.ADMIN_PASSWORD;

    if (!email || !password) return;

    const existing = await ctx.runQuery(api.users.adminLookupByEmail, { email });
    if (existing && existing.role === "admin") return;

    try {
      await ctx.runAction(api.auth.signIn, {
        provider: "password",
        params: { email, password, flow: "signUp" },
      });
    } catch (error) {
      if (
        !(error instanceof Error && error.message.toLowerCase().includes("already exists"))
      ) {
        throw error;
      }
    }

    const user = await ctx.runQuery(api.users.adminLookupByEmail, { email });
    if (user && user.role !== "admin") {
      await ctx.runMutation(internal.users.internalSetAdminRole, {
        userId: user._id,
      });
    }
  },
});
