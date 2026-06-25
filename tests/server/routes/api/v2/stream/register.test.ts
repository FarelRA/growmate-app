/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SRC = '../../../../../../server/routes/api/v2/stream/register.post'

const mockMutation = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    streams: {
      registerStream: 'registerStream',
    },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    mutation: mockMutation,
  }),
}))

const mockConnect = vi.hoisted(() => vi.fn())
vi.mock('~~/server/utils/streamManager', () => ({
  streamManager: {
    connect: mockConnect,
  },
}))

const mockParseStreamUrl = vi.hoisted(() => vi.fn())
vi.mock('~~/convex/helpers/streams', () => ({
  parseStreamUrl: mockParseStreamUrl,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  mockConnect.mockReset()
  mockParseStreamUrl.mockReset()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  )
  globalThis.readBody = vi.fn()
})

describe('POST /api/v2/stream/register', () => {
  it('rejects request without x-api-key', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const handler = (await import(SRC)).default
    const event = { headers: new Headers({ 'content-type': 'application/json' }) }

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects invalid stream URL (non-tcp protocol)', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    mockParseStreamUrl.mockReturnValue(null)
    const handler = (await import(SRC)).default
    const event = { headers: new Headers({ 'x-api-key': 'test-key', 'content-type': 'application/json' }) }
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test', streamUrl: 'invalid-url',
    })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('rejects non-tcp protocol', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    mockParseStreamUrl.mockReturnValue({ protocol: 'http', host: 'example.com', port: 80 })
    const handler = (await import(SRC)).default
    const event = { headers: new Headers({ 'x-api-key': 'test-key', 'content-type': 'application/json' }) }
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test', streamUrl: 'http://example.com:80',
    })

    await expect(handler(event)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('registers stream successfully', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    mockParseStreamUrl.mockReturnValue({ protocol: 'tcp', host: '100.64.0.1', port: 8554 })
    mockMutation.mockResolvedValue({ success: true })

    const handler = (await import(SRC)).default
    const event = { headers: new Headers({ 'x-api-key': 'test-key', 'content-type': 'application/json' }) }
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'test-device', streamUrl: 'tcp://100.64.0.1:8554',
    })

    const result = await handler(event)
    expect(result.success).toBe(true)
    expect(result.streamId).toBe('test-device')
    expect(mockMutation).toHaveBeenCalledWith('registerStream', {
      deviceId: 'test-device',
      streamUrl: 'tcp://100.64.0.1:8554',
    })
    expect(mockConnect).toHaveBeenCalledWith('test-device', '100.64.0.1', 8554)
  })
})
