/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { MAX_SENSORS_PER_POST } from '../../convex/types'
import {
  SENSOR_EVENT_COOLDOWN_MS,
  isDeviceOnlyEventType,
  shouldSkipSensorRecordedEvent,
  recordGrowEvent,
  recordPlantImage,
} from '../../convex/helpers/events'

function mockCtx() {
  return { db: { insert: vi.fn(async () => 'inserted-id' as any) } } as any
}

describe('sensor ingest cap', () => {
  it('caps sensors per POST at 8', () => {
    expect(MAX_SENSORS_PER_POST).toBe(8)
  })
})

describe('sensor_recorded debounce', () => {
  it('uses a 5-minute cooldown', () => {
    expect(SENSOR_EVENT_COOLDOWN_MS).toBe(5 * 60 * 1000)
  })

  it('skips repeat sensor_recorded for the same kind within cooldown', () => {
    const now = 1_000_000
    const recent = [
      { eventType: 'sensor_recorded', timestamp: now - 60_000, data: { kind: 'soil', value: 40 } },
    ]
    expect(shouldSkipSensorRecordedEvent(recent, 'soil', now)).toBe(true)
  })

  it('does not skip a different kind within cooldown', () => {
    const now = 1_000_000
    const recent = [
      { eventType: 'sensor_recorded', timestamp: now - 60_000, data: { kind: 'soil', value: 40 } },
    ]
    expect(shouldSkipSensorRecordedEvent(recent, 'light', now)).toBe(false)
  })

  it('does not skip after the cooldown expires', () => {
    const now = 1_000_000
    const recent = [
      { eventType: 'sensor_recorded', timestamp: now - SENSOR_EVENT_COOLDOWN_MS - 1, data: { kind: 'soil', value: 40 } },
    ]
    expect(shouldSkipSensorRecordedEvent(recent, 'soil', now)).toBe(false)
  })

  it('ignores non-sensor events and events without kind data', () => {
    const now = 1_000_000
    const recent = [
      { eventType: 'automation_action_executed', timestamp: now - 1_000, data: { kind: 'soil' } },
      { eventType: 'sensor_recorded', timestamp: now - 1_000 },
    ]
    expect(shouldSkipSensorRecordedEvent(recent, 'soil', now)).toBe(false)
  })

  it('does not skip when there are no recent events', () => {
    expect(shouldSkipSensorRecordedEvent([], 'soil', 1_000_000)).toBe(false)
  })
})

describe('recordGrowEvent validation', () => {
  it('rejects events without deviceId', async () => {
    const ctx = mockCtx()
    await expect(
      recordGrowEvent(ctx, {
        plantId: 'plant1' as any,
        source: 'device',
        entityType: 'sensor',
        eventType: 'sensor_recorded',
        title: 't',
        timestamp: 1,
      }),
    ).rejects.toThrow()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it('rejects plant-scoped kinds without plantId', async () => {
    const ctx = mockCtx()
    await expect(
      recordGrowEvent(ctx, {
        deviceId: 'device1' as any,
        source: 'device',
        entityType: 'sensor',
        eventType: 'sensor_recorded',
        title: 't',
        timestamp: 1,
      }),
    ).rejects.toThrow()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it('allows device-only kinds without plantId', async () => {
    for (const eventType of [
      'device_claimed',
      'device_unclaimed',
      'stream_registered',
      'automation_settings_updated',
    ] as const) {
      expect(isDeviceOnlyEventType(eventType)).toBe(true)
      const ctx = mockCtx()
      await recordGrowEvent(ctx, {
        deviceId: 'device1' as any,
        source: 'device',
        entityType: 'device',
        eventType,
        title: 't',
        timestamp: 1,
      })
      expect(ctx.db.insert).toHaveBeenCalledTimes(1)
    }
  })

  it('records plant-scoped kinds when plantId is present', async () => {
    const ctx = mockCtx()
    await recordGrowEvent(ctx, {
      deviceId: 'device1' as any,
      plantId: 'plant1' as any,
      source: 'device',
      entityType: 'sensor',
      eventType: 'sensor_recorded',
      title: 't',
      timestamp: 1,
    })
    expect(ctx.db.insert).toHaveBeenCalledTimes(1)
  })
})

describe('recordPlantImage validation', () => {
  it('rejects images without deviceId', async () => {
    const ctx = mockCtx()
    await expect(
      recordPlantImage(ctx, {
        deviceId: undefined as any,
        plantId: 'plant1' as any,
        imageUrl: 'https://example.com/img.jpg',
        source: 'camera',
        capturedAt: 1,
      }),
    ).rejects.toThrow()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it('rejects images without imageUrl', async () => {
    const ctx = mockCtx()
    await expect(
      recordPlantImage(ctx, {
        deviceId: 'device1' as any,
        imageUrl: '  ',
        source: 'camera',
        capturedAt: 1,
      }),
    ).rejects.toThrow()
    expect(ctx.db.insert).not.toHaveBeenCalled()
  })

  it('allows device-only images without plantId', async () => {
    const ctx = mockCtx()
    await recordPlantImage(ctx, {
      deviceId: 'device1' as any,
      imageUrl: 'https://example.com/img.jpg',
      source: 'camera',
      capturedAt: 1,
    })
    expect(ctx.db.insert).toHaveBeenCalledTimes(1)
  })
})
