/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateDeviceEnvelope } from '~~/server/utils/deviceProtocol'

const HANDLER_SRC = '~~/server/utils/ingestHandler'

const mockMutation = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    sensors: {
      ingestAndAckSensorData: 'ingestAndAckSensorData',
    },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    mutation: mockMutation,
  }),
}))

function mockEvent() {
  return { headers: new Headers() }
}

function bearerEvent(key: string, deviceId = 'dev-1') {
  const event = mockEvent()
  event.headers.set('authorization', `Bearer ${key}`)
  event.headers.set('x-device-id', deviceId)
  return event
}

function soilEntry(raw: number) {
  return { kind: 'soil', unit: '%', raw }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.readBody = vi.fn() as any
})

describe('validateDeviceEnvelope firmware contract', () => {
  it('rejects unknown sensor kinds with 400', () => {
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'dev-1',
        sensors: [{ kind: 'humidity', unit: '%', raw: 10 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects analog entries missing raw with 400', () => {
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'dev-1',
        sensors: [{ kind: 'soil', unit: '%', value: 50 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects out-of-range raw values with 400', () => {
    expect(() =>
      validateDeviceEnvelope({ deviceId: 'dev-1', sensors: [soilEntry(5000)] }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
    expect(() =>
      validateDeviceEnvelope({ deviceId: 'dev-1', sensors: [soilEntry(-1)] }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('accepts empty sensors[]', () => {
    const envelope = validateDeviceEnvelope({ deviceId: 'dev-1', sensors: [] })
    expect(envelope.sensors).toEqual([])
  })

  it('rejects more than 8 sensors with 400', () => {
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'dev-1',
        sensors: Array.from({ length: 9 }, () => soilEntry(50)),
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects envelopes missing deviceId with 400', () => {
    expect(() => validateDeviceEnvelope({ sensors: [soilEntry(50)] })).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
    expect(() =>
      validateDeviceEnvelope({ deviceId: '  ', sensors: [soilEntry(50)] }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('accepts tech raw values up to 32767 with variant tech', () => {
    const envelope = validateDeviceEnvelope({
      deviceId: 'dev-1',
      variant: 'tech',
      sensors: [{ kind: 'soil', unit: '%', raw: 20070 }],
    })
    expect(envelope.sensors).toHaveLength(1)
  })

  it('accepts variant tech-addon with the tech raw ceiling', () => {
    const envelope = validateDeviceEnvelope({
      deviceId: 'dev-1',
      variant: 'tech-addon',
      sensors: [{ kind: 'soil', unit: '%', raw: 32767 }],
    })
    expect(envelope.variant).toBe('tech-addon')
  })

  it('rejects unknown variants (closed tech | tech-addon union)', () => {
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'dev-1',
        variant: 'experimental',
        sensors: [{ kind: 'soil', unit: '%', raw: 100 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'dev-1',
        variant: 42,
        sensors: [{ kind: 'soil', unit: '%', raw: 100 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects analog entries carrying value (RAW-only per firmware sensor_array_add_raw)', () => {
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'dev-1',
        sensors: [{ kind: 'soil', unit: '%', raw: 100, value: 50 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects DHT entries carrying raw (sensor_array_add_dht sends value-only)', () => {
    expect(() =>
      validateDeviceEnvelope({
        deviceId: 'dev-1',
        sensors: [{ kind: 'temperature', unit: 'C', value: 24.5, raw: 100 }],
      }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('rejects float ageMs (both firmwares send ints)', () => {
    expect(() =>
      validateDeviceEnvelope({ deviceId: 'dev-1', ageMs: 12.5, sensors: [] }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
    const envelope = validateDeviceEnvelope({ deviceId: 'dev-1', ageMs: 1000, sensors: [] })
    expect(envelope.ageMs).toBe(1000)
  })
})

describe('handleSensorIngest', () => {
  it('ingests and returns the firmware response verbatim (no success/updated fields)', async () => {
    const { default: handleSensorIngest } = await import(HANDLER_SRC)
    process.env.DEVICE_API_KEY = 'test-key'
    const firmwareResponse = { commands: [{ id: 'cmd-1', kind: 'pump', durationMs: 8000 }] }
    mockMutation.mockResolvedValue(firmwareResponse)
    const event = bearerEvent('test-key')
    const body = {
      deviceId: 'dev-1',
      firmwareVersion: '1.2.3',
      hardwareId: 'AA1122334455',
      variant: 'tech',
      snapshotId: 'B1-1',
      ageMs: 1000,
      appliedConfigRev: 2,
      acceptedCommandIds: ['cmd-0'],
      currentState: { pumpEnabled: false, lightEnabled: false },
      health: { rssi: -61 },
      sensors: [soilEntry(20), { kind: 'temperature', unit: 'C', value: 24.5 }],
    }
    vi.mocked(globalThis.readBody).mockResolvedValue(body)

    const result = await handleSensorIngest(event)
    expect(result).toEqual(firmwareResponse)
    expect(mockMutation).toHaveBeenCalledTimes(1)
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({
        deviceId: 'dev-1',
        firmwareVersion: '1.2.3',
        hardwareId: 'AA1122334455',
        variant: 'tech',
        snapshotId: 'B1-1',
        ageMs: 1000,
        appliedConfigRev: 2,
        acceptedCommandIds: ['cmd-0'],
        currentState: { pumpEnabled: false, lightEnabled: false },
        health: { rssi: -61 },
        deviceKey: 'test-key',
      }),
    )
  })

  it('rejects over-cap payloads with 400 before touching Convex', async () => {
    const { default: handleSensorIngest } = await import(HANDLER_SRC)
    process.env.DEVICE_API_KEY = 'test-key'
    const event = bearerEvent('test-key', 'dev-over-cap')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-over-cap',
      sensors: Array.from({ length: 9 }, () => soilEntry(50)),
    })

    await expect(handleSensorIngest(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('rejects pods raw above 4095 but accepts tech raw 20070 with variant tech', async () => {
    const { default: handleSensorIngest } = await import(HANDLER_SRC)
    process.env.DEVICE_API_KEY = 'test-key'
    mockMutation.mockResolvedValue({ commands: [] })

    const podsEvent = bearerEvent('test-key', 'dev-pods')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-pods',
      sensors: [soilEntry(5000)],
    })
    await expect(handleSensorIngest(podsEvent)).rejects.toMatchObject({ statusCode: 400 })

    const techEvent = bearerEvent('test-key', 'dev-tech')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-tech',
      variant: 'tech',
      sensors: [{ kind: 'soil', unit: '%', raw: 20070 }],
    })
    const result = await handleSensorIngest(techEvent)
    expect(result).toEqual({ commands: [] })
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({ deviceId: 'dev-tech', variant: 'tech' }),
    )
  })
})
