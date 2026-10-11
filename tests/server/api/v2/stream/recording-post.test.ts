/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const SRC = '../../../../../server/api/v2/stream/recording.post'

const mockMutation = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    streams: {
      recordStreamSegment: 'recordStreamSegment',
    },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    mutation: mockMutation,
  }),
}))

function deviceEvent(apiKey: string | null = 'test-key') {
  const headers = new Headers()
  if (apiKey) headers.set('authorization', `Bearer ${apiKey}`)
  return { headers } as any
}

function validBody() {
  return {
    deviceId: 'dev-1',
    fileName: 'seg-001.h264',
    path: 'dev-1/stream/seg-001.h264',
    size: 1234,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  mockMutation.mockResolvedValue({ success: true })
  process.env.DEVICE_API_KEY = 'test-key'
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.readBody = vi.fn() as any
})

afterEach(() => {
  delete process.env.DEVICE_API_KEY
})

describe('POST /api/v2/stream/recording auth', () => {
  it('rejects requests without authorization with 401', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default
    vi.mocked(globalThis.readBody).mockResolvedValue(validBody())

    await expect(handler(deviceEvent(null))).rejects.toMatchObject({ statusCode: 401 })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('rejects requests with the wrong key with 401', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default
    vi.mocked(globalThis.readBody).mockResolvedValue(validBody())

    await expect(handler(deviceEvent('wrong-key'))).rejects.toMatchObject({ statusCode: 401 })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('fails with 500 when DEVICE_API_KEY is not configured', async () => {
    delete process.env.DEVICE_API_KEY
    vi.resetModules()
    const handler = (await import(SRC)).default
    vi.mocked(globalThis.readBody).mockResolvedValue(validBody())

    await expect(handler(deviceEvent('anything'))).rejects.toMatchObject({ statusCode: 500 })
    expect(mockMutation).not.toHaveBeenCalled()
  })
})

describe('POST /api/v2/stream/recording validation', () => {
  it.each([['deviceId'], ['fileName'], ['path'], ['size']])(
    'rejects bodies missing %s with 400',
    async (field) => {
      vi.resetModules()
      const handler = (await import(SRC)).default
      const body = validBody() as Record<string, unknown>
      delete body[field]
      vi.mocked(globalThis.readBody).mockResolvedValue(body)

      await expect(handler(deviceEvent())).rejects.toMatchObject({ statusCode: 400 })
      expect(mockMutation).not.toHaveBeenCalled()
    },
  )

  it.each([['yesterday'], [Number.NaN], [Number.POSITIVE_INFINITY], [true]])(
    'rejects non-finite capturedAt (%s) with 400',
    async (capturedAt) => {
      vi.resetModules()
      const handler = (await import(SRC)).default
      vi.mocked(globalThis.readBody).mockResolvedValue({ ...validBody(), capturedAt })

      await expect(handler(deviceEvent())).rejects.toMatchObject({ statusCode: 400 })
      expect(mockMutation).not.toHaveBeenCalled()
    },
  )
})

describe('POST /api/v2/stream/recording success', () => {
  it('defaults capturedAt to Date.now() when omitted', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default
    vi.mocked(globalThis.readBody).mockResolvedValue(validBody())
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    try {
      const result = await handler(deviceEvent())
      expect(result).toEqual({ success: true })
      expect(mockMutation).toHaveBeenCalledWith('recordStreamSegment', expect.objectContaining({
        deviceId: 'dev-1',
        capturedAt: 1700000000000,
        deviceKey: 'test-key',
      }))
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('defaults capturedAt to Date.now() when null', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...validBody(), capturedAt: null })
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1700000000001)

    try {
      await handler(deviceEvent())
      expect(mockMutation).toHaveBeenCalledWith('recordStreamSegment', expect.objectContaining({
        capturedAt: 1700000000001,
      }))
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('forwards an explicit finite capturedAt, including 0', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...validBody(), capturedAt: 0 })

    await handler(deviceEvent())
    expect(mockMutation).toHaveBeenCalledWith('recordStreamSegment', expect.objectContaining({
      capturedAt: 0,
    }))
  })

  it('forwards the device key and segment fields to the mutation', async () => {
    vi.resetModules()
    const handler = (await import(SRC)).default
    vi.mocked(globalThis.readBody).mockResolvedValue({
      ...validBody(),
      durationMs: 5000,
      capturedAt: 1699999999000,
    })

    const result = await handler(deviceEvent())
    expect(result).toEqual({ success: true })
    expect(mockMutation).toHaveBeenCalledWith('recordStreamSegment', {
      deviceId: 'dev-1',
      fileName: 'seg-001.h264',
      path: 'dev-1/stream/seg-001.h264',
      size: 1234,
      durationMs: 5000,
      capturedAt: 1699999999000,
      deviceKey: 'test-key',
    })
  })
})
