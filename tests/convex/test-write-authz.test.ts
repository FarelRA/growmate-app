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
  adminDevicesList,
  adminUsersList,
  adminSupportTickets,
  adminUsersPaginated,
  adminDeleteDevice,
  adminUpdateUserAccess,
  adminDeleteOfficialProduct,
} from '../../convex/admin'
import {
  triggerWatering,
  triggerLighting,
  saveCareSchedule,
  toggleCareSchedule,
  deleteCareSchedule,
} from '../../convex/care'
import { createSupportRequest, sendSupportMessage, closeSupportRequest } from '../../convex/support'
import { claimDevice, completeProfile, updateCurrentUserProfile } from '../../convex/users'
import { markNotificationRead } from '../../convex/notifications'
import {
  publishMarketplaceDraft,
  updateMarketplaceListingStatus,
  deleteMarketplaceListing,
  sendMarketplaceMessage,
} from '../../convex/marketplace'
import { createPost, deletePost } from '../../convex/community'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

async function seedUser(
  ctx: FakeCtx,
  name: string,
  role: 'grower' | 'company' | 'admin' = 'grower',
  extra: Record<string, any> = {},
): Promise<string> {
  return await ctx.db.insert('users', { name, role, ...extra })
}

async function seedDeviceWithPlant(
  ctx: FakeCtx,
  ownerId: string,
  externalId: string,
): Promise<{ deviceDocId: string; plantId: string }> {
  const deviceDocId = await ctx.db.insert('devices', {
    deviceId: externalId,
    name: `Pod ${externalId}`,
    userId: ownerId,
    createdAt: now,
    updatedAt: now,
  })
  const plantId = await ctx.db.insert('plants', {
    deviceId: deviceDocId,
    name: 'Cabai',
    archived: false,
    plantedAt: now,
    createdAt: now,
    updatedAt: now,
  })
  await ctx.db.patch(deviceDocId, { plantId })
  return { deviceDocId, plantId }
}

describe('admin paths: non-admin rejected', () => {
  let ctx: FakeCtx
  let adminId: string
  let userId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    adminId = await seedUser(ctx, 'Admin', 'admin')
    userId = await seedUser(ctx, 'Grower')
  })

  it('rejects non-admin callers on admin queries', async () => {
    ctx.__testUserId = userId
    await expect(callHandler(adminDevicesList, ctx, {})).rejects.toThrow(
      'Akses admin diperlukan',
    )
    await expect(callHandler(adminUsersList, ctx, {})).rejects.toThrow(
      'Akses admin diperlukan',
    )
    await expect(callHandler(adminSupportTickets, ctx, {})).rejects.toThrow(
      'Akses admin diperlukan',
    )
  })

  it('rejects unauthenticated callers on admin queries', async () => {
    ctx.__testUserId = null
    await expect(callHandler(adminDevicesList, ctx, {})).rejects.toThrow(
      'Autentikasi diperlukan',
    )
  })

  it('rejects non-admin callers on admin mutations', async () => {
    const deviceDocId = await ctx.db.insert('devices', {
      deviceId: 'GM-ADMIN-1',
      name: 'Pod GM-ADMIN-1',
      createdAt: now,
      updatedAt: now,
    })
    const productId = await ctx.db.insert('products', {
      title: 'Official',
      type: 'official',
      status: 'active',
      sellerId: adminId,
      createdAt: now,
      updatedAt: now,
    })
    ctx.__testUserId = userId
    await expect(callHandler(adminDeleteDevice, ctx, { deviceId: deviceDocId })).rejects.toThrow(
      'Akses admin diperlukan',
    )
    await expect(
      callHandler(adminUpdateUserAccess, ctx, { userId: adminId }),
    ).rejects.toThrow('Akses admin diperlukan')
    await expect(
      callHandler(adminDeleteOfficialProduct, ctx, { productId }),
    ).rejects.toThrow('Akses admin diperlukan')
  })

  it('allows admin callers through (auth passes)', async () => {
    // adminUsersPaginated touches only requireAdmin + a plain paginate read,
    // both supported by the shared fake (bare withIndex reads like
    // fetchAdminDevices are not).
    ctx.__testUserId = adminId
    const res = await callHandler(adminUsersPaginated, ctx, {
      paginationOpts: { numItems: 20, cursor: null },
    })
    expect(res.page.length).toBeGreaterThanOrEqual(2)
  })
})

