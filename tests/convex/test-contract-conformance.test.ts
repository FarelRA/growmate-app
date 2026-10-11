/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Adversarial contract conformance (webapp <-> Convex <-> devices).
 *
 * Tries to BREAK the fleet contract and pins the correct behavior:
 * (a) deviceId charset/length/case/whitespace handling,
 * (b) variant matrix (absent/tech/tech-addon/garbage, v1 promotion, pods invariance),
 * (c) claim collisions (no fork/merge, same-id no-op, charset reject),
 * (d) current leg v2-only + DHT/raw cross-field parity with
 *     server/utils/deviceProtocol.ts,
 * (e) limit extremes on listRecordings/deviceGalleryImages,
 * (f) every stageable command kind round-trips through ingest with ids.
 *
 * FakeCtx pattern follows test-ingest-rules-fake.ts: in-memory ctx, handlers
 * invoked via `callHandler(fn, ctx, args)` (bypasses Convex arg validators,
 * so cores must fail closed on their own). Firmware truth wins ties:
 * pods src/api_client.c + api_parse.c + api_rules.c, tech
 * src/api_client.py + device_identity.py ([A-Za-z0-9_-]{1,31}, pods never
 * sends variant or the current leg).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { ingestAndAckSensorData } from '../../convex/sensors'
import { stageDeviceClaim, queueDeviceCommand } from '../../convex/admin/devices'
import { claimDevice } from '../../convex/users'
import { deviceGalleryImages, getUnclaimedDevice } from '../../convex/devices'
import { deviceGalleryImagesCore, GALLERY_IMAGES_CAP } from '../../convex/devices/history'
import {
  listRecordings,
  clampRecordingsLimit,
  DEFAULT_RECORDINGS_CAP,
  MAX_RECORDINGS_CAP,
} from '../../convex/streams'
import { validateDeviceEnvelope } from '../../server/utils/deviceProtocol'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const TEST_DEVICE_KEY = 'test-device-key'
const now = Date.now()

beforeEach(() => {
  process.env.DEVICE_API_KEY = TEST_DEVICE_KEY
})

