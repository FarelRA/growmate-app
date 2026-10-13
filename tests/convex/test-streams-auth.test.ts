/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { listRecordings, recordLiveSession } from '../../convex/streams'
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

describe('streams recordLiveSession', () => {
  it('fails closed when DEVICE_API_KEY is unset', async () => {
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-LIVE', undefined)
    delete process.env.DEVICE_API_KEY
    await expect(
      callHandler(recordLiveSession, ctx, {
        deviceKey: DEVICE_KEY,
        deviceId: 'GM-LIVE',
        fileName: 'vid.mjpeg',
        path: 'GM-LIVE/live/vid.mjpeg',
        size: 100,
        capturedAt: now,
      }),
    ).rejects.toThrow('server misconfigured')
  })

  it('rejects a wrong deviceKey with 401', async () => {
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-LIVE', undefined)
    await expect(
      callHandler(recordLiveSession, ctx, {
        deviceKey: 'wrong-key',
        deviceId: 'GM-LIVE',
        fileName: 'vid.mjpeg',
        path: 'GM-LIVE/live/vid.mjpeg',
        size: 100,
        capturedAt: now,
      }),
    ).rejects.toThrow('Unauthorized')
  })

  it('inserts a videoRecordings row and returns success', async () => {
    const ctx = createFakeCtx(null)
    await seedDevice(ctx, 'GM-LIVE', undefined)
    const res = await callHandler(recordLiveSession, ctx, {
      deviceKey: DEVICE_KEY,
      deviceId: 'GM-LIVE',
      fileName: 'vid.mjpeg',
      path: 'GM-LIVE/live/vid.mjpeg',
      size: 1234,
      durationMs: 5000,
      capturedAt: now,
    })
    expect(res.success).toBe(true)
    expect(typeof res.recordingId).toBe('string')
    const rows = ctx.db.all('videoRecordings')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      fileName: 'vid.mjpeg',
      path: 'GM-LIVE/live/vid.mjpeg',
      size: 1234,
      durationMs: 5000,
      capturedAt: now,
    })
    expect(res.recordingId).toBe(rows[0]!._id)
  })

  it('auto-registers an unknown unit as v2 (open intake)', async () => {
    const ctx = createFakeCtx(null)
    const res: any = await callHandler(recordLiveSession, ctx, {
      deviceKey: DEVICE_KEY,
      deviceId: 'IAFT99',
      fileName: 'vid.mjpeg',
      path: 'IAFT99/live/vid.mjpeg',
      size: 100,
      capturedAt: now,
    })
    expect(res.success).toBe(true)
    const devices = ctx.db.all('devices')
    expect(devices).toHaveLength(1)
    expect(devices[0]).toMatchObject({ deviceId: 'IAFT99', version: 'v2', variant: 'tech' })
  })

  it('follows a hardware rename instead of forking a row', async () => {
    const ctx = createFakeCtx(null)
    const docId = await seedDevice(ctx, 'IAFT98', undefined)
    await ctx.db.patch(docId, { hardwareId: 'AA9988776655' })
    const res: any = await callHandler(recordLiveSession, ctx, {
      deviceKey: DEVICE_KEY,
      deviceId: 'IAFT99',
      hardwareId: 'AA9988776655',
      fileName: 'vid.mjpeg',
      path: 'IAFT99/live/vid.mjpeg',
      size: 100,
      capturedAt: now,
    })
    expect(res.success).toBe(true)
    expect(ctx.db.all('devices')).toHaveLength(1)
    expect(await ctx.db.get(docId)).toMatchObject({ deviceId: 'IAFT99' })
  })
})