describe('care paths: foreign-device denial', () => {
  let ctx: FakeCtx
  let ownerId: string
  let attackerId: string
  let scheduleId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    ownerId = await seedUser(ctx, 'Owner')
    attackerId = await seedUser(ctx, 'Attacker')
    const { plantId } = await seedDeviceWithPlant(ctx, ownerId, 'GM-OWNED')
    scheduleId = await ctx.db.insert('careSchedules', {
      plantId,
      title: 'Siram pagi',
      enabled: true,
      createdAt: now,
    })
  })

  it('rejects triggers on a foreign device', async () => {
    ctx.__testUserId = attackerId
    await expect(callHandler(triggerWatering, ctx, { deviceId: 'GM-OWNED' })).rejects.toThrow(
      'Perangkat tidak ditemukan',
    )
    await expect(
      callHandler(triggerLighting, ctx, { deviceId: 'GM-OWNED', enabled: true }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
  })

  it('rejects schedule creation against a foreign device', async () => {
    ctx.__testUserId = attackerId
    await expect(
      callHandler(saveCareSchedule, ctx, {
        deviceId: 'GM-OWNED',
        title: 'Jadwal jahat',
        cadenceUnit: 'days',
        cadenceValue: 1,
      }),
    ).rejects.toThrow('Perangkat tidak ditemukan')
  })

  it('rejects toggle/delete of a foreign schedule, owner can toggle', async () => {
    ctx.__testUserId = attackerId
    await expect(
      callHandler(toggleCareSchedule, ctx, { scheduleId, enabled: false }),
    ).rejects.toThrow('Jadwal tidak ditemukan')
    await expect(callHandler(deleteCareSchedule, ctx, { scheduleId })).rejects.toThrow(
      'Jadwal tidak ditemukan',
    )
    expect(await ctx.db.get(scheduleId)).not.toBeNull()

    ctx.__testUserId = ownerId
    const res = await callHandler(toggleCareSchedule, ctx, { scheduleId, enabled: false })
    expect(res.success).toBe(true)
    expect((await ctx.db.get(scheduleId))!.enabled).toBe(false)
  })
})

describe('support paths: foreign ticket/message denial', () => {
  let ctx: FakeCtx
  let ownerId: string
  let outsiderId: string
  let requestId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    ownerId = await seedUser(ctx, 'Owner')
    outsiderId = await seedUser(ctx, 'Outsider')
    ctx.__testUserId = ownerId
    const created = await callHandler(createSupportRequest, ctx, { topic: 'Air bocor' })
    requestId = created.requestId as string
  })

  it('rejects messages/close from a non-owner non-admin', async () => {
    ctx.__testUserId = outsiderId
    await expect(
      callHandler(sendSupportMessage, ctx, { requestId, body: 'ikut campur' }),
    ).rejects.toThrow('Permintaan dukungan tidak ditemukan')
    await expect(callHandler(closeSupportRequest, ctx, { requestId })).rejects.toThrow(
      'Permintaan dukungan tidak ditemukan',
    )
  })

  it('owner can message and close; unauthenticated cannot message', async () => {
    ctx.__testUserId = ownerId
    await expect(
      callHandler(sendSupportMessage, ctx, { requestId, body: 'info tambahan' }),
    ).resolves.toMatchObject({ success: true })
    await expect(callHandler(closeSupportRequest, ctx, { requestId })).resolves.toMatchObject({
      success: true,
    })
    expect((await ctx.db.get(requestId))!.status).toBe('closed')

    ctx.__testUserId = null
    await expect(
      callHandler(sendSupportMessage, ctx, { requestId, body: 'anon' }),
    ).rejects.toThrow('Autentikasi diperlukan')
  })
})

