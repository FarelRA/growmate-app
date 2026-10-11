/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { ingestAndAckSensorData } from '../../convex/sensors'
import {
  stageDeviceConfig, stageDeviceClaim, stageDeviceOta, queueDeviceCommand,
} from '../../convex/admin/devices'
import type { DeviceDoc } from '../../convex/types'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()
const TEST_DEVICE_KEY = 'test-device-key'

beforeEach(() => {
  process.env.DEVICE_API_KEY = TEST_DEVICE_KEY
})

function podsEnvelope(overrides: Record<string, any> = {}) {
  return {
    deviceKey: TEST_DEVICE_KEY,
    deviceId: 'IAET01',
    hardwareId: '7C87CE1A2B3C',
    firmwareVersion: '2.0.0',
    snapshotId: 'B1-1',
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
    currentState: { pumpEnabled: false, lightEnabled: false },
    health: {
      heapFree: 81234, rssi: -61, uptimeS: 86412, bootCount: 12,
      resetReason: 'power-on', dhtFails: 1, adcFails: 0,
    },
    ...overrides,
  }
}

function techEnvelope(overrides: Record<string, any> = {}) {
  return {
    ...podsEnvelope(),
    deviceId: 'IAFU01',
    variant: 'tech',
    snapshotId: 'B2-1',
    sensors: [
      { kind: 'soil', unit: '%', raw: 16000 },
      { kind: 'current', unit: 'raw', raw: 20070 },
      { kind: 'temperature', unit: 'C', value: 24.6 },
    ],
    currentState: {
      pumpEnabled: false, lightEnabled: false,
      fertilizerEnabled: false, pesticideEnabled: false,
      batteryCurrent: null, streaming: false, streamFps: 0,
    },
    ...overrides,
  }
}

async function seedPods(ctx: FakeCtx, overrides: Record<string, any> = {}) {
  const deviceId = await ctx.db.insert('devices', {
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
    lastSeen: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as unknown as DeviceDoc)
  return deviceId
}

describe('firmware envelope ingest (pods)', () => {
  it('stores identity, sample time, health, and all five sensor kinds', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    const before = Date.now()
    const res: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())

    expect(res.commands).toEqual([])
    expect(res.config).toBeUndefined()
    expect(res.claim).toBeUndefined()

    const device = ctx.db.all('devices')[0] as any
    expect(device.hardwareId).toBe('7C87CE1A2B3C')
    expect(device.firmwareVersion).toBe('2.0.0')
    expect(device.lastSnapshotId).toBe('B1-1')
    expect(device.lastRssi).toBe(-61)
    expect(device.lastBootCount).toBe(12)
    expect(device.lastResetReason).toBe('power-on')
    expect(device.reportedPumpEnabled).toBe(false)
    // sampleTime = receivedAt - ageMs
    expect(device.lastSampleAt).toBeLessThanOrEqual(before)
    expect(before - device.lastSampleAt).toBeLessThanOrEqual(1800 + 2000)

    const readings = ctx.db.all('sensorReadings')
    expect(readings).toHaveLength(5)
    const soil = readings.find((r) => r.kind === 'soil')
    expect(soil.measuredAt).toBe(device.lastSampleAt)
    expect(soil.raw).toBe(2048)
  })

  it('dedups on snapshotId: no double-count, commands still served', async () => {
    const ctx = createFakeCtx()
    const deviceId = await seedPods(ctx)
    await queueDeviceCommand(ctx, {
      deviceId: 'IAET01', kind: 'pump', durationMs: 5000,
    })

    const first: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())
    expect(first.commands).toHaveLength(1)
    expect(ctx.db.all('sensorReadings')).toHaveLength(5)

    const second: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())
    expect(ctx.db.all('sensorReadings')).toHaveLength(5)
    // Still-queued pump is redelivered on the duplicate too.
    expect(second.commands).toHaveLength(1)
    expect(second.commands[0].id).toBe(first.commands[0].id)
    expect(await ctx.db.get(deviceId)).toBeTruthy()
  })

  it('redelivers queued commands until acked via acceptedCommandIds', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    await queueDeviceCommand(ctx, {
      deviceId: 'IAET01', kind: 'pump', durationMs: 5000,
    })

    const first: any = await callHandler(
      ingestAndAckSensorData, ctx, podsEnvelope({ snapshotId: 'B1-1' }),
    )
    const id = first.commands[0].id
    expect(typeof id).toBe('string')

    const redelivered: any = await callHandler(
      ingestAndAckSensorData, ctx, podsEnvelope({ snapshotId: 'B1-2' }),
    )
    expect(redelivered.commands.map((c: any) => c.id)).toContain(id)

    const acked: any = await callHandler(
      ingestAndAckSensorData,
      ctx,
      podsEnvelope({ snapshotId: 'B1-3', acceptedCommandIds: [id] }),
    )
    expect(acked.commands).toEqual([])
  })

  it('pump XOR light: pods never receive both in one response', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    await queueDeviceCommand(ctx, {
      deviceId: 'IAET01', kind: 'pump', durationMs: 5000,
    })
    await queueDeviceCommand(ctx, {
      deviceId: 'IAET01', kind: 'light', enabled: true,
    })

    const res: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())
    expect(res.commands).toHaveLength(1)
    expect(res.commands[0].kind).toBe('pump')

    const stored = ctx.db.all('devices')[0] as any
    expect(stored.queuedCommands.light).not.toBeNull()
  })

  it('config push rides the response until appliedConfigRev advances', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    const staged: any = await stageDeviceConfig(ctx, {
      deviceId: 'IAET01', reportIntervalSec: 30,
    })
    expect(staged.rev).toBe(1)

    const first: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())
    expect(first.config).toEqual({ rev: 1, reportIntervalSec: 30 })

    const second: any = await callHandler(
      ingestAndAckSensorData, ctx, podsEnvelope({ snapshotId: 'B1-2', appliedConfigRev: 1 }),
    )
    expect(second.config).toBeUndefined()
  })

  it('claim rename: staged claim is served, then history follows the new id', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    await stageDeviceClaim(ctx, { deviceId: 'IAET01', claimDeviceId: 'IAET99' })

    const first: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())
    expect(first.claim).toEqual({ deviceId: 'IAET99' })

    const second: any = await callHandler(
      ingestAndAckSensorData,
      ctx,
      podsEnvelope({ deviceId: 'IAET99', snapshotId: 'B1-2' }),
    )
    expect(second.claim).toBeUndefined()
    const devices = ctx.db.all('devices')
    expect(devices).toHaveLength(1)
    expect(devices[0].deviceId).toBe('IAET99')
    expect(devices[0].hardwareId).toBe('7C87CE1A2B3C')
  })

  it('OTA offer rides the response verbatim', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    await stageDeviceOta(ctx, {
      deviceId: 'IAET01', minFirmware: '2.1.0', firmwareUrl: 'https://x/y.bin',
    })
    const res: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())
    expect(res.minFirmware).toBe('2.1.0')
    expect(res.firmwareUrl).toBe('https://x/y.bin')
  })
})

