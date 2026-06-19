import { query } from './_generated/server'

export const plantLibrary = query({
  args: {},
  handler: async (ctx) => {
    const presets = await ctx.db.query('plantCatalog').take(64)
    return presets
      .map((preset) => ({
        ...preset,
        imageUrl: preset.imageUrl ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  },
})
