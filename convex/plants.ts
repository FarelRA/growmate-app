import { query } from './_generated/server'
import { resolveStoredImageUrl } from './helpers'

export const plantLibrary = query({
  args: {},
  handler: async (ctx) => {
    const presets = await ctx.db.query('plantCatalog').take(64)
    const presetsWithImages = await Promise.all(
      presets.map(async (preset) => ({
        ...preset,
        image:
          (await resolveStoredImageUrl(ctx, preset.imageStorageId, preset.image)) ?? preset.image,
      })),
    )
    return presetsWithImages.sort((a, b) => a.name.localeCompare(b.name))
  },
})
