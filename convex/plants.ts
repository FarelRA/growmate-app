import { v } from 'convex/values'
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

// Hand-picked presets by catalog key (homepage hero/cards). take(64) above
// windows by key order, so curated keys outside the window need direct gets.
export const plantPresetsByKeys = query({
  args: { keys: v.array(v.string()) },
  handler: async (ctx, args) => {
    if (args.keys.length > 12) {
      throw new Error('Maksimal 12 kunci tanaman per permintaan')
    }
    const out = []
    for (const key of args.keys) {
      const preset = await ctx.db
        .query('plantCatalog')
        .withIndex('by_key', (q) => q.eq('key', key))
        .first()
      if (!preset) continue
      out.push({ ...preset, imageUrl: preset.imageUrl ?? null })
    }
    return out
  },
})