describe('firmware envelope ingest (tech)', () => {
  it('variant auto-provisions a v2 device and converts the current leg', async () => {
    const ctx = createFakeCtx()
    const res: any = await callHandler(ingestAndAckSensorData, ctx, techEnvelope())
    expect(res.commands).toEqual([])

    const device = ctx.db.all('devices')[0] as any
    expect(device.version).toBe('v2')
    expect(device.variant).toBe('tech')

    const current = ctx.db.all('sensorReadings').find((r) => r.kind === 'current')
    expect(current).toBeTruthy()
    expect(current.unit).toBe('mA')
    expect(current.raw).toBe(20070)
    // volt=20070/32767*4.096≈2.51V → amps≈(2.5-2.51)/0.066 small negative (using)
    expect(current.value).toBeLessThan(0)
    expect(device.batteryCurrent).toBe(current.value)
    expect(typeof device.batterySoC).toBe('number')
  })

  it('tech accepts empty sensors[] without 400', async () => {
    const ctx = createFakeCtx()
    const res: any = await callHandler(
      ingestAndAckSensorData, ctx, techEnvelope({ sensors: [] }),
    )
    expect(res.commands).toEqual([])
  })
})

describe('operator staging validation', () => {
  it('rejects out-of-range intervals, bad claims, and non-https OTA', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    await expect(
      stageDeviceConfig(ctx, { deviceId: 'IAET01', reportIntervalSec: 5 }),
    ).rejects.toThrow()
    await expect(
      stageDeviceClaim(ctx, { deviceId: 'IAET01', claimDeviceId: 'bad id!' }),
    ).rejects.toThrow()
    await expect(
      stageDeviceOta(ctx, {
        deviceId: 'IAET01', minFirmware: '2.1.0', firmwareUrl: 'http://x/y.bin',
      }),
    ).rejects.toThrow()
    await expect(
      queueDeviceCommand(ctx, { deviceId: 'IAET01', kind: 'pump', durationMs: 99999 }),
    ).rejects.toThrow()
  })

  it('queues video_start with validated params', async () => {
    const ctx = createFakeCtx()
    await seedPods(ctx)
    const res: any = await queueDeviceCommand(ctx, {
      deviceId: 'IAET01', kind: 'video_start',
      width: 640, height: 480, fps: 5, quality: 70, maxSec: 300,
    })
    expect(res.queued).toMatchObject({ kind: 'video_start', width: 640, id: expect.any(String) })

    const ingest: any = await callHandler(ingestAndAckSensorData, ctx, podsEnvelope())
    expect(ingest.commands.map((c: any) => c.kind)).toContain('video_start')
  })
})
