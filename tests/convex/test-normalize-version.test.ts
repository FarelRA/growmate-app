/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { normalizeRawSensorValue, V1_ADC_RAW_MAX } from '../../convex/helpers/generic'
import { ADC_RAW_MAX } from '../../convex/types'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import { ingestAndAckSensorData } from '../../convex/sensors'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const now = Date.now()
const TEST_DEVICE_KEY = 'test-device-key'

beforeEach(() => {
  process.env.DEVICE_API_KEY = TEST_DEVICE_KEY
})

function seedDeviceWithVersion(ctx: FakeCtx, version: 'v1' | 'v2') {
  return ctx.db.insert('devices', {
    deviceId: `GM-${version.toUpperCase()}`,
    name: `Test Pod ${version}`,
    version,
    autoWatering: false,
    autoLighting: false,
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
  })
}

describe('normalizeRawSensorValue per-version scaling (P1: v1 12-bit vs v2 16-bit)', () => {
  it('v1 full-scale dry reading 4095 maps to 0% (not 94%)', () => {
    expect(V1_ADC_RAW_MAX).toBe(4095)
    expect(normalizeRawSensorValue('soil', 4095, 'v1')).toBe(0)
    expect(normalizeRawSensorValue('light', 4095, 'v1')).toBe(0)
  })

  it('v1 full-scale maps directly for water (4095 -> 100%)', () => {
    expect(normalizeRawSensorValue('water', 4095, 'v1')).toBe(100)
    expect(normalizeRawSensorValue('water', 0, 'v1')).toBe(0)
  })

  it('v1 zero maps to 100% for inverted kinds', () => {
    expect(normalizeRawSensorValue('soil', 0, 'v1')).toBe(100)
    expect(normalizeRawSensorValue('light', 0, 'v1')).toBe(100)
  })

  it('v1 mid-scale maps to ~50%', () => {
    expect(normalizeRawSensorValue('soil', 2048, 'v1')).toBe(50)
    expect(normalizeRawSensorValue('water', 2048, 'v1')).toBe(50)
  })

  it('v2 keeps the 16-bit mapping (65535 full-scale)', () => {
    expect(ADC_RAW_MAX).toBe(65535)
    expect(normalizeRawSensorValue('soil', 65535, 'v2')).toBe(0)
    expect(normalizeRawSensorValue('soil', 0, 'v2')).toBe(100)
    expect(normalizeRawSensorValue('water', 65535, 'v2')).toBe(100)
    expect(normalizeRawSensorValue('water', 0, 'v2')).toBe(0)
    expect(normalizeRawSensorValue('soil', Math.round(ADC_RAW_MAX / 2), 'v2')).toBe(50)
  })

  it('regression: the old always-16-bit bug read v1 dry as 94%', () => {
    // A v1 dry reading scaled against the v2 range is the reported bug.
    expect(normalizeRawSensorValue('soil', 4095, 'v2')).toBe(94)
    // Correct per-version scaling must not reproduce it.
    expect(normalizeRawSensorValue('soil', 4095, 'v1')).not.toBe(94)
    expect(normalizeRawSensorValue('soil', 4095, 'v1')).toBe(0)
  })

  it('clamps below min to the min edge per version', () => {
    expect(normalizeRawSensorValue('soil', -100, 'v1')).toBe(100)
    expect(normalizeRawSensorValue('soil', -100, 'v2')).toBe(100)
    expect(normalizeRawSensorValue('water', -1, 'v1')).toBe(0)
    expect(normalizeRawSensorValue('water', -1, 'v2')).toBe(0)
  })

  it('clamps above max to the max edge per version', () => {
    // v1 ceiling is 4095: anything above is full-scale dry/empty.
    expect(normalizeRawSensorValue('soil', 5000, 'v1')).toBe(0)
    expect(normalizeRawSensorValue('light', 99999, 'v1')).toBe(0)
    expect(normalizeRawSensorValue('water', 5000, 'v1')).toBe(100)
    // v2 ceiling is 65535.
    expect(normalizeRawSensorValue('soil', 70000, 'v2')).toBe(0)
    expect(normalizeRawSensorValue('water', 70000, 'v2')).toBe(100)
    // Same raw, different version, different result (scale matters).
    expect(normalizeRawSensorValue('soil', 5000, 'v2')).toBe(92)
  })

  it('passes temperature/air raw values through untouched on both versions', () => {
    expect(normalizeRawSensorValue('temperature', 2500, 'v1')).toBe(2500)
    expect(normalizeRawSensorValue('temperature', 2500, 'v2')).toBe(2500)
    expect(normalizeRawSensorValue('air', 1800, 'v1')).toBe(1800)
    expect(normalizeRawSensorValue('air', 1800, 'v2')).toBe(1800)
  })
})

