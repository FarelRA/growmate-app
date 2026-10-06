import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, UserDoc } from '../types'

// Draft/listing DB cores extracted from ../marketplace.ts (pre-alpha split,
// zero API change: api.marketplace.* exports stay identical thin delegates).
//
// Gate ownership: auth (requireUser), input validation, ownership checks, and
// the per-user draft cap stay VISIBLE in the ../marketplace.ts delegates.
// Cores below perform pure DB reads/writes only and assume authorized,
// validated input plus delegate-verified docs.

export type ListingDraftDoc = Doc<'listingDrafts'>
export type ListingProductDoc = Doc<'products'>

export type SaveDraftFields = {
  title: string
  description: string
  category: string
  quantity: number
  quantityUnit: string
  price: number
  priceUnit: string
  locationLabel: string
  contactPreference: 'chat' | 'pickup' | 'delivery'
}

export async function saveDraftCore(
  ctx: MutationCtx,
  user: UserDoc,
  fields: SaveDraftFields,
  imageUrl: string,
  now: number,
  draftId?: Id<'listingDrafts'>,
) {
  const payload = {
    userId: user._id,
    title: fields.title.trim(),
    description: fields.description.trim(),
    category: fields.category.trim(),
    quantity: fields.quantity,
    quantityUnit: fields.quantityUnit.trim(),
    price: fields.price,
    priceUnit: fields.priceUnit.trim(),
    imageUrl,
    locationLabel: fields.locationLabel.trim(),
    contactPreference: fields.contactPreference,
    updatedAt: now,
  }

  if (draftId) {
    await ctx.db.patch(draftId, payload)
    return { success: true, draftId }
  }

  // Precondition (enforced by delegate): user is under LISTING_DRAFTS_PER_USER_CAP.
  const newDraftId = await ctx.db.insert('listingDrafts', {
    ...payload,
    status: 'draft',
    createdAt: now,
  })
  return { success: true, draftId: newDraftId }
}

export async function publishDraftCore(
  ctx: MutationCtx,
  user: UserDoc,
  draft: ListingDraftDoc,
  now: number,
) {
  // Preconditions (delegate-verified): draft belongs to user, quantity > 0.
  const productId = await ctx.db.insert('products', {
    title: draft.title,
    description: draft.description,
    price: draft.price,
    category: draft.category,
    type: 'community',
    sellerId: user._id,
    status: 'active',
    quantityAvailable: draft.quantity,
    quantityUnit: draft.quantityUnit,
    priceUnit: draft.priceUnit,
    locationLabel: draft.locationLabel,
    contactPreference: draft.contactPreference,
    imageUrl: draft.imageUrl,
    featured: false,
    shopeeUrl: undefined,
    createdAt: now,
    updatedAt: now,
  })

  await ctx.db.patch(draft._id, { status: 'published', updatedAt: now })

  await ctx.db.insert('notifications', {
    userId: user._id,
    title: 'Penawaran dipublikasikan',
    detail: `${draft.title} kini tampil di marketplace GrowMate.`,
    kind: 'commerce',
    read: false,
    createdAt: now,
  })

  return { success: true, productId }
}

export async function setListingStatusCore(
  ctx: MutationCtx,
  productId: Id<'products'>,
  status: 'active' | 'reserved' | 'sold' | 'archived',
  now: number,
) {
  // Precondition (delegate-verified): product is a community listing owned by the caller.
  await ctx.db.patch(productId, {
    status,
    updatedAt: now,
  })
  return { success: true }
}

export async function updateListingCore(
  ctx: MutationCtx,
  productId: Id<'products'>,
  fields: SaveDraftFields,
  imageUrl: string | undefined,
  now: number,
) {
  // Precondition (delegate-verified): product is a community listing owned by
  // the caller; fields validated; imageUrl falls back to the stored image.
  await ctx.db.patch(productId, {
    title: fields.title.trim(),
    description: fields.description.trim(),
    category: fields.category.trim(),
    quantityAvailable: fields.quantity,
    quantityUnit: fields.quantityUnit.trim(),
    price: fields.price,
    priceUnit: fields.priceUnit.trim(),
    imageUrl,
    locationLabel: fields.locationLabel.trim(),
    contactPreference: fields.contactPreference,
    updatedAt: now,
  })

  return { success: true }
}

export async function deleteDraftCore(ctx: MutationCtx, draftId: Id<'listingDrafts'>) {
  // Precondition (delegate-verified): draft belongs to the caller.
  await ctx.db.delete(draftId)
  return { success: true }
}

export async function deleteListingCore(ctx: MutationCtx, productId: Id<'products'>) {
  // Precondition (delegate-verified): product is a community listing owned by
  // the caller. Paginated deletes until exhausted — no silent orphans.
  while (true) {
    const threads = await ctx.db
      .query('marketplaceThreads')
      .withIndex('by_product', (q) => q.eq('productId', productId))
      .take(50)
    if (threads.length === 0) break
    for (const thread of threads) {
      while (true) {
        const messages = await ctx.db
          .query('marketplaceMessages')
          .withIndex('by_thread_and_createdAt', (q) => q.eq('threadId', thread._id))
          .take(100)
        if (messages.length === 0) break
        for (const message of messages) {
          await ctx.db.delete(message._id)
        }
        if (messages.length < 100) break
      }
      await ctx.db.delete(thread._id)
    }
    if (threads.length < 50) break
  }

  await ctx.db.delete(productId)
  return { success: true }
}