function baseDevice(overrides: Record<string, any> = {}) {
  return {
    deviceId: 'IAET01',
    name: 'Test Pod',
    version: 'v1',
    autoWatering: false,
    autoLighting: false,
    wateringThreshold: 35,
    wateringDuration: 8,
    wateringCooldown: 21600,
    lightingThreshold: 30,
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
    batteryCapacityAh: 5,
    batteryAccumulatedMah: 0,
    batterySoC: 50,
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

async function seedDevice(ctx: FakeCtx, overrides: Record<string, any> = {}) {
  return await ctx.db.insert('devices', baseDevice(overrides))
}

function podsEnvelope(overrides: Record<string, any> = {}) {
  return {
    deviceKey: TEST_DEVICE_KEY,
    deviceId: 'IAET01',
    hardwareId: '7C87CE1A2B3C',
    firmwareVersion: '2.0.0',
    snapshotId: 'C-1',
    ageMs: 1800,
    appliedConfigRev: 0,
    sensors: [
      { kind: 'soil', unit: '%', raw: 2048 },
      { kind: 'light', unit: '%', raw: 3200 },
      { kind: 'water', unit: '%', raw: 3800 },
      { kind: 'temperature', unit: 'C', value: 24.6 },
      { kind: 'air', unit: '%', value: 61.2 },
    ],
    acceptedCommandIds: [],
    ...overrides,
  }
}

function techEnvelope(overrides: Record<string, any> = {}) {
  return {
    ...podsEnvelope(),
    deviceId: 'IAFU01',
    variant: 'tech',
    snapshotId: 'T-1',
    sensors: [
      { kind: 'soil', unit: '%', raw: 16000 },
      { kind: 'current', unit: 'raw', raw: 20070 },
      { kind: 'temperature', unit: 'C', value: 24.6 },
    ],
    ...overrides,
  }
}

function deviceRows(ctx: FakeCtx) {
  return ctx.db.all('devices')
}

// ---------------------------------------------------------------------------
// (a) deviceId: whitespace, case, length, charset
// ---------------------------------------------------------------------------

describe('contract (a): deviceId handling', () => {
  it('trims leading/trailing whitespace instead of forking a row', async () => {
    const ctx = createFakeCtx()
    await seedDevice(ctx)
    const res: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: '  IAET01\t',
      snapshotId: 'C-2',
    }))
    expect(res.commands).toEqual(expect.any(Array))
    expect(deviceRows(ctx)).toHaveLength(1)
    expect(deviceRows(ctx)[0].deviceId).toBe('IAET01')
  })

  it('treats lowercase and uppercase as distinct ids (firmware strcmp is case-sensitive)', async () => {
    const ctx = createFakeCtx()
    await seedDevice(ctx)
    await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: 'iaet01',
      hardwareId: 'AAAAAAAAAAAAAAAA',
      snapshotId: 'C-3',
    }))
    const rows = deviceRows(ctx)
    expect(rows).toHaveLength(2)
    expect(rows.map((d) => d.deviceId).sort()).toEqual(['IAET01', 'iaet01'])
  })

  it('accepts a 31-char id and rejects a 32-char id', async () => {
    const ctx = createFakeCtx()
    const ok31 = 'A'.repeat(31)
    await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: ok31,
      hardwareId: 'BBBBBBBBBBBB',
      snapshotId: 'C-4',
    }))
    expect(deviceRows(ctx).map((d) => d.deviceId)).toContain(ok31)
    await expect(
      callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
        deviceId: 'A'.repeat(32),
        snapshotId: 'C-5',
      })),
    ).rejects.toThrow('deviceId tidak valid')
    expect(deviceRows(ctx)).toHaveLength(1)
  })

  it('allows dash and underscore, rejects space and bang', async () => {
    const ctx = createFakeCtx()
    await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: 'IA-ET_01',
      hardwareId: 'CCCCCCCCCCCC',
      snapshotId: 'C-6',
    }))
    expect(deviceRows(ctx).map((d) => d.deviceId)).toContain('IA-ET_01')
    for (const badId of ['IA ET01', 'IAET01!', 'IAET01.', '']) {
      await expect(
        callHandler(ingestAndAckSensorData, ctx, podsEnvelope({ deviceId: badId })),
      ).rejects.toThrow()
    }
    expect(deviceRows(ctx)).toHaveLength(1)
  })

  it('claimDevice and getUnclaimedDevice trim whitespace like the webapp does', async () => {
    const ctx = createFakeCtx()
    const userId = await ctx.db.insert('users', {
      name: 'Grower',
      email: 'grower@example.test',
      role: 'grower',
      createdAt: now,
      updatedAt: now,
    })
    await seedDevice(ctx)
    ctx.__testUserId = userId
    const found: any = await callHandler(getUnclaimedDevice, ctx, { deviceId: '  IAET01 ' })
    expect(found).toMatchObject({ deviceId: 'IAET01' })
    const claimed: any = await callHandler(claimDevice, ctx, { deviceId: '\tIAET01\n' })
    expect(claimed.success).toBe(true)
    expect(claimed.device.deviceId).toBe('IAET01')
  })

  it('Nitro validator enforces the same charset/length at the edge with 400', () => {
    expect(validateDeviceEnvelope({ deviceId: 'IAET01', sensors: [] }).deviceId).toBe('IAET01')
    expect(validateDeviceEnvelope({ deviceId: '  IAET01  ', sensors: [] }).deviceId).toBe('IAET01')
    // Lowercase passes through unfolded: distinctness is preserved end to end.
    expect(validateDeviceEnvelope({ deviceId: 'iaet01', sensors: [] }).deviceId).toBe('iaet01')
    expect(validateDeviceEnvelope({ deviceId: 'A'.repeat(31), sensors: [] }).deviceId).toBe(
      'A'.repeat(31),
    )
    for (const badId of ['A'.repeat(32), 'bad id!', 'IAET01!', 'IA ET01']) {
      expect(() => validateDeviceEnvelope({ deviceId: badId, sensors: [] })).toThrowError(
        expect.objectContaining({ statusCode: 400 }),
      )
    }
  })
})

