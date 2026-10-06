/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  ingestAndAckSensorData,
  clearDeviceCommands,
  ingestCameraImage,
} from '../../convex/sensors'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const TEST_DEVICE_KEY = 'test-device-key'
const savedEnv = process.env.DEVICE_API_KEY

const mutationCases: { name: string; fn: any; args: Record<string, any> }[] = [
  {
    name: 'ingestAndAckSensorData',
    fn: ingestAndAckSensorData,
    args: { deviceId: 'GM-AUTH', sensors: [{ kind: 'soil', value: 50, unit: '%' }] },
  },
  {
    name: 'clearDeviceCommands',
    fn: clearDeviceCommands,
    args: { deviceId: 'GM-AUTH', commands: ['pump'] },
  },
  {
    name: 'ingestCameraImage',
    fn: ingestCameraImage,
    args: { deviceId: 'GM-AUTH', imageUrl: 'https://example.com/img.jpg' },
  },
]

describe('sensors deviceKey auth', () => {
  let ctx: FakeCtx
  beforeEach(() => {
    ctx = createFakeCtx()
    process.env.DEVICE_API_KEY = TEST_DEVICE_KEY
  })
  afterEach(() => {
    if (savedEnv === undefined) delete process.env.DEVICE_API_KEY
    else process.env.DEVICE_API_KEY = savedEnv
  })

  for (const { name, fn, args } of mutationCases) {
    it(`${name} rejects when deviceKey is missing`, async () => {
      await expect(callHandler(fn, ctx, { ...args })).rejects.toThrow('Unauthorized')
    })

    it(`${name} rejects a wrong deviceKey`, async () => {
      await expect(
        callHandler(fn, ctx, { ...args, deviceKey: 'wrong-key' }),
      ).rejects.toThrow('Unauthorized')
    })

    it(`${name} fails closed when DEVICE_API_KEY is unset`, async () => {
      delete process.env.DEVICE_API_KEY
      await expect(
        callHandler(fn, ctx, { ...args, deviceKey: TEST_DEVICE_KEY }),
      ).rejects.toThrow('server misconfigured')
    })

    it(`${name} fails closed when DEVICE_API_KEY is empty`, async () => {
      process.env.DEVICE_API_KEY = ''
      await expect(
        callHandler(fn, ctx, { ...args, deviceKey: TEST_DEVICE_KEY }),
      ).rejects.toThrow('server misconfigured')
    })
  }

  it('ingestAndAckSensorData with key performs ingest identically', async () => {
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-AUTH',
      sensors: [{ kind: 'soil', value: 50, unit: '%' }],
    })
    expect(res.success).toBe(true)
    expect(res.updated).toBe(1)
    expect(ctx.db.all('sensors')).toHaveLength(1)
    expect(ctx.db.all('sensorReadings')).toHaveLength(1)
  })

  it('ingestAndAckSensorData with key acks queued commands', async () => {
    const res = await callHandler(ingestAndAckSensorData, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-AUTH',
      sensors: [{ kind: 'soil', value: 50, unit: '%' }],
    })
    expect(res.success).toBe(true)
    expect(res.updated).toBe(1)
  })

  it('clearDeviceCommands with key keeps identical semantics', async () => {
    await ctx.db.insert('devices', {
      deviceId: 'GM-AUTH',
      name: 'Auth Pod',
      queuedCommands: {
        pump: { kind: 'pump', durationMs: 8000 },
        light: null,
        fertilizer: null,
        pesticide: null,
      },
    })
    const res = await callHandler(clearDeviceCommands, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-AUTH',
      commands: ['pump'],
    })
    expect(res).toEqual({ success: true, cleared: true })
    const device = ctx.db.all('devices').find((d) => d.deviceId === 'GM-AUTH')!
    expect(device.queuedCommands.pump).toBeNull()
  })

  it('ingestCameraImage with key records the image', async () => {
    const res = await callHandler(ingestCameraImage, ctx, {
      deviceKey: TEST_DEVICE_KEY,
      deviceId: 'GM-AUTH',
      imageUrl: 'https://example.com/img.jpg',
    })
    expect(res).toEqual({ success: true, imageUrl: 'https://example.com/img.jpg' })
    expect(ctx.db.all('plantImages')).toHaveLength(1)
  })
})
