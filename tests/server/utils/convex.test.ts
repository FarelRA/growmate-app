import { describe, it, expect, vi, beforeEach } from 'vitest'

const { ConvexHttpClientMock, mockSetAuth } = vi.hoisted(() => {
  const setAuth = vi.fn()
  return {
    ConvexHttpClientMock: vi.fn(function () {
      return { setAuth }
    }),
    mockSetAuth: setAuth,
  }
})

vi.mock('convex/browser', () => ({
  ConvexHttpClient: ConvexHttpClientMock,
}))

beforeEach(() => {
  vi.resetModules()
  ConvexHttpClientMock.mockClear()
  mockSetAuth.mockClear()
})

describe('useConvex', () => {
  it('creates client with NUXT_PUBLIC_CONVEX_URL', async () => {
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'

    const { useConvex } = await import('../../../../server/utils/convex')
    const client = useConvex()

    expect(ConvexHttpClientMock).toHaveBeenCalledWith('https://convex.example.com')
    expect(client).toBeDefined()
  })

  it('returns the same singleton on repeated calls', async () => {
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'

    const { useConvex } = await import('../../../../server/utils/convex')
    const a = useConvex()
    const b = useConvex()

    expect(a).toBe(b)
    expect(ConvexHttpClientMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to VITE_CONVEX_URL', async () => {
    delete process.env.NUXT_PUBLIC_CONVEX_URL
    process.env.VITE_CONVEX_URL = 'https://vite-convex.example.com'

    const { useConvex } = await import('../../../../server/utils/convex')
    useConvex()

    expect(ConvexHttpClientMock).toHaveBeenCalledWith('https://vite-convex.example.com')
  })

  it('prefers NUXT_PUBLIC_CONVEX_URL over VITE_CONVEX_URL', async () => {
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://preferred.example.com'
    process.env.VITE_CONVEX_URL = 'https://ignored.example.com'

    const { useConvex } = await import('../../../../server/utils/convex')
    useConvex()

    expect(ConvexHttpClientMock).toHaveBeenCalledWith('https://preferred.example.com')
  })

  it('throws when no URL is configured', async () => {
    delete process.env.NUXT_PUBLIC_CONVEX_URL
    delete process.env.VITE_CONVEX_URL

    const { useConvex } = await import('../../../../server/utils/convex')

    expect(() => useConvex()).toThrow('NUXT_PUBLIC_CONVEX_URL is not configured')
  })
})

describe('useConvexAuth', () => {
  it('creates a new client each call and sets auth token', async () => {
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'

    const { useConvexAuth } = await import('../../../../server/utils/convex')
    const client = useConvexAuth('test-token')

    expect(ConvexHttpClientMock).toHaveBeenCalledTimes(1)
    expect(ConvexHttpClientMock).toHaveBeenCalledWith('https://convex.example.com')
    expect(mockSetAuth).toHaveBeenCalledWith('test-token')
    expect(client).toBeDefined()
  })

  it('creates separate instances per call', async () => {
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'

    const { useConvexAuth } = await import('../../../../server/utils/convex')
    const a = useConvexAuth('token-a')
    const b = useConvexAuth('token-b')

    expect(a).not.toBe(b)
    expect(ConvexHttpClientMock).toHaveBeenCalledTimes(2)
  })
})
