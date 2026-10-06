/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import {
  saveMarketplaceDraft,
  publishMarketplaceDraft,
  updateMarketplaceListing,
  updateMarketplaceListingStatus,
  deleteMarketplaceDraft,
  deleteMarketplaceListing,
} from '../../convex/marketplace'
import { createPost, deletePost } from '../../convex/community'
import * as communityModule from '../../convex/community'
import { adminDeleteOfficialProduct } from '../../convex/admin'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

const draftArgs = {
  title: 'Bibit Cabai',
  description: 'Bibit cabai rawit segar',
  category: 'benih',
  quantity: 10,
  quantityUnit: 'pack',
  price: 15000,
  priceUnit: 'pack',
  imageUrl: 'https://img.example/seed.jpg',
  locationLabel: 'Bandung',
  contactPreference: 'chat',
} as const

async function seedUser(
  ctx: FakeCtx,
  name: string,
  role: 'grower' | 'company' | 'admin' = 'grower',
): Promise<string> {
  return await ctx.db.insert('users', { name, role })
}

async function seedCommunityProduct(ctx: FakeCtx, sellerId: string): Promise<string> {
  return await ctx.db.insert('products', {
    title: 'Panen tomat',
    description: 'Segar',
    price: 20000,
    category: 'panen',
    type: 'community',
    sellerId,
    status: 'active',
    quantityAvailable: 5,
    quantityUnit: 'kg',
    priceUnit: 'kg',
    locationLabel: 'Bandung',
    contactPreference: 'chat',
    imageUrl: 'https://img.example/tomat.jpg',
    featured: false,
    createdAt: now,
    updatedAt: now,
  })
}

describe('marketplace drafts: seller CRUD, foreign denial', () => {
  let ctx: FakeCtx
  let seller: string
  let other: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    seller = await seedUser(ctx, 'Seller')
    other = await seedUser(ctx, 'Other')
  })

  it('seller creates, patches, and deletes their own draft', async () => {
    ctx.__testUserId = seller
    const created = await callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })
    expect(created.success).toBe(true)

    const patched = await callHandler(saveMarketplaceDraft, ctx, {
      ...draftArgs,
      draftId: created.draftId,
      title: 'Bibit Cabai Rawit',
    })
    expect(patched.success).toBe(true)
    expect(String(patched.draftId)).toBe(String(created.draftId))
    expect((await ctx.db.get(created.draftId))!.title).toBe('Bibit Cabai Rawit')

    const deleted = await callHandler(deleteMarketplaceDraft, ctx, {
      draftId: created.draftId,
    })
    expect(deleted.success).toBe(true)
    expect(await ctx.db.get(created.draftId)).toBeNull()
  })

  it('rejects patching/deleting a foreign draft, writes nothing', async () => {
    ctx.__testUserId = seller
    const created = await callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })

    ctx.__testUserId = other
    await expect(
      callHandler(saveMarketplaceDraft, ctx, {
        ...draftArgs,
        draftId: created.draftId,
        title: 'Bajak',
      }),
    ).rejects.toThrow('Draft tidak ditemukan')
    await expect(
      callHandler(deleteMarketplaceDraft, ctx, { draftId: created.draftId }),
    ).rejects.toThrow('Draft tidak ditemukan')
    expect((await ctx.db.get(created.draftId))!.title).toBe(draftArgs.title)
  })

  it('rejects unauthenticated draft writes', async () => {
    ctx.__testUserId = seller
    const created = await callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })

    ctx.__testUserId = null
    await expect(callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })).rejects.toThrow(
      'Autentikasi diperlukan',
    )
    await expect(
      callHandler(deleteMarketplaceDraft, ctx, { draftId: created.draftId }),
    ).rejects.toThrow('Autentikasi diperlukan')
    expect(await ctx.db.get(created.draftId)).not.toBeNull()
  })
})

describe('marketplace publish: permission matrix', () => {
  let ctx: FakeCtx
  let seller: string
  let otherSeller: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    seller = await seedUser(ctx, 'Seller')
    otherSeller = await seedUser(ctx, 'OtherSeller')
  })

  it('non-owner publish rejected; owner publish succeeds once', async () => {
    ctx.__testUserId = seller
    const created = await callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })

    ctx.__testUserId = otherSeller
    await expect(
      callHandler(publishMarketplaceDraft, ctx, { draftId: created.draftId }),
    ).rejects.toThrow('Draft tidak ditemukan')
    expect((await ctx.db.get(created.draftId))!.status).toBe('draft')
    expect(ctx.db.all('products')).toHaveLength(0)

    ctx.__testUserId = seller
    const pub = await callHandler(publishMarketplaceDraft, ctx, { draftId: created.draftId })
    expect(pub.success).toBe(true)
    const product = await ctx.db.get(pub.productId)
    expect(product!.type).toBe('community')
    expect(product!.status).toBe('active')
    expect(String(product!.sellerId)).toBe(String(seller))
  })

  it('rejects unauthenticated and nonexistent-draft publish', async () => {
    ctx.__testUserId = seller
    const created = await callHandler(saveMarketplaceDraft, ctx, { ...draftArgs })

    ctx.__testUserId = null
    await expect(
      callHandler(publishMarketplaceDraft, ctx, { draftId: created.draftId }),
    ).rejects.toThrow('Autentikasi diperlukan')

    ctx.__testUserId = seller
    await expect(
      callHandler(publishMarketplaceDraft, ctx, { draftId: 'listingDrafts|999999' }),
    ).rejects.toThrow('Draft tidak ditemukan')
    expect(ctx.db.all('products')).toHaveLength(0)
  })
})