describe('users paths: claim/profile auth', () => {
  let ctx: FakeCtx
  beforeEach(() => {
    ctx = createFakeCtx()
  })

  it('rejects unauthenticated claim and profile writes', async () => {
    ctx.__testUserId = null
    await expect(callHandler(claimDevice, ctx, { deviceId: 'GM-FREE' })).rejects.toThrow(
      'Anda harus masuk terlebih dahulu',
    )
    await expect(callHandler(completeProfile, ctx, { name: 'Anon' })).rejects.toThrow(
      'Anda harus masuk terlebih dahulu',
    )
    await expect(
      callHandler(updateCurrentUserProfile, ctx, { name: 'Anon', handle: 'anon' }),
    ).rejects.toThrow('Autentikasi diperlukan')
  })

  it('requires a completed profile before claiming', async () => {
    const nameless = await ctx.db.insert('users', { role: 'grower' })
    await ctx.db.insert('devices', { deviceId: 'GM-FREE', name: 'Pod GM-FREE' })
    ctx.__testUserId = nameless
    await expect(callHandler(claimDevice, ctx, { deviceId: 'GM-FREE' })).rejects.toThrow(
      'Lengkapi profil Anda terlebih dahulu',
    )
  })

  it('rejects claiming a device owned by someone else; owner-claim succeeds', async () => {
    const owner = await seedUser(ctx, 'Owner')
    const claimer = await seedUser(ctx, 'Claimer')
    await ctx.db.insert('devices', {
      deviceId: 'GM-TAKEN',
      name: 'Pod GM-TAKEN',
      userId: owner,
    })
    const freeDocId = await ctx.db.insert('devices', {
      deviceId: 'GM-FREE',
      name: 'Pod GM-FREE',
    })

    ctx.__testUserId = claimer
    await expect(callHandler(claimDevice, ctx, { deviceId: 'GM-TAKEN' })).rejects.toThrow(
      'Perangkat ini sudah terhubung ke akun lain',
    )
    const res = await callHandler(claimDevice, ctx, { deviceId: 'GM-FREE' })
    expect(res.success).toBe(true)
    expect(String((await ctx.db.get(freeDocId))!.userId)).toBe(String(claimer))
  })
})

describe('notifications: cross-user isolation', () => {
  let ctx: FakeCtx
  let ownerId: string
  let outsiderId: string
  let notificationId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    ownerId = await seedUser(ctx, 'Owner')
    outsiderId = await seedUser(ctx, 'Outsider')
    notificationId = await ctx.db.insert('notifications', {
      userId: ownerId,
      title: 'Info',
      detail: 'Milik owner',
      kind: 'system',
      read: false,
      createdAt: now,
    })
  })

  it('rejects marking another user notification as read', async () => {
    ctx.__testUserId = outsiderId
    await expect(
      callHandler(markNotificationRead, ctx, { notificationId }),
    ).rejects.toThrow('Notifikasi tidak ditemukan')
    expect((await ctx.db.get(notificationId))!.read).toBe(false)

    ctx.__testUserId = null
    await expect(
      callHandler(markNotificationRead, ctx, { notificationId }),
    ).rejects.toThrow('Autentikasi diperlukan')
  })

  it('owner can mark their own notification as read', async () => {
    ctx.__testUserId = ownerId
    const res = await callHandler(markNotificationRead, ctx, { notificationId })
    expect(res.success).toBe(true)
    expect((await ctx.db.get(notificationId))!.read).toBe(true)
  })
})

