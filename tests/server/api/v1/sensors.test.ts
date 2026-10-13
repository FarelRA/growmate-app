/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SRC = '../../../../server/routes/v1/sensors.post'

const mockMutation = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    sensors: {
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

function bearerEvent(key: string) {
  const event = mockEvent()
  event.headers.set('authorization', `Bearer ${key}`)
  return event
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
  it('returns the firmware response shape verbatim via the shared handler', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const firmwareResponse = { commands: [{ id: 'cmd-1', kind: 'pump', durationMs: 8000 }] }
    mockMutation.mockResolvedValue(firmwareResponse)
    const handler = (await import(SRC)).default
    const event = bearerEvent('test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test-device',
      firmwareVersion: '1.2.3',
      sensors: [
        { kind: 'soil', unit: '%', raw: 1234 },
        { kind: 'light', unit: '%', raw: 3000 },
        { kind: 'water', unit: '%', raw: 2500 },
      ],
    })

    const result = await handler(event)
    expect(result).toEqual(firmwareResponse)
    expect(mockMutation).toHaveBeenCalledTimes(1)
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({ deviceId: 'test-device', deviceKey: 'test-key' }),
    )
  })

  it('rejects over-cap payloads with 400', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const handler = (await import(SRC)).default
    const event = bearerEvent('test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test-device',
      sensors: Array.from({ length: 9 }, () => ({ kind: 'soil', unit: '%', raw: 50 })),
    })

    await expect(handler(event)).resolves.toMatchObject({ statusCode: 400 })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('rejects pods raw values above 4095', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const handler = (await import(SRC)).default
    const event = bearerEvent('test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test-device',
      sensors: [{ kind: 'soil', unit: '%', raw: 5000 }],
    })

    await expect(handler(event)).resolves.toMatchObject({ statusCode: 400 })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('accepts tech raw values up to 32767 with variant tech', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    mockMutation.mockResolvedValue({ commands: [] })
    const handler = (await import(SRC)).default
    const event = bearerEvent('test-key')
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'tech-device',
      variant: 'tech',
      sensors: [{ kind: 'soil', unit: '%', raw: 20070 }],
    })

    const result = await handler(event)
    expect(result).toEqual({ commands: [] })
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({ deviceId: 'tech-device', variant: 'tech' }),
    )
  })
})