describe('marketplace listings: update/delete matrix', () => {
  let ctx: FakeCtx
  let seller: string
  let buyer: string
  let productId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    seller = await seedUser(ctx, 'Seller')
    buyer = await seedUser(ctx, 'Buyer')
    productId = await seedCommunityProduct(ctx, seller)
  })

  it('seller can update their own listing', async () => {
    ctx.__testUserId = seller
    const res = await callHandler(updateMarketplaceListing, ctx, {
      productId,
      ...draftArgs,
      title: 'Panen tomat premium',
      quantity: 7,
    })
    expect(res.success).toBe(true)
    const product = (await ctx.db.get(productId))!
    expect(product.title).toBe('Panen tomat premium')
    expect(product.quantityAvailable).toBe(7)
  })

  it('seller update validation still applies (title/quantity/price)', async () => {
    ctx.__testUserId = seller
    await expect(
      callHandler(updateMarketplaceListing, ctx, {
        productId,
        ...draftArgs,
        title: '   ',
      }),
    ).rejects.toThrow('Judul, deskripsi, dan kategori wajib diisi')
    await expect(
      callHandler(updateMarketplaceListing, ctx, { productId, ...draftArgs, quantity: 0 }),
    ).rejects.toThrow('Jumlah harus lebih besar dari nol')
    await expect(
      callHandler(updateMarketplaceListing, ctx, { productId, ...draftArgs, price: -1 }),
    ).rejects.toThrow('Harga tidak boleh bernilai negatif')
    expect((await ctx.db.get(productId))!.title).toBe('Panen tomat')
  })

  it('buyer cannot update/status/delete a seller listing; listing intact', async () => {
    ctx.__testUserId = buyer
    await expect(
      callHandler(updateMarketplaceListing, ctx, { productId, ...draftArgs }),
    ).rejects.toThrow('Penawaran tidak ditemukan')
    await expect(
      callHandler(updateMarketplaceListingStatus, ctx, { productId, status: 'sold' }),
    ).rejects.toThrow('Penawaran tidak ditemukan')
    await expect(callHandler(deleteMarketplaceListing, ctx, { productId })).rejects.toThrow(
      'Penawaran tidak ditemukan',
    )
    expect(await ctx.db.get(productId)).not.toBeNull()
  })

  it('rejects unauthenticated update/status/delete', async () => {
    ctx.__testUserId = null
    await expect(
      callHandler(updateMarketplaceListing, ctx, { productId, ...draftArgs }),
    ).rejects.toThrow('Autentikasi diperlukan')
    await expect(
      callHandler(updateMarketplaceListingStatus, ctx, { productId, status: 'sold' }),
    ).rejects.toThrow('Autentikasi diperlukan')
    await expect(callHandler(deleteMarketplaceListing, ctx, { productId })).rejects.toThrow(
      'Autentikasi diperlukan',
    )
    expect(await ctx.db.get(productId)).not.toBeNull()
  })

  it('official-type products are rejected via community listing paths (type guard)', async () => {
    const officialId = await ctx.db.insert('products', {
      title: 'Resmi',
      description: 'Official store',
      price: 50000,
      category: 'alat',
      type: 'official',
      sellerId: seller,
      status: 'active',
      quantityAvailable: 3,
      priceUnit: 'pcs',
      featured: false,
      createdAt: now,
      updatedAt: now,
    })

    ctx.__testUserId = seller
    await expect(
      callHandler(updateMarketplaceListing, ctx, { productId: officialId, ...draftArgs }),
    ).rejects.toThrow('Penawaran tidak ditemukan')
    await expect(
      callHandler(updateMarketplaceListingStatus, ctx, { productId: officialId, status: 'sold' }),
    ).rejects.toThrow('Penawaran tidak ditemukan')
    await expect(callHandler(deleteMarketplaceListing, ctx, { productId: officialId })).rejects.toThrow(
      'Penawaran tidak ditemukan',
    )
    expect(await ctx.db.get(officialId)).not.toBeNull()
  })

  it('admin has no override on community listings (treated as non-seller)', async () => {
    const admin = await seedUser(ctx, 'Admin', 'admin')
    ctx.__testUserId = admin
    await expect(
      callHandler(updateMarketplaceListingStatus, ctx, { productId, status: 'archived' }),
    ).rejects.toThrow('Penawaran tidak ditemukan')
    await expect(
      callHandler(updateMarketplaceListing, ctx, { productId, ...draftArgs }),
    ).rejects.toThrow('Penawaran tidak ditemukan')
    await expect(callHandler(deleteMarketplaceListing, ctx, { productId })).rejects.toThrow(
      'Penawaran tidak ditemukan',
    )
    await expect(
      callHandler(adminDeleteOfficialProduct, ctx, { productId }),
    ).rejects.toThrow('Produk resmi tidak ditemukan')
    expect(await ctx.db.get(productId)).not.toBeNull()
  })
})

describe('community posts: edit-ownership', () => {
  let ctx: FakeCtx
  let owner: string
  let postId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    owner = await seedUser(ctx, 'Owner')
    ctx.__testUserId = owner
    await callHandler(createPost, ctx, { title: 'Panen raya', body: 'Hasil kebun hari ini' })
    postId = ctx.db.all('communityPosts')[0]!._id as string
  })

  it('no post-edit path is exposed (ownership question is moot)', async () => {
    expect((communityModule as any).updatePost).toBeUndefined()
    expect((communityModule as any).editPost).toBeUndefined()
    expect((communityModule as any).updateCommunityPost).toBeUndefined()
  })

  it('admin cannot delete another user post (no admin override on deletePost)', async () => {
    const admin = await seedUser(ctx, 'Admin', 'admin')
    ctx.__testUserId = admin
    await expect(callHandler(deletePost, ctx, { postId })).rejects.toThrow(
      'Postingan tidak ditemukan',
    )
    expect(await ctx.db.get(postId)).not.toBeNull()
  })
})