describe('ingest threads device.version into normalization (no fallback)', () => {
  let ctx: FakeCtx
  beforeEach(() => {
    ctx = createFakeCtx()
  })

  it('v1 device: raw soil 4095 stores 0%', async () => {
    await seedDeviceWithVersion(ctx, 'v1')
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-V1',
      sensors: [{ kind: 'soil', value: 50, unit: '%', raw: 4095 }],
    })
    expect(res.success).toBe(true)
    const stored = ctx.db.all('sensors').find((s) => s.kind === 'soil')
    expect(stored!.value).toBe(0)
  })

  it('v2 device: raw soil 4095 stores 94% (16-bit scale)', async () => {
    await seedDeviceWithVersion(ctx, 'v2')
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-V2',
      sensors: [{ kind: 'soil', value: 50, unit: '%', raw: 4095 }],
    })
    expect(res.success).toBe(true)
    const stored = ctx.db.all('sensors').find((s) => s.kind === 'soil')
    expect(stored!.value).toBe(94)
  })

  it('validate at boundary: unknown device version is rejected', async () => {
    const deviceId = await seedDeviceWithVersion(ctx, 'v1')
    await ctx.db.patch(deviceId, { version: 'v3' })
    await expect(
      callHandler(ingestAndAckSensorData, ctx, {
        deviceKey: TEST_DEVICE_KEY,
        deviceId: 'GM-V1',
        sensors: [{ kind: 'soil', value: 50, unit: '%', raw: 100 }],
      }),
    ).rejects.toThrow('Unknown device version')
  })
})

describe('every normalizeRawSensorValue caller passes an explicit scale', () => {
  const sensorsSrc = readFileSync(new URL('../../convex/sensors.ts', import.meta.url), 'utf8')
  const genericSrc = readFileSync(
    new URL('../../convex/helpers/generic.ts', import.meta.url),
    'utf8',
  )

  it('convex helper requires the version param (no default)', () => {
    const def = genericSrc.match(/export function normalizeRawSensorValue\(([^)]*)\)/)
    expect(def).not.toBeNull()
    const params = def![1]
    expect(params).toContain('version')
    // Required third param: no `=` default on any parameter.
    expect(params).not.toContain('=')
    expect(params.split(',')).toHaveLength(3)
  })

  it('all call sites in convex/sensors.ts pass device.version explicitly', () => {
    const calls = [...sensorsSrc.matchAll(/normalizeRawSensorValue\(([^)]*)\)/g)]
    expect(calls.length).toBeGreaterThan(0)
    for (const [, args] of calls) {
      expect(args.split(',')).toHaveLength(3)
      expect(args).toMatch(/device\.version|version|'(v1|v2)'|rawMax/i)
    }
    // No silent fallback in the normalize path.
    const callLines = sensorsSrc
      .split('\n')
      .filter((line) => line.includes('normalizeRawSensorValue('))
    for (const line of callLines) {
      expect(line).not.toMatch(/\?\?/)
    }
  })
})
