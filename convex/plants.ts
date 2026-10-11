import { query } from './_generated/server'

export const plantLibrary = query({
  args: {},
  handler: async (ctx) => {
    // Static admin-curated catalog: indexed read (by_key) with a hard take.
    // In-memory name sort below is unchanged.
    const presets = await ctx.db.query('plantCatalog').withIndex('by_key').take(64)
    return presets
      .map((preset) => ({
        ...preset,
        imageUrl: preset.imageUrl ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})
