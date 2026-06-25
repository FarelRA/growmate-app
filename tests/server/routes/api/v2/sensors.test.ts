/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SRC = '../../../../../server/routes/api/v2/sensors.post'

const mockMutation = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    sensors: {
      ingestSensorData: 'ingestSensorData',
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
  )
  globalThis.readBody = vi.fn()
})

describe('POST /api/v2/sensors', () => {
  describe('authentication', () => {
    it('rejects request without x-api-key header', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key-123'
      const handler = (await import(SRC)).default
      const event = mockEvent()

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 401,
      })
    })

    it('rejects request with wrong x-api-key', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key-123'
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'wrong-key')

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 401,
      })
    })

    it('accepts request with correct x-api-key', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key-123'
      mockMutation.mockResolvedValue({ success: true, updated: 5, commands: [] })
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key-123')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test-device',
        firmwareVersion: '2.0.0',
        sensors: [
          { kind: 'temperature', value: 28.5, unit: 'C' },
          { kind: 'air', value: 65, unit: '%' },
          { kind: 'soil', value: 45, unit: '%', raw: 12345 },
          { kind: 'water', value: 80, unit: '%', raw: 54321 },
          { kind: 'light', value: 60, unit: '%', raw: 30000 },
        ],
      })

      const result = await handler(event)
      expect(result.success).toBe(true)
    })
  })

  describe('sensor validation', () => {
    it('rejects temperature below -40', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: -50, unit: 'C' },
          { kind: 'air', value: 50, unit: '%' },
          { kind: 'soil', value: 50, unit: '%' },
          { kind: 'water', value: 50, unit: '%' },
          { kind: 'light', value: 50, unit: '%' },
        ],
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('rejects temperature above 125', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: 130, unit: 'C' },
          { kind: 'air', value: 50, unit: '%' },
          { kind: 'soil', value: 50, unit: '%' },
          { kind: 'water', value: 50, unit: '%' },
          { kind: 'light', value: 50, unit: '%' },
        ],
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('accepts temperature at boundary -40', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      mockMutation.mockResolvedValue({ success: true, updated: 5, commands: [] })
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: -40, unit: 'C' },
          { kind: 'air', value: 50, unit: '%' },
          { kind: 'soil', value: 50, unit: '%' },
          { kind: 'water', value: 50, unit: '%' },
          { kind: 'light', value: 50, unit: '%' },
        ],
      })

      const result = await handler(event)
      expect(result.success).toBe(true)
    })

    it('accepts temperature at boundary 125', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      mockMutation.mockResolvedValue({ success: true, updated: 5, commands: [] })
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: 125, unit: 'C' },
          { kind: 'air', value: 50, unit: '%' },
          { kind: 'soil', value: 50, unit: '%' },
          { kind: 'water', value: 50, unit: '%' },
          { kind: 'light', value: 50, unit: '%' },
        ],
      })

      const result = await handler(event)
      expect(result.success).toBe(true)
    })

    it('rejects sensor value above 100', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: 28, unit: 'C' },
          { kind: 'air', value: 50, unit: '%' },
          { kind: 'soil', value: 150, unit: '%' },
          { kind: 'water', value: 50, unit: '%' },
          { kind: 'light', value: 50, unit: '%' },
        ],
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('rejects sensor value below 0', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: 28, unit: 'C' },
          { kind: 'air', value: 50, unit: '%' },
          { kind: 'soil', value: -5, unit: '%' },
          { kind: 'water', value: 50, unit: '%' },
          { kind: 'light', value: 50, unit: '%' },
        ],
      })

      await expect(handler(event)).rejects.toMatchObject({
        statusCode: 400,
      })
    })
  })

  describe('command processing', () => {
    it('clears commands after successful ingestion', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      mockMutation
        .mockResolvedValueOnce({
          success: true,
          updated: 5,
          commands: [{ kind: 'pump', durationMs: 8000 }],
        })
        .mockResolvedValueOnce({ success: true })

      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: 28, unit: 'C' },
          { kind: 'air', value: 65, unit: '%' },
          { kind: 'soil', value: 45, unit: '%' },
          { kind: 'water', value: 80, unit: '%' },
          { kind: 'light', value: 60, unit: '%' },
        ],
      })

      const result = await handler(event)
      expect(result.commands).toEqual([{ kind: 'pump', durationMs: 8000 }])
      expect(mockMutation).toHaveBeenCalledTimes(2)
    })

    it('handles empty commands array', async () => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      mockMutation.mockResolvedValue({ success: true, updated: 5, commands: [] })

      const handler = (await import(SRC)).default
      const event = mockEvent()
      event.headers.set('x-api-key', 'test-key')
      vi.mocked(globalThis.readBody).mockResolvedValue({
        deviceId: 'test', sensors: [
          { kind: 'temperature', value: 28, unit: 'C' },
          { kind: 'air', value: 65, unit: '%' },
          { kind: 'soil', value: 45, unit: '%' },
          { kind: 'water', value: 80, unit: '%' },
          { kind: 'light', value: 60, unit: '%' },
        ],
      })

      const result = await handler(event)
      expect(result.commands).toEqual([])
      expect(mockMutation).toHaveBeenCalledTimes(1)
    })
  })
})
