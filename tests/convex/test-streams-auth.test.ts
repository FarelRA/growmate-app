/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import {
  registerStream,
  recordStreamSegment,
  listRecordings,
} from '../../convex/streams'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const DEVICE_KEY = 'test-device-key-123'
const now = Date.now()

let savedEnv: string | undefined
beforeEach(() => {
  savedEnv = process.env.DEVICE_API_KEY
  process.env.DEVICE_API_KEY = DEVICE_KEY
})
afterEach(() => {
  if (savedEnv === undefined) delete process.env.DEVICE_API_KEY
  else process.env.DEVICE_API_KEY = savedEnv
})

async function seedUser(ctx: FakeCtx, name = 'Grower'): Promise<string> {
  return await ctx.db.insert('users', {
    name,
    role: 'user',
    points: 0,
    setupComplete: false,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedDevice(ctx: FakeCtx, externalId: string, userId: string | undefined): Promise<string> {
  return await ctx.db.insert('devices', {
    deviceId: externalId,
    name: `Pod ${externalId}`,
    userId,
    createdAt: now,
    updatedAt: now,
  })
}

async function seedRecording(ctx: FakeCtx, deviceDocId: string, fileName: string): Promise<string> {
  return await ctx.db.insert('videoRecordings', {
    deviceId: deviceDocId,
    fileName,
    path: `dev/stream/${fileName}`,
    size: 1024,
    capturedAt: now,
    uploadedAt: now,
  })
}

describe('streams device-key auth (registerStream / recordStreamSegment)', () => {
  it('rejects registerStream when the server key is unset (fail-closed)', async () => {
    delete process.env.DEVICE_API_KEY
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-A', undefined)

    await expect(
      callHandler(registerStream, ctx, {
        deviceId: 'GM-A',
        streamUrl: 'tcp://attacker.example:8554/x',
        deviceKey: 'anything',
      }),
    ).rejects.toThrow('server misconfigured')
  })

  it('rejects registerStream with the wrong key and leaves the device untouched', async () => {
    const ctx = createFakeCtx(null)
    const deviceDocId = await seedDevice(ctx, 'GM-A', undefined)

    await expect(
      callHandler(registerStream, ctx, {
        deviceId: 'GM-A',
        streamUrl: 'tcp://attacker.example:8554/x',
        deviceKey: 'wrong-key',
      }),
    ).rejects.toThrow('Unauthorized')

    const device = await ctx.db.get(deviceDocId)
    expect(device?.streamUrl).toBeUndefined()
    expect(ctx.db.all('growEvents')).toHaveLength(0)
  })

  it('accepts registerStream with the correct device key', async () => {
    const ctx = createFakeCtx(null)
    const deviceDocId = await seedDevice(ctx, 'GM-A', undefined)

    const res = await callHandler(registerStream, ctx, {
      deviceId: 'GM-A',
      streamUrl: 'tcp://cam.local:8554/stream',
      deviceKey: DEVICE_KEY,
    })
    expect(res).toEqual({ success: true })

    const device = await ctx.db.get(deviceDocId)
    expect(device?.streamUrl).toBe('tcp://cam.local:8554/stream')
    expect(ctx.db.all('growEvents')).toHaveLength(1)
  })

  it('rejects recordStreamSegment when the server key is unset (fail-closed)', async () => {
    delete process.env.DEVICE_API_KEY
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-A', undefined)

    await expect(
      callHandler(recordStreamSegment, ctx, {
        deviceId: 'GM-A',
        fileName: 'evil.h264',
        path: 'evil/stream/evil.h264',
        size: 1,
        capturedAt: now,
        deviceKey: DEVICE_KEY,
      }),
    ).rejects.toThrow('server misconfigured')
    expect(ctx.db.all('videoRecordings')).toHaveLength(0)
  })

  it('rejects recordStreamSegment with the wrong key and inserts nothing', async () => {
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-A', undefined)

    await expect(
      callHandler(recordStreamSegment, ctx, {
        deviceId: 'GM-A',
        fileName: 'evil.h264',
        path: 'evil/stream/evil.h264',
        size: 1,
        capturedAt: now,
        deviceKey: 'wrong-key',
      }),
    ).rejects.toThrow('Unauthorized')
    expect(ctx.db.all('videoRecordings')).toHaveLength(0)
  })

  it('accepts recordStreamSegment with the correct device key', async () => {
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-A', undefined)

    const res = await callHandler(recordStreamSegment, ctx, {
      deviceId: 'GM-A',
      fileName: '20240101_120000.h264',
      path: 'GM-A/stream/20240101_120000.h264',
      size: 2048,
      capturedAt: now,
      deviceKey: DEVICE_KEY,
    })
    expect(res.success).toBe(true)
    expect(typeof res.recordingId).toBe('string')
    expect(ctx.db.all('videoRecordings')).toHaveLength(1)
  })
})

describe('streams listRecordings ownership', () => {
  it('denies anonymous callers with an empty list', async () => {
    const ctx = createFakeCtx(null)
    const ownerId = await seedUser(ctx, 'Owner')
    const deviceDocId = await seedDevice(ctx, 'GM-A', ownerId)
    await seedRecording(ctx, deviceDocId, 'a.h264')

    const rows = await callHandler(listRecordings, ctx, { deviceId: 'GM-A' })
    expect(rows).toEqual([])
  })

  it('denies cross-user callers with an empty list (no S3 path leak)', async () => {
    const ctx = createFakeCtx(null)
    const ownerId = await seedUser(ctx, 'Owner')
    const intruderId = await seedUser(ctx, 'Intruder')
    const deviceDocId = await seedDevice(ctx, 'GM-A', ownerId)
    await seedRecording(ctx, deviceDocId, 'secret.h264')

    ctx.__testUserId = intruderId
    const rows = await callHandler(listRecordings, ctx, { deviceId: 'GM-A' })
    expect(rows).toEqual([])
  })

  it('denies access to unclaimed devices', async () => {
    const ctx = createFakeCtx(null)
    const userId = await seedUser(ctx, 'Grower')
    const deviceDocId = await seedDevice(ctx, 'GM-A', undefined)
    await seedRecording(ctx, deviceDocId, 'a.h264')

    ctx.__testUserId = userId
    const rows = await callHandler(listRecordings, ctx, { deviceId: 'GM-A' })
    expect(rows).toEqual([])
  })

  it('allows the owning user to list recordings', async () => {
    const ctx = createFakeCtx(null)
    const ownerId = await seedUser(ctx, 'Owner')
    const deviceDocId = await seedDevice(ctx, 'GM-A', ownerId)
    await seedRecording(ctx, deviceDocId, 'a.h264')
    await seedRecording(ctx, deviceDocId, 'b.h264')

    ctx.__testUserId = ownerId
    const rows = await callHandler(listRecordings, ctx, { deviceId: 'GM-A' })
    expect(rows).toHaveLength(2)
    expect(rows.map((r: any) => r.fileName).sort()).toEqual(['a.h264', 'b.h264'])
  })

  it('returns [] for unknown devices even when authenticated', async () => {
    const ctx = createFakeCtx(null)
    const userId = await seedUser(ctx, 'Grower')
    ctx.__testUserId = userId

    const rows = await callHandler(listRecordings, ctx, { deviceId: 'GM-NOPE' })
    expect(rows).toEqual([])
  })
})
