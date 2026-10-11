"use node";

/**
 * Seed entry point (CLI surface).
 *
 * This file is the ONLY seed module invoked from package.json scripts —
 * exactly one script per dataset, in `comprehensive` run order:
 *   - `convex run seed:admin`         -> {@link admin}
 *   - `convex run seed:plants`        -> {@link plants}
 *   - `convex run seed:users`         -> {@link users}
 *   - `convex run seed:devices`       -> {@link devices}
 *   - `convex run seed:processClaims` -> {@link processClaims} (script: convex:seed:claims)
 *   - `convex run seed:products`      -> {@link products}
 *   - `convex run seed:community`     -> {@link community}
 *   - `convex run seed:blog`          -> {@link blog}
 *   - `convex run seed:sensors`       -> {@link sensors}
 *   - `convex run seed:threads`       -> {@link threads}
 *   - `convex run seed:support`       -> {@link support}
 *   - `convex run seed:engagement`    -> {@link engagement}
 * A full seed is ONLY `convex run seed:comprehensive` (script:
 * `convex:seed:all`); there is no npm-chained multi-invoke path.
 *
 * All exports are `internalAction`: unreachable from clients over HTTP,
 * but runnable from the CLI (`convex run` supports public AND internal
 * functions) and the dashboard. Do NOT widen these to public `action` —
 * seed writes must never be client-triggerable.
 *
 * Dataset handlers live in `./seed/` (each a `"use node"` module for
 * Buffer/RustFS uploads) and are re-exported here so `convex run
 * seed:<name>` resolution keeps working. DB-level helpers (internal
 * queries/mutations/actions) live in `./seedInternal` and are called via
 * `internal.seedInternal.*`. The split is intentional: entry + dataset
 * modules run on Node.js while `seedInternal.ts` must stay a plain Convex
 * module because `internalQuery`/`internalMutation` cannot be defined in a
 * `"use node"` file. Do not fold one into the other.
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import blogData from "./seedData/blog";
import userPlantsData from "./seedData/userPlants";
import communityListingsData from "./seedData/communityListings";
import communityPostsData from "./seedData/communityPosts";

export { admin, users, devices, processClaims } from "./seed/admin";
export { plants } from "./seed/plants";
export { products } from "./seed/products";
export { community } from "./seed/community";
export { blog } from "./seed/blog";
export { sensors } from "./seed/sensors";
export { threads } from "./seed/threads";
export { support } from "./seed/support";
export { engagement } from "./seed/engagement";

// ─── Comprehensive: Run Everything ────────────────────────

export const comprehensive = internalAction({
  handler: async (ctx): Promise<Record<string, unknown>> => {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║     GROWMATE COMPREHENSIVE SEED START    ║");
    console.log("╚══════════════════════════════════════════╝");

    // 1. Admin
    console.log("\n─── 1/12: Admin ───");
    const adminId = await ctx.runAction(internal.seed.admin);

    // 2. Plant Catalog
    console.log("\n─── 2/12: Plant Catalog ───");
    await ctx.runAction(internal.seed.plants);

    // 3. Users (36 + demo)
    console.log("\n─── 3/12: Users (36 + demo) ───");
    const userIds = await ctx.runAction(internal.seed.users);
    console.log(`  ${userIds.length} users created/found`);

    // 4. Devices (41: 18 Pods + 9 Tech + 14 Tech-Addon)
    console.log("\n─── 4/12: Devices (41) ───");
    const deviceIds = await ctx.runAction(internal.seed.devices);
    console.log(`  ${deviceIds.length} devices created/found`);

    // 5. Claims + Plants (36 users + demo showcase)
    console.log("\n─── 5/12: Claims + Plants ───");
    await ctx.runAction(internal.seed.processClaims);

    // 6. Official Products (4)
    console.log("\n─── 6/12: Official Products (4) ───");
    await ctx.runAction(internal.seed.products);

    // 7. Community (14 listings + 84 posts)
    console.log("\n─── 7/12: Community Listings + Posts ───");
    await ctx.runAction(internal.seed.community);

    // 8. Blog Articles (24)
    console.log("\n─── 8/12: Blog Articles (24) ───");
    await ctx.runAction(internal.seed.blog);

    // 9. Sensor History (30 days × 41 devices)
    console.log("\n─── 9/12: Sensor History ───");
    await ctx.runAction(internal.seed.sensors);

    // 10. Marketplace Threads
    console.log("\n─── 10/12: Marketplace Threads ───");
    await ctx.runAction(internal.seed.threads);

    // 11. Support Tickets
    console.log("\n─── 11/12: Support Tickets ───");
    await ctx.runAction(internal.seed.support);

    // 12. Engagement (notifications, drafts, activities)
    console.log("\n─── 12/12: Engagement ───");
    await ctx.runAction(internal.seed.engagement);

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║     GROWMATE COMPREHENSIVE SEED DONE     ║");
    console.log("╚══════════════════════════════════════════╝");

    return {
      adminId,
      userCount: userIds.length,
      deviceCount: deviceIds.length,
      plantCount: userPlantsData.length,
      listingCount: communityListingsData.length,
      postCount: communityPostsData.length,
      blogCount: blogData.length,
    };
  },
});
