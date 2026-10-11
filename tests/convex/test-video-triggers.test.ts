/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest'
import { triggerVideoStartCore, triggerVideoStopCore } from '../../convex/care/triggers'
import type { DeviceDoc } from '../../convex/types'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'
import { ingestAndAckSensorData } from '../../convex/sensors'

const now = Date.now()
const TEST_DEVICE_KEY = 'test-device-key'

beforeEach(() => {
  process.env.DEVICE_API_KEY = TEST_DEVICE_KEY
})

async function seedV2(ctx: FakeCtx) {
  const userId = await ctx.db.insert('users', {
    name: 'Grower', role: 'user', points: 0, setupComplete: false,
    createdAt: now, updatedAt: now,
  })
  const deviceId = await ctx.db.insert('devices', {
    deviceId: 'TECH01',
    name: 'Tech',
    version: 'v2',
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
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
    userId,
  } as unknown as DeviceDoc)
  ctx.__testUserId = userId
  return { userId, deviceId }
}

function techEnvelope(overrides: Record<string, any> = {}) {
  return {
    deviceKey: TEST_DEVICE_KEY,
    deviceId: 'TECH01',
    hardwareId: '7C87CE1A2B3C',
    firmwareVersion: '2.0.0',
    variant: 'tech',
    snapshotId: 'B1-1',
    ageMs: 100,
    appliedConfigRev: 0,
    sensors: [{ kind: 'temperature', unit: 'C', value: 25 }],
    acceptedCommandIds: [],
    currentState: {
      pumpEnabled: false, lightEnabled: false,
      fertilizerEnabled: false, pesticideEnabled: false,
      batteryCurrent: null, streaming: false, streamFps: 0,
    },
    health: { heapFree: 1, rssi: 0, uptimeS: 1, bootCount: 1, resetReason: 'power-on', dhtFails: 0, adcFails: 0 },
    ...overrides,
  }
}

describe('user video stream triggers', () => {
  it('start queues a validated video_start delivered on next ingest', async () => {
    const ctx = createFakeCtx()
    await seedV2(ctx)
    await triggerVideoStartCore(ctx, { _id: ctx.__testUserId }, 'TECH01')

    const stored = ctx.db.all('devices')[0] as any
    expect(stored.queuedCommands.videoStart).toMatchObject({
      kind: 'video_start', width: 640, height: 480, fps: 5, quality: 70, maxSec: 300,
      id: expect.any(String),
    })

    const res: any = await callHandler(ingestAndAckSensorData, ctx, techEnvelope())
    expect(res.commands.map((c: any) => c.kind)).toContain('video_start')
    expect(ctx.db.all('growEvents').map((e) => e.eventType)).toContain('manual_stream_started')
  })

  it('stop clears a pending start and queues an ackable video_stop', async () => {
    const ctx = createFakeCtx()
    await seedV2(ctx)
    await triggerVideoStartCore(ctx, { _id: ctx.__testUserId }, 'TECH01')
    await triggerVideoStopCore(ctx, { _id: ctx.__testUserId }, 'TECH01')

    const stored = ctx.db.all('devices')[0] as any
    expect(stored.queuedCommands.videoStart).toBeNull()
    expect(stored.queuedCommands.videoStop).toMatchObject({
      kind: 'video_stop', id: expect.any(String),
    })

    const stopId = stored.queuedCommands.videoStop.id
    const res: any = await callHandler(
      ingestAndAckSensorData, ctx, techEnvelope({ snapshotId: 'B1-2', acceptedCommandIds: [stopId] }),
    )
    // The stop was already acked in this envelope: nothing redelivered.
    expect(res.commands).toEqual([])
    expect(ctx.db.all('growEvents').map((e) => e.eventType)).toContain('manual_stream_stopped')
  })

  it('rejects out-of-bounds params and non-v2 devices', async () => {
    const ctx = createFakeCtx()
    await seedV2(ctx)
    await expect(
      triggerVideoStartCore(ctx, { _id: ctx.__testUserId }, 'TECH01', { width: 9999 }),
    ).rejects.toThrow()
    await expect(
      triggerVideoStartCore(ctx, { _id: ctx.__testUserId }, 'TECH01', { fps: 99 }),
    ).rejects.toThrow()

    const podsId = await ctx.db.insert('devices', {
      ...(ctx.db.all('devices')[0] as any),
      deviceId: 'IAET-01', version: 'v1',
    })
    void podsId
    await expect(
      triggerVideoStartCore(ctx, { _id: ctx.__testUserId }, 'IAET-01'),
    ).rejects.toThrow()
    await expect(
      triggerVideoStopCore(ctx, { _id: ctx.__testUserId }, 'IAET-01'),
    ).rejects.toThrow()
  })
})
