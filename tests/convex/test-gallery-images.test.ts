/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { deviceGalleryImages } from '../../convex/devices'
import { GALLERY_IMAGES_CAP } from '../../convex/devices/history'
import { formatTimestamp } from '../../convex/helpers/generic'
import type { DeviceDoc } from '../../convex/types'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()

function baseDevice(overrides: Record<string, any> = {}): DeviceDoc {
  return {
    deviceId: 'GM-GAL',
    name: 'Gallery Pod',
    version: 'v1',
    autoWatering: true,
    autoLighting: true,
    wateringThreshold: 35,
    wateringDuration: 8,
    wateringCooldown: 21600,
    lightingThreshold: 40,
    lightingHysteresis: 8,
    autoFertilizing: false,
    autoPesticide: false,
    fertilizingThreshold: 35,
    fertilizingDuration: 10,
    fertilizingCooldown: 432000,
    pesticideThreshold: 50,
    pesticideDuration: 10,
    pesticideCooldown: 604800,
    lightEnabled: false,
    queuedCommands: { pump: null, light: null, fertilizer: null, pesticide: null },
    tankCapacity: 10,
    tankMinLevel: 10,
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as DeviceDoc
}

function baseUser() {
  return {
    name: 'Grower',
    role: 'user',
    points: 0,
    setupComplete: false,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Seed a user + owned device (userId on the device, ctx.__testUserId set —
 * the getSelectedDevice ownership semantics) plus `imageCount` plantImages
 * with ascending capturedAt in insertion order, so desc reads are newest-first.
 */
async function seedGallery(imageCount: number, externalId = 'GM-GAL') {
  const ctx: FakeCtx = createFakeCtx()
  const userId = await ctx.db.insert('users', baseUser())
  const internalId = await ctx.db.insert('devices', {
    ...baseDevice({ deviceId: externalId }),
    userId,
  })
  ctx.__testUserId = userId
  for (let i = 0; i < imageCount; i++) {
    await ctx.db.insert('plantImages', {
      deviceId: internalId,
      imageUrl: `snap-${i}.jpg`,
      source: 'camera',
      capturedAt: now - (imageCount - i) * 1000,
    })
  }
  return { ctx, userId, internalId, externalId }
}

describe('deviceGalleryImages', () => {
  it('returns [] for anonymous callers', async () => {
    const { ctx, externalId } = await seedGallery(3)
    ctx.__testUserId = null
    const res = await callHandler(deviceGalleryImages, ctx, { deviceId: externalId, limit: 10 })
    expect(res).toEqual([])
  })

  it('returns [] for an authenticated user with no owned devices (no deviceId)', async () => {
    const { ctx } = await seedGallery(3)
    const stranger = await ctx.db.insert('users', { ...baseUser(), name: 'Stranger' })
    ctx.__testUserId = stranger
    const res = await callHandler(deviceGalleryImages, ctx, {})
    expect(res).toEqual([])
  })

  it('rejects explicit reads of someone else\u2019s device', async () => {
    // Ownership gate: getSelectedDevice delegates to requireOwnedDevice for an
    // explicit deviceId, so cross-user reads throw instead of leaking rows.
    const { ctx, externalId } = await seedGallery(3)
    const stranger = await ctx.db.insert('users', { ...baseUser(), name: 'Stranger' })
    ctx.__testUserId = stranger
    await expect(callHandler(deviceGalleryImages, ctx, { deviceId: externalId })).rejects.toThrow(
      'Perangkat tidak ditemukan',
    )
  })

  it('returns newest-first mapped rows for the owner, excluding other devices', async () => {
    const { ctx, userId, externalId } = await seedGallery(5)
    // A foreign device image must never leak into this device's gallery.
    const otherInternal = await ctx.db.insert('devices', {
      ...baseDevice({ deviceId: 'GM-OTHER' }),
      userId,
    })
    await ctx.db.insert('plantImages', {
      deviceId: otherInternal,
      imageUrl: 'foreign.jpg',
      source: 'camera',
      capturedAt: now + 999_999,
    })

    const res = await callHandler(deviceGalleryImages, ctx, { deviceId: externalId, limit: 5 })
    expect(res).toHaveLength(5)
    const captured = res.map((r: any) => r.capturedAt)
    expect([...captured].sort((a, b) => b - a)).toEqual(captured)
    expect(res[0].imageUrl).toBe('snap-4.jpg')
    for (const row of res) {
      expect(row).toMatchObject({
        _id: expect.any(String),
        source: 'camera',
        capturedAt: expect.any(Number),
      })
      expect(row.capturedAtLabel).toBe(formatTimestamp(row.capturedAt))
    }
    expect(res.map((r: any) => r.imageUrl)).not.toContain('foreign.jpg')
  })

  it('applies the limit window (limit 2 of 5 seeded rows → 2 newest)', async () => {
    const { ctx, externalId } = await seedGallery(5)
    const res = await callHandler(deviceGalleryImages, ctx, { deviceId: externalId, limit: 2 })
    expect(res).toHaveLength(2)
    expect(res.map((r: any) => r.imageUrl)).toEqual(['snap-4.jpg', 'snap-3.jpg'])
  })

  it('clamps runaway limits to 100 rows max', async () => {
    expect(GALLERY_IMAGES_CAP).toBe(100)
    const { ctx, externalId } = await seedGallery(105)
    const res = await callHandler(deviceGalleryImages, ctx, { deviceId: externalId, limit: 500 })
    expect(res).toHaveLength(100)
    // Newest-first still holds under the clamp.
    const captured = res.map((r: any) => r.capturedAt)
    expect([...captured].sort((a, b) => b - a)).toEqual(captured)
  })
})
