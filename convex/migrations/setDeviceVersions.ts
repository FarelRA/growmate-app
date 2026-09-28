// ONE-SHOT MIGRATION — do not wire into app code.
//
// Purpose: backfill `version: 'v1'` on device docs created before the
// version field existed. Safe to re-run (only patches docs without version).
//
// How to run (one time, from repo root):
//   bunx convex run migrations/setDeviceVersions:run
// or via the Convex dashboard → Functions → migrations/setDeviceVersions:run.
//
// Leave this file in place for audit history; do not import it from queries,
// mutations, or UI code.
import { internalMutation } from '../_generated/server'

export const run = internalMutation(async (ctx) => {
  const devices = await ctx.db.query('devices').collect()
  let updated = 0

  for (const device of devices) {
    if (!device.version) {
      await ctx.db.patch(device._id, { version: 'v1' })
      updated++
    }
  }

  console.log(`Migration complete: ${updated} devices set to version 'v1'`)
})