// ---------------------------------------------------------------------------
// (b) variant matrix
// ---------------------------------------------------------------------------

describe('contract (b): variant matrix', () => {
  it('absent variant auto-provisions v1 with no variant field', async () => {
    const ctx = createFakeCtx()
    await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: 'IAET09',
      hardwareId: 'DDDDDDDDDDDD',
    }))
    const device = deviceRows(ctx)[0] as any
    expect(device.version).toBe('v1')
    expect(device.variant).toBeUndefined()
  })

  it.each(['tech', 'tech-addon'])('variant %s auto-provisions v2 and stores the variant', async (variant) => {
    const ctx = createFakeCtx()
    const id = variant === 'tech' ? 'IAFU09' : 'IAFT09'
    await callHandler(ingestAndAckSensorData, ctx, techEnvelope({
      deviceId: id,
      variant,
      hardwareId: 'EEEEEEEEEEEE',
    }))
    const device = deviceRows(ctx)[0] as any
    expect(device.version).toBe('v2')
    expect(device.variant).toBe(variant)
  })

  it('rejects a garbage variant without creating a row', async () => {
    const ctx = createFakeCtx()
    await expect(
      callHandler(ingestAndAckSensorData, ctx, techEnvelope({ variant: 'evil' })),
    ).rejects.toThrow('variant must be tech or tech-addon')
    expect(deviceRows(ctx)).toHaveLength(0)
  })

  it('promotes a pre-existing v1 row to v2 when it starts reporting a variant', async () => {
    const ctx = createFakeCtx()
    await seedDevice(ctx, { deviceId: 'IAFU02', version: 'v1' })
    await callHandler(ingestAndAckSensorData, ctx, techEnvelope({
      deviceId: 'IAFU02',
      hardwareId: 'FFFFFFFFFFFF',
      snapshotId: 'T-2',
    }))
    const rows = deviceRows(ctx)
    expect(rows).toHaveLength(1)
    expect((rows[0] as any).version).toBe('v2')
    expect((rows[0] as any).variant).toBe('tech')
  })

  it('pods rows never gain a variant and never downgrade from v2', async () => {
    const ctx = createFakeCtx()
    await seedDevice(ctx, { deviceId: 'IAFU03', version: 'v2', variant: 'tech' })
    await seedDevice(ctx, { deviceId: 'IAET04', version: 'v1' })
    await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: 'IAFU03',
      hardwareId: undefined,
      snapshotId: 'C-7',
    }))
    await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: 'IAET04',
      hardwareId: undefined,
      snapshotId: 'C-8',
    }))
    const byId = new Map(deviceRows(ctx).map((d) => [d.deviceId, d] as const))
    expect((byId.get('IAFU03') as any).version).toBe('v2')
    expect((byId.get('IAFU03') as any).variant).toBe('tech')
    expect((byId.get('IAET04') as any).version).toBe('v1')
    expect((byId.get('IAET04') as any).variant).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// (c) claim collisions
// ---------------------------------------------------------------------------

