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
