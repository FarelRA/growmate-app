import { ConvexError } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { enrichMarketplaceProduct } from '../helpers/marketplace'

// AUTH POLICY: `requireAdmin` gates live ONLY in the thin delegates in
// ../admin.ts. Cores here perform pure DB logic. The delegate passes the
// already-authorized admin's id where the core needs it as data (sellerId).

// Official-product core: cursor-paginated, enriched exactly like the legacy
// array query so the dashboard `data.officialProducts` array keeps its
// fields.
export async function fetchAdminProductsPaginated(
  ctx: QueryCtx,
  adminId: Id<'users'>,
  paginationOpts: { cursor: string | null; numItems: number },
) {
  const result = await ctx.db
    .query('products')
    .withIndex('by_type', (q) => q.eq('type', 'official'))
    .order('desc')
    .paginate(paginationOpts)

  const page = await Promise.all(
    result.page.map((product) => enrichMarketplaceProduct(ctx, product, adminId)),
  )
  return { ...result, page }
}

export interface SaveOfficialProductArgs {
  productId?: Id<'products'>
  title: string
  description: string
  price: number
  category: string
  quantityAvailable: number
  priceUnit: string
  imageUrl?: string
  featured: boolean
  status: 'active' | 'reserved' | 'sold' | 'archived'
  shopeeUrl?: string
}

export async function saveOfficialProduct(
  ctx: MutationCtx,
  adminId: Id<'users'>,
  args: SaveOfficialProductArgs,
) {
  const now = Date.now()
  let imageUrl = args.imageUrl

  if (args.productId) {
    const existing = await ctx.db.get(args.productId)
    if (!existing || existing.type !== 'official') {
      throw new ConvexError('Produk resmi tidak ditemukan')
    }

    imageUrl = imageUrl ?? existing.imageUrl
  }

  if (!imageUrl) {
    throw new ConvexError('Gambar produk wajib diisi')
  }

  const payload = {
    title: args.title.trim(),
    description: args.description.trim(),
    price: args.price,
    category: args.category.trim(),
    type: 'official' as const,
    sellerId: adminId,
    status: args.status,
    quantityAvailable: args.quantityAvailable,
    priceUnit: args.priceUnit.trim(),
    locationLabel: 'Shopee',
    imageUrl,
    featured: args.featured,
    updatedAt: now,
    ...(args.shopeeUrl?.trim() ? { shopeeUrl: args.shopeeUrl.trim() } : {}),
  }

  if (args.productId) {
    await ctx.db.patch(args.productId, payload)
    return { success: true, productId: args.productId }
  }

  const productId = await ctx.db.insert('products', {
    ...payload,
    createdAt: now,
  })

  return { success: true, productId }
}

export async function updateOfficialProductStatus(
  ctx: MutationCtx,
  args: { productId: Id<'products'>; status: 'active' | 'reserved' | 'sold' | 'archived' },
) {
  const product = await ctx.db.get(args.productId)
  if (!product || product.type !== 'official') {
    throw new ConvexError('Produk resmi tidak ditemukan')
  }

  await ctx.db.patch(args.productId, {
    status: args.status,
    updatedAt: Date.now(),
  })

  return { success: true }
}

export async function deleteOfficialProduct(
  ctx: MutationCtx,
  args: { productId: Id<'products'> },
) {
  const product = await ctx.db.get(args.productId)
  if (!product || product.type !== 'official') {
    throw new ConvexError('Produk resmi tidak ditemukan')
  }

  await ctx.db.delete(args.productId)
  return { success: true }
}