describe('contract (c): claim collisions', () => {
  async function seedPair(ctx: FakeCtx) {
    await seedDevice(ctx, { deviceId: 'IAET01', hardwareId: 'HW-A' })
    await seedDevice(ctx, { deviceId: 'IAET02', hardwareId: 'HW-B', name: 'Second Pod' })
  }

  it('rename onto an existing deviceId throws and forks/merges nothing', async () => {
    const ctx = createFakeCtx()
    await seedPair(ctx)
    await expect(
      callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
        deviceId: 'IAET02',
        hardwareId: 'HW-A',
        snapshotId: 'C-9',
      })),
    ).rejects.toThrow('ID perangkat tersebut sudah digunakan')
    const rows = deviceRows(ctx)
    expect(rows).toHaveLength(2)
    const byId = new Map(rows.map((d) => [d.deviceId, d] as const))
    expect((byId.get('IAET01') as any).hardwareId).toBe('HW-A')
    expect((byId.get('IAET02') as any).hardwareId).toBe('HW-B')
  })

  it('reporting the same id is a no-op', async () => {
    const ctx = createFakeCtx()
    await seedPair(ctx)
    const res: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
      deviceId: 'IAET01',
      hardwareId: 'HW-A',
      snapshotId: 'C-10',
    }))
    expect(res.claim).toBeUndefined()
    expect(deviceRows(ctx)).toHaveLength(2)
    expect(deviceRows(ctx).map((d) => d.deviceId).sort()).toEqual(['IAET01', 'IAET02'])
  })

  it('staged claims reject bad charset and taken ids, accept a same-id claim', async () => {
    const ctx = createFakeCtx()
    await seedPair(ctx)
    await expect(
      stageDeviceClaim(ctx as any, { deviceId: 'IAET01', claimDeviceId: 'bad id!' }),
    ).rejects.toThrow('claim must match')
    await expect(
      stageDeviceClaim(ctx as any, { deviceId: 'IAET01', claimDeviceId: 'IAET02' }),
    ).rejects.toThrow('ID perangkat tersebut sudah digunakan')
    const same: any = await stageDeviceClaim(ctx as any, {
      deviceId: 'IAET01',
      claimDeviceId: 'IAET01',
    })
    expect(same).toMatchObject({ success: true, claim: 'IAET01' })
    expect(deviceRows(ctx)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// (d) current leg v2-only + DHT/raw cross-field parity
// ---------------------------------------------------------------------------

describe('contract (d): current leg and DHT/raw shapes', () => {
  it('rejects a current leg without a tech variant (pods never sends it)', async () => {
    const ctx = createFakeCtx()
    await seedDevice(ctx)
    await expect(
      callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
        sensors: [{ kind: 'current', unit: 'raw', raw: 2000 }],
      })),
    ).rejects.toThrow('current leg requires a tech variant')
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'IAET01',
        sensors: [{ kind: 'current', unit: 'raw', raw: 2000 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects value on current and current without raw', async () => {
    const ctx = createFakeCtx()
    await expect(
      callHandler(ingestAndAckSensorData, ctx, techEnvelope({
        sensors: [{ kind: 'current', unit: 'mA', raw: 20070, value: 5 }],
      })),
    ).rejects.toThrow('RAW-only')
    await expect(
      callHandler(ingestAndAckSensorData, ctx, techEnvelope({
        sensors: [{ kind: 'current', unit: 'mA', value: 5 }],
      })),
    ).rejects.toThrow()
    await expect(
      callHandler(ingestAndAckSensorData, ctx, techEnvelope({
        sensors: [{ kind: 'current', unit: 'raw' }],
      })),
    ).rejects.toThrow('MISSING raw')
  })

  it('rejects raw on DHT kinds on both layers', async () => {
    const ctx = createFakeCtx()
    await expect(
      callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
        sensors: [{ kind: 'temperature', unit: 'C', value: 24.5, raw: 100 }],
      })),
    ).rejects.toThrow('DHT must not carry raw')
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'IAET01',
        sensors: [{ kind: 'temperature', unit: 'C', value: 24.5, raw: 100 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects DHT kinds missing value and unknown sensor kinds', async () => {
    const ctx = createFakeCtx()
    await expect(
      callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
        sensors: [{ kind: 'air', unit: '%' }],
      })),
    ).rejects.toThrow('MISSING value')
    await expect(
      callHandler(ingestAndAckSensorData, ctx, podsEnvelope({
        sensors: [{ kind: 'humidity', unit: '%', raw: 10 }],
      })),
    ).rejects.toThrow('Unknown sensor kind')
  })

  it('converts the v2 current leg to mA and feeds the battery state', async () => {
    const ctx = createFakeCtx()
    const res: any = await callHandler(ingestAndAckSensorData, ctx, techEnvelope())
    expect(res.commands).toEqual([])
    const current = ctx.db.all('sensorReadings').find((r) => r.kind === 'current') as any
    expect(current).toBeTruthy()
    expect(current.unit).toBe('mA')
    expect(current.raw).toBe(20070)
    const device = deviceRows(ctx)[0] as any
    expect(device.version).toBe('v2')
    expect(device.batteryCurrent).toBe(current.value)
    expect(typeof device.batterySoC).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// (e) limit extremes
// ---------------------------------------------------------------------------

describe('contract (e): listing limit extremes', () => {
  it('clampRecordingsLimit clamps extremes and defaults absent/NaN', () => {
    expect(DEFAULT_RECORDINGS_CAP).toBe(50)
    expect(MAX_RECORDINGS_CAP).toBe(100)
    expect(clampRecordingsLimit(undefined)).toBe(50)
    expect(clampRecordingsLimit(Number.NaN)).toBe(50)
    expect(clampRecordingsLimit(0)).toBe(0)
    expect(clampRecordingsLimit(-5)).toBe(0)
    expect(clampRecordingsLimit(2.9)).toBe(2)
    expect(clampRecordingsLimit(500)).toBe(100)
  })

  async function seedRecordings(count: number) {
    const ctx = createFakeCtx()
    const userId = await ctx.db.insert('users', { name: 'Grower', role: 'grower' })
    const internalId = await ctx.db.insert('devices', { ...baseDevice(), userId })
    ctx.__testUserId = userId
    for (let i = 0; i < count; i++) {
      await ctx.db.insert('videoRecordings', {
        deviceId: internalId,
        fileName: `seg-${i}.mp4`,
        path: `iaet01/seg-${i}.mp4`,
        size: 1024,
        capturedAt: now - (count - i) * 1000,
        uploadedAt: now,
      })
    }
    return ctx
  }

  it('listRecordings applies the clamped limit at the handler', async () => {
    const ctx = await seedRecordings(5)
    expect(await callHandler(listRecordings, ctx, { deviceId: 'IAET01', limit: 2 })).toHaveLength(2)
    expect(await callHandler(listRecordings, ctx, { deviceId: 'IAET01', limit: 0 })).toHaveLength(0)
    expect(await callHandler(listRecordings, ctx, { deviceId: 'IAET01', limit: -5 })).toHaveLength(0)
    expect(await callHandler(listRecordings, ctx, { deviceId: 'IAET01', limit: 2.9 })).toHaveLength(2)
    // Absent limit serves the 50-row default window (all 5 seeded rows here).
    expect(await callHandler(listRecordings, ctx, { deviceId: 'IAET01' })).toHaveLength(5)
  })

  async function seedGallery(count: number, externalId = 'IAET01') {
    const ctx = createFakeCtx()
    const userId = await ctx.db.insert('users', { name: 'Grower', role: 'grower' })
    const internalId = await ctx.db.insert('devices', {
      ...baseDevice({ deviceId: externalId }),
      userId,
    })
    ctx.__testUserId = userId
    for (let i = 0; i < count; i++) {
      await ctx.db.insert('plantImages', {
        deviceId: internalId,
        imageUrl: `snap-${i}`,
        source: 'camera',
        capturedAt: now - (count - i) * 1000,
      })
    }
    const device = (await ctx.db.get(internalId)) as any
    return { ctx, device, externalId }
  }

  it('deviceGalleryImagesCore clamps to [1, 100] and floors floats', async () => {
    expect(GALLERY_IMAGES_CAP).toBe(100)
    const { ctx, device } = await seedGallery(105)
    // Floor of 1: zero and negative serve one row, never zero or an error.
    expect(await deviceGalleryImagesCore(ctx as any, device, 0)).toHaveLength(1)
    expect(await deviceGalleryImagesCore(ctx as any, device, -5)).toHaveLength(1)
    expect(await deviceGalleryImagesCore(ctx as any, device, Number.NaN)).toHaveLength(1)
    expect(await deviceGalleryImagesCore(ctx as any, device, 2.9)).toHaveLength(2)
    const huge = await deviceGalleryImagesCore(ctx as any, device, 500)
    expect(huge).toHaveLength(100)
    const captured = huge.map((r: any) => r.capturedAt)
    expect([...captured].sort((a, b) => b - a)).toEqual(captured)
  })

  it('deviceGalleryImages defaults an absent limit to 24 rows', async () => {
    const { ctx, externalId } = await seedGallery(30)
    const res: any = await callHandler(deviceGalleryImages, ctx, { deviceId: externalId })
    expect(res).toHaveLength(24)
  })
})

// ---------------------------------------------------------------------------
// (f) every stageable command kind round-trips with required ids
// ---------------------------------------------------------------------------

describe('contract (f): staged commands round-trip through ingest', () => {
  it('pump/light/fertilizer/pesticide/video_start then video_stop all carry ids', async () => {
    const ctx = createFakeCtx()
    await seedDevice(ctx, { deviceId: 'IAFU01', version: 'v2', variant: 'tech' })

    const pump: any = await queueDeviceCommand(ctx as any, {
      deviceId: 'IAFU01', kind: 'pump', durationMs: 5000,
    })
    const light: any = await queueDeviceCommand(ctx as any, {
      deviceId: 'IAFU01', kind: 'light', enabled: true,
    })
    const fertilizer: any = await queueDeviceCommand(ctx as any, {
      deviceId: 'IAFU01', kind: 'fertilizer', durationMs: 8000,
    })
    const pesticide: any = await queueDeviceCommand(ctx as any, {
      deviceId: 'IAFU01', kind: 'pesticide', durationMs: 9000,
    })
    const videoStart: any = await queueDeviceCommand(ctx as any, {
      deviceId: 'IAFU01', kind: 'video_start',
      width: 640, height: 480, fps: 5, quality: 70, maxSec: 300,
    })
    for (const staged of [pump, light, fertilizer, pesticide, videoStart]) {
      expect(typeof staged.queued.id).toBe('string')
      expect(staged.queued.id.length).toBeGreaterThan(0)
    }

    const first: any = await callHandler(ingestAndAckSensorData, ctx, techEnvelope({ snapshotId: 'T-10' }))
    const kinds = first.commands.map((c: any) => c.kind).sort()
    expect(kinds).toEqual(['fertilizer', 'light', 'pesticide', 'pump', 'video_start'])
    for (const command of first.commands) {
      expect(typeof command.id).toBe('string')
      expect(command.id.length).toBeGreaterThan(0)
    }
    expect(first.commands.find((c: any) => c.kind === 'pump').id).toBe(pump.queued.id)
    expect(first.commands.find((c: any) => c.kind === 'light').id).toBe(light.queued.id)
    expect(first.commands.find((c: any) => c.kind === 'fertilizer')).toMatchObject({
      durationMs: 8000,
      id: fertilizer.queued.id,
    })
    expect(first.commands.find((c: any) => c.kind === 'pesticide')).toMatchObject({
      durationMs: 9000,
      id: pesticide.queued.id,
    })
    expect(first.commands.find((c: any) => c.kind === 'video_start')).toMatchObject({
      width: 640,
      height: 480,
      fps: 5,
      id: videoStart.queued.id,
    })

    // video_stop supersedes video_start and round-trips with its own id.
    const videoStop: any = await queueDeviceCommand(ctx as any, {
      deviceId: 'IAFU01', kind: 'video_stop',
    })
    expect(typeof videoStop.queued.id).toBe('string')
    const second: any = await callHandler(ingestAndAckSensorData, ctx, techEnvelope({ snapshotId: 'T-11' }))
    const secondKinds = second.commands.map((c: any) => c.kind)
    expect(secondKinds).toContain('video_stop')
    expect(secondKinds).not.toContain('video_start')
    expect(second.commands.find((c: any) => c.kind === 'video_stop').id).toBe(videoStop.queued.id)
  })
})
