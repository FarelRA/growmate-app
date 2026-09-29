/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SRC = '../../../../server/api/v1/sensors.post'

const mockMutation = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    sensors: {
      ingestSensorData: 'ingestSensorData',
      ingestAndAckSensorData: 'ingestAndAckSensorData',
      clearDeviceCommands: 'clearDeviceCommands',
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

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.readBody = vi.fn() as any
})

describe('POST /api/v1/sensors', () => {
  it('keeps the identical response shape via the shared handler', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    mockMutation.mockResolvedValue({ success: true, updated: 3, commands: [] })
    const handler = (await import(SRC)).default
    const event = mockEvent()
    event.headers.set('x-api-key', 'test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test-device',
      sensors: [
        { kind: 'soil', value: 45, unit: '%', raw: 1234 },
        { kind: 'light', value: 60, unit: '%', raw: 3000 },
        { kind: 'water', value: 80, unit: '%', raw: 2500 },
      ],
    })

    const result = await handler(event)
    expect(result).toEqual({ success: true, updated: 3, commands: [] })
    expect(mockMutation).toHaveBeenCalledTimes(1)
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({ deviceId: 'test-device' }),
    )
  })

  it('rejects over-cap payloads with 400', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const handler = (await import(SRC)).default
    const event = mockEvent()
    event.headers.set('x-api-key', 'test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test-device',
      sensors: Array.from({ length: 9 }, () => ({ kind: 'soil', value: 50, unit: '%' })),
    })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('keeps the v1 raw ceiling at 4095', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const handler = (await import(SRC)).default
    const event = mockEvent()
    event.headers.set('x-api-key', 'test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test-device',
      sensors: [{ kind: 'soil', value: 50, unit: '%', raw: 5000 }],
    })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
    expect(mockMutation).not.toHaveBeenCalled()
  })
})
