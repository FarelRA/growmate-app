import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { ConvexHttpClientMock } = vi.hoisted(() => {
  return {
    ConvexHttpClientMock: vi.fn(function () {
      return {}
    }),
  }
})

vi.mock('convex/browser', () => ({
  ConvexHttpClient: ConvexHttpClientMock,
}))

const ENV_KEYS = [
  'CONVEX_INTERNAL_URL',
  'NUXT_PUBLIC_CONVEX_URL',
  'VITE_CONVEX_URL',
  'CONVEX_TIMEOUT_MS',
]
let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  vi.resetModules()
  ConvexHttpClientMock.mockClear()
  savedEnv = {}
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  }
})

describe('internal Convex URL routing', () => {
  it('prefers CONVEX_INTERNAL_URL when set', async () => {
    process.env.CONVEX_INTERNAL_URL = 'http://convex:3210'
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'

    const { useConvex } = await import('../../../../server/utils/convex')
    useConvex()

    expect(ConvexHttpClientMock).toHaveBeenCalledWith('http://convex:3210')
  })

  it('falls back to the public URL otherwise', async () => {
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'

    const { useConvex } = await import('../../../../server/utils/convex')
    useConvex()

    expect(ConvexHttpClientMock).toHaveBeenCalledWith('https://convex.example.com')
  })

  it('prefers internal URL for auth clients too', async () => {
    process.env.CONVEX_INTERNAL_URL = 'http://convex:3210'
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'
    ConvexHttpClientMock.mockImplementationOnce(function () {
      return { setAuth: vi.fn() }
    })

    const { useConvexAuth } = await import('../../../../server/utils/convex')
    useConvexAuth('test-token')

    expect(ConvexHttpClientMock).toHaveBeenCalledWith('http://convex:3210')
  })
})

describe('withConvexTimeout', () => {
  it('resolves normally when the call is fast', async () => {
    const { withConvexTimeout } = await import('../../../../server/utils/convex')

    await expect(withConvexTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })

  it('rejects with ConvexTimeoutError when the call hangs', async () => {
    const { withConvexTimeout, ConvexTimeoutError } = await import(
      '../../../../server/utils/convex'
    )

    const hanging = new Promise<never>(() => {})
    await expect(withConvexTimeout(hanging, 20)).rejects.toBeInstanceOf(ConvexTimeoutError)
  })

  it('applies the timeout to queries on the shared client', async () => {
    process.env.CONVEX_TIMEOUT_MS = '30'
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'
    ConvexHttpClientMock.mockImplementationOnce(function () {
      return { query: () => new Promise<never>(() => {}) }
    })

    const { useConvex, ConvexTimeoutError } = await import('../../../../server/utils/convex')
    const client = useConvex()

    const query = client.query as unknown as (...args: unknown[]) => Promise<unknown>
    await expect(query('fake-query', {})).rejects.toBeInstanceOf(ConvexTimeoutError)
  })

  it('preserves `this` on timed query/mutation/action calls', async () => {
    process.env.NUXT_PUBLIC_CONVEX_URL = 'https://convex.example.com'
    // Prototype methods like the real ConvexHttpClient (unbound): a proxy
    // that drops `this` makes every one of these throw.
    class FakeClient {
      prefix = 'ok:'

      query(arg: unknown) {
        return Promise.resolve(`${this.prefix}${String(arg)}`)
      }

      mutation(arg: unknown) {
        return Promise.resolve(`${this.prefix}${String(arg)}`)
      }

      action(arg: unknown) {
        return Promise.resolve(`${this.prefix}${String(arg)}`)
      }
    }
    ConvexHttpClientMock.mockImplementationOnce(function () {
      return new FakeClient()
    })

    const { useConvex } = await import('../../../../server/utils/convex')
    const client = useConvex()

    // The pre-fix proxy detached the methods and every server Convex call
    // failed closed with `Cannot read properties of undefined`.
    await expect(
      (client.query as unknown as (...args: unknown[]) => Promise<unknown>)('q', {}),
    ).resolves.toBe('ok:q')
    await expect(
      (client.mutation as unknown as (...args: unknown[]) => Promise<unknown>)('m', {}),
    ).resolves.toBe('ok:m')
    await expect(
      (client.action as unknown as (...args: unknown[]) => Promise<unknown>)('a', {}),
    ).resolves.toBe('ok:a')
  })
})
