/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const SRC = '../../../../server/api/demo/login.post'

const mockAction = vi.hoisted(() => vi.fn())

vi.mock('~~/convex/_generated/api', () => ({
  api: { auth: { signIn: 'auth:signIn' } },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    action: mockAction,
  }),
}))

function mockEvent(body: unknown) {
  return { headers: new Headers() } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAction.mockReset()
  vi.stubGlobal('readBody', vi.fn())
  vi.stubGlobal('getRequestIP', vi.fn(() => '10.0.0.9'))
  vi.stubGlobal('createError', ((opts: any) => {
    const error = new Error(opts.statusMessage) as any
    error.statusCode = opts.statusCode
    throw error
  }) as any)
  delete process.env.DEMO_ACCESS_TOKEN
  delete process.env.DEMO_PASSWORD
  delete process.env.DEMO_EMAIL
})

async function handlerWith(body: unknown) {
  vi.resetModules()
  vi.mocked(globalThis.readBody).mockResolvedValue(body)
  return (await import(SRC)).default
}

describe('POST /api/demo/login', () => {
  it('returns 404 when the demo secret is not configured', async () => {
    const handler = await handlerWith({ token: 'anything' })
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 404 })
    expect(mockAction).not.toHaveBeenCalled()
  })

  it('returns 404 for a wrong token without touching Convex', async () => {
    process.env.DEMO_ACCESS_TOKEN = 'correct-token-1234567890abcdef'
    process.env.DEMO_PASSWORD = 'demo-pass'
    const handler = await handlerWith({ token: 'wrong-token' })
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 404 })
    expect(mockAction).not.toHaveBeenCalled()
  })

  it('signs in the demo account and returns the token pair on match', async () => {
    process.env.DEMO_ACCESS_TOKEN = 'correct-token-1234567890abcdef'
    process.env.DEMO_PASSWORD = 'demo-pass'
    mockAction.mockResolvedValue({ tokens: { token: 'jwt-1', refreshToken: 'ref-1' } })
    const handler = await handlerWith({ token: 'correct-token-1234567890abcdef' })
    const result = await handler(mockEvent())
    expect(result).toEqual({ token: 'jwt-1', refreshToken: 'ref-1' })
    expect(mockAction).toHaveBeenCalledWith(
      'auth:signIn',
      { provider: 'password', params: { email: 'demo@growmate.bond', password: 'demo-pass', flow: 'signIn' } },
    )
  })

  it('returns 503 when the demo sign-in yields no tokens', async () => {
    process.env.DEMO_ACCESS_TOKEN = 'correct-token-1234567890abcdef'
    process.env.DEMO_PASSWORD = 'demo-pass'
    mockAction.mockResolvedValue({})
    const handler = await handlerWith({ token: 'correct-token-1234567890abcdef' })
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 503 })
  })
})
