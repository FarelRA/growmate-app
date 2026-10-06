import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { normalizePlantSensorProfile } from '../helpers/sensors'
import { normalizeLifecycleProfile } from '../helpers/plants'

// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates in
// ../admin.ts. Cores here perform pure DB logic.

// Plant-catalog cores (moved verbatim from ../admin.ts).
export function normalizePlantPresetKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/-+/g, '_')
}

// Plant-catalog core: cursor-paginated, normalized exactly like the legacy
// array query so the dashboard `data.plantCatalog` array keeps its fields.
export async function fetchAdminPlantCatalogPaginated(
  ctx: QueryCtx,
  paginationOpts: { cursor: string | null; numItems: number },
) {
  const result = await ctx.db.query('plantCatalog').paginate(paginationOpts)
  return {
    ...result,
    page: result.page.map((preset) => ({
      ...preset,
      imageUrl: preset.imageUrl ?? null,
    })),
  }
}

export interface SavePlantPresetArgs {
  presetId?: Id<'plantCatalog'>
  key?: string
  name: string
  species: string
  growthStage:
    | 'seed_dormancy'
    | 'germination'
    | 'seedling_development'
    | 'vegetative_growth'
    | 'flowering_reproduction'
    | 'maturity_senescence'
  description: string
  location: string
  category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'
  difficulty: 'easy' | 'medium' | 'advanced'
  wateringThreshold: number
  lightingThreshold: number
  fertilizingThreshold?: number
  fertilizerCadenceDays?: number
  pesticideCadenceDays?: number
  nutrientNotes?: string
  sensorProfile: Parameters<typeof normalizePlantSensorProfile>[0]
  lifecycleProfile: Parameters<typeof normalizeLifecycleProfile>[0]
  imageUrl?: string
}

export async function savePlantPreset(ctx: MutationCtx, args: SavePlantPresetArgs) {
  const now = Date.now()
  const key = normalizePlantPresetKey(args.key || args.name)
  if (!key) {
    throw new ConvexError('Kunci preset tanaman wajib diisi')
  }

  const existing = args.presetId ? await ctx.db.get(args.presetId) : null
  if (args.presetId && (!existing || existing._id !== args.presetId)) {
    throw new ConvexError('Preset tanaman tidak ditemukan')
  }

  const duplicate = await ctx.db
    .query('plantCatalog')
    .withIndex('by_key', (q) => q.eq('key', key))
    .first()
  if (duplicate && String(duplicate._id) !== String(args.presetId)) {
    throw new ConvexError('Preset tanaman dengan kunci ini sudah ada')
  }

  const finalImageUrl = args.imageUrl ?? existing?.imageUrl
  if (!finalImageUrl) {
    throw new ConvexError('Gambar preset tanaman wajib diisi')
  }

  const payload = {
    key,
    name: args.name.trim(),
    species: args.species.trim(),
    growthStage: args.growthStage,
    imageUrl: finalImageUrl,
    description: args.description.trim(),
    location: args.location.trim(),
    category: args.category,
    difficulty: args.difficulty,
    wateringThreshold: args.wateringThreshold,
    lightingThreshold: args.lightingThreshold,
    sensorProfile: normalizePlantSensorProfile(args.sensorProfile),
    lifecycleProfile: normalizeLifecycleProfile(args.lifecycleProfile),
    updatedAt: now,
  }

  const optional: {
    fertilizingThreshold?: number
    fertilizerCadenceDays?: number
    pesticideCadenceDays?: number
    nutrientNotes?: string
  } = {}
  if (args.fertilizingThreshold !== undefined) optional.fertilizingThreshold = args.fertilizingThreshold
  if (args.fertilizerCadenceDays !== undefined) optional.fertilizerCadenceDays = args.fertilizerCadenceDays
  if (args.pesticideCadenceDays !== undefined) optional.pesticideCadenceDays = args.pesticideCadenceDays
  if (args.nutrientNotes !== undefined) optional.nutrientNotes = args.nutrientNotes.trim()

  if (existing) {
    await ctx.db.patch(existing._id, { ...payload, ...optional })
    return { success: true, presetId: existing._id }
  }

  const presetId = await ctx.db.insert('plantCatalog', {
    ...payload,
    ...optional,
    createdAt: now,
  })
  return { success: true, presetId }
}

export async function deletePlantPreset(
  ctx: MutationCtx,
  args: { presetId: Id<'plantCatalog'> },
) {
  const preset = await ctx.db.get(args.presetId)
  if (!preset) {
    throw new ConvexError('Preset tanaman tidak ditemukan')
  }

  await ctx.db.delete(args.presetId)
  return { success: true }
}