describe('marketplace: publish permission and ownership', () => {
  let ctx: FakeCtx
  let sellerId: string
  let buyerId: string
  const draftDoc = {
    title: 'Bibit cabai',
    description: 'Bibit segar',
    category: 'benih',
    quantity: 10,
    quantityUnit: 'pack',
    price: 15000,
    priceUnit: 'pack',
    imageUrl: 'https://img.example/seed.jpg',
    locationLabel: 'Bandung',
    contactPreference: 'chat',
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }
  beforeEach(async () => {
    ctx = createFakeCtx()
    sellerId = await seedUser(ctx, 'Seller', 'grower')
    buyerId = await seedUser(ctx, 'Buyer', 'grower')
  })

  it('rejects publishing a draft owned by someone else; seller can publish', async () => {
    const draftId = await ctx.db.insert('listingDrafts', { ...draftDoc, userId: sellerId })

    ctx.__testUserId = buyerId
    await expect(callHandler(publishMarketplaceDraft, ctx, { draftId })).rejects.toThrow(
      'Draft tidak ditemukan',
    )
    expect((await ctx.db.get(draftId))!.status).toBe('draft')

    ctx.__testUserId = sellerId
    const res = await callHandler(publishMarketplaceDraft, ctx, { draftId })
    expect(res.success).toBe(true)
    const product = await ctx.db.get(res.productId as string)
    expect(String(product!.sellerId)).toBe(String(sellerId))
    expect(product!.type).toBe('community')
  })

  it('rejects listing status/delete from non-sellers; seller can update', async () => {
    const productId = await ctx.db.insert('products', {
      title: 'Panen tomat',
      description: 'Segar',
      price: 20000,
      category: 'panen',
      type: 'community',
      sellerId,
      status: 'active',
      quantityAvailable: 5,
      priceUnit: 'kg',
      featured: false,
      createdAt: now,
      updatedAt: now,
    })

    ctx.__testUserId = buyerId
    await expect(
      callHandler(updateMarketplaceListingStatus, ctx, { productId, status: 'sold' }),
    ).rejects.toThrow('Penawaran tidak ditemukan')
    await expect(callHandler(deleteMarketplaceListing, ctx, { productId })).rejects.toThrow(
      'Penawaran tidak ditemukan',
    )
    expect(await ctx.db.get(productId)).not.toBeNull()

    ctx.__testUserId = sellerId
    await expect(
      callHandler(updateMarketplaceListingStatus, ctx, { productId, status: 'sold' }),
    ).resolves.toMatchObject({ success: true })
    expect((await ctx.db.get(productId))!.status).toBe('sold')
  })

  it('P1 FIX-SPEC (fails until marketplace.ts:394 validates thread): rejects messages injected into a foreign thread', async () => {
    const productId = await ctx.db.insert('products', {
      title: 'Madu',
      description: 'Murni',
      price: 50000,
      category: 'olahan',
      type: 'community',
      sellerId,
      status: 'active',
      quantityAvailable: 2,
      priceUnit: 'botol',
      featured: false,
      createdAt: now,
      updatedAt: now,
    })
    // Legitimate thread between seller and buyer.
    ctx.__testUserId = buyerId
    const opened = await callHandler(sendMarketplaceMessage, ctx, {
      productId,
      body: 'Apakah masih tersedia?',
    })
    const threadId = opened.threadId as string
    const messageCountBefore = ctx.db.all('marketplaceMessages').length

    // Third user hijacks the foreign threadId: CORRECT behavior is rejection.
    const hijacker = await seedUser(ctx, 'Hijacker', 'grower')
    ctx.__testUserId = hijacker
    await expect(
      callHandler(sendMarketplaceMessage, ctx, { productId, threadId, body: 'spam' }),
    ).rejects.toThrow('Percakapan tidak ditemukan')
    expect(ctx.db.all('marketplaceMessages')).toHaveLength(messageCountBefore)
  })
})

describe('community: delete ownership', () => {
  let ctx: FakeCtx
  let ownerId: string
  let outsiderId: string
  let postId: string
  beforeEach(async () => {
    ctx = createFakeCtx()
    ownerId = await seedUser(ctx, 'Owner')
    outsiderId = await seedUser(ctx, 'Outsider')
    ctx.__testUserId = ownerId
    await callHandler(createPost, ctx, { title: 'Panen raya', body: 'Hasil kebun hari ini' })
    postId = ctx.db.all('communityPosts')[0]!._id as string
  })

  it('rejects deleting a foreign post; unauthenticated cannot create', async () => {
    ctx.__testUserId = outsiderId
    await expect(callHandler(deletePost, ctx, { postId })).rejects.toThrow(
      'Postingan tidak ditemukan',
    )
    expect(await ctx.db.get(postId)).not.toBeNull()

    ctx.__testUserId = null
    await expect(
      callHandler(createPost, ctx, { title: 'Anon', body: 'x' }),
    ).rejects.toThrow('Autentikasi diperlukan')
  })

  it('owner can delete their own post', async () => {
    ctx.__testUserId = ownerId
    const res = await callHandler(deletePost, ctx, { postId })
    expect(res.success).toBe(true)
    expect(await ctx.db.get(postId)).toBeNull()
  })
})
