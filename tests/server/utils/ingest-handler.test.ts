/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validateSensors, normalizeSensors } from '~~/server/utils/ingestHandler'
import { MAX_SENSORS_PER_POST } from '~~/convex/types'

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

function sensor(kind: string, value: number, extra: Record<string, unknown> = {}) {
  return { kind, value, unit: kind === 'temperature' ? 'C' : '%', ...extra }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.readBody = vi.fn() as any
})

describe('validateSensors shared validator', () => {
  it('rejects more than 8 sensors with 400', () => {
    expect(MAX_SENSORS_PER_POST).toBe(8)
    const sensors = Array.from({ length: 9 }, (_, i) => sensor('soil', 50 + (i % 2)))
    expect(() => validateSensors(sensors, 'v1')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
    expect(() => validateSensors(sensors, 'v2')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('accepts exactly 8 sensors', () => {
    const sensors = Array.from({ length: 8 }, () => sensor('soil', 50))
    expect(() => validateSensors(sensors, 'v1')).not.toThrow()
    expect(() => validateSensors(sensors, 'v2')).not.toThrow()
  })

  it('v1 clamps temperature to 0-100 like other sensors', () => {
    expect(() => validateSensors([sensor('temperature', 120)], 'v1')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
    expect(() => validateSensors([sensor('temperature', 25)], 'v1')).not.toThrow()
  })

  it('v2 allows temperature between -40 and 125', () => {
    expect(() => validateSensors([sensor('temperature', 120)], 'v2')).not.toThrow()
    expect(() => validateSensors([sensor('temperature', -40)], 'v2')).not.toThrow()
    expect(() => validateSensors([sensor('temperature', 130)], 'v2')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
    expect(() => validateSensors([sensor('temperature', -50)], 'v2')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('v1 caps raw values at 4095', () => {
    expect(() => validateSensors([sensor('soil', 50, { raw: 4095 })], 'v1')).not.toThrow()
    expect(() => validateSensors([sensor('soil', 50, { raw: 4096 })], 'v1')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('v2 caps raw values at 65535', () => {
    expect(() => validateSensors([sensor('soil', 50, { raw: 5000 })], 'v2')).not.toThrow()
    expect(() => validateSensors([sensor('soil', 50, { raw: 65535 })], 'v2')).not.toThrow()
    expect(() => validateSensors([sensor('soil', 50, { raw: 65536 })], 'v2')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('requires kind, value, and unit', () => {
    expect(() => validateSensors([{ kind: '', value: 1, unit: '%' }], 'v1')).toThrowError(
      expect.objectContaining({ statusCode: 400 }),
    )
  })
})

describe('normalizeSensors', () => {
  it('wraps a single reading when sensors array is absent', () => {
    const out = normalizeSensors({ kind: 'soil', value: 10, unit: '%', raw: 5 } as any)
    expect(out).toEqual([{ kind: 'soil', value: 10, unit: '%', raw: 5 }])
  })

  it('passes through the sensors array', () => {
    const body = { sensors: [sensor('soil', 10)] }
    expect(normalizeSensors(body as any)).toEqual(body.sensors)
  })
})

describe('handleSensorIngest', () => {
  it('ingests and acks in a single mutation (no separate clear call)', async () => {
    const { default: handleSensorIngest } = await import(HANDLER_SRC)
    process.env.DEVICE_API_KEY = 'test-key'
    mockMutation.mockResolvedValue({
      success: true,
      updated: 2,
      commands: [{ kind: 'pump', durationMs: 8000 }],
    })
    const event = mockEvent()
    event.headers.set('x-api-key', 'test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-1',
      sensors: [sensor('soil', 20), sensor('water', 80)],
    })

    const result = await handleSensorIngest(event, 'v2')
    expect(result).toEqual({
      success: true,
      updated: 2,
      commands: [{ kind: 'pump', durationMs: 8000 }],
    })
    expect(mockMutation).toHaveBeenCalledTimes(1)
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({ deviceId: 'dev-1' }),
    )
  })

  it('rejects over-cap payloads with 400 before touching Convex', async () => {
    const { default: handleSensorIngest } = await import(HANDLER_SRC)
    process.env.DEVICE_API_KEY = 'test-key'
    const event = mockEvent()
    event.headers.set('x-api-key', 'test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-1',
      sensors: Array.from({ length: 9 }, () => sensor('soil', 50)),
    })

    await expect(handleSensorIngest(event, 'v1')).rejects.toMatchObject({ statusCode: 400 })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('keeps v1 and v2 raw validation branched', async () => {
    const { default: handleSensorIngest } = await import(HANDLER_SRC)
    process.env.DEVICE_API_KEY = 'test-key'
    mockMutation.mockResolvedValue({ success: true, updated: 1, commands: [] })

    const v1Event = mockEvent()
    v1Event.headers.set('x-api-key', 'test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-1',
      sensors: [sensor('soil', 50, { raw: 5000 })],
    })
    await expect(handleSensorIngest(v1Event, 'v1')).rejects.toMatchObject({ statusCode: 400 })

    const v2Event = mockEvent()
    v2Event.headers.set('x-api-key', 'test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-1',
      sensors: [sensor('soil', 50, { raw: 5000 })],
    })
    const result = await handleSensorIngest(v2Event, 'v2')
    expect(result.success).toBe(true)
  })
})
