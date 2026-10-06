/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * SSRF DNS-resolution locks for POST /api/v2/stream/register.
 *
 * Literal-string blocklist checks alone are bypassable: an attacker domain
 * that resolves to an internal address (169.254.169.254, docker 172.18.x.x,
 * service names), or an obfuscated literal (decimal 2130706433, hex
 * 0x7f.0.0.1, octal 0177.0.0.1, bracketed [::ffff:127.0.0.1]) sails through
 * string checks and the server then dials the internal target.
 *
 * These tests exercise the real parser end to end (~~/shared/utils/streamUrl
 * is intentionally NOT mocked) with a mocked node:dns/promises lookup:
 *  1. Hostnames resolving to internal IPs are rejected (fail closed).
 *  2. Obfuscated numeric/bracketed host forms are rejected before any DNS.
 *  3. DNS failure is rejected (never dials on unresolvable hosts).
 *  4. Legit domains / public IPs still register.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const SRC = '../../../../../server/api/v2/stream/register.post'

const { mockMutation, mockConnect, mockLookup } = vi.hoisted(() => ({
  mockMutation: vi.fn(),
  mockConnect: vi.fn(),
  mockLookup: vi.fn(),
}))

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    streams: {
      registerStream: 'registerStream',
    },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    mutation: (...args: unknown[]) => (mockMutation as any)(...args),
  }),
}))

vi.mock('~~/server/utils/streamManager', () => ({
  streamManager: {
    connect: (...args: unknown[]) => (mockConnect as any)(...args),
  },
}))

vi.mock('node:dns/promises', () => ({
  lookup: (...args: unknown[]) => (mockLookup as any)(...args),
}))

// NOTE: ~~/shared/utils/streamUrl is intentionally NOT mocked — these locks
// must exercise the real parser + host-form checks end to end.

function deviceEvent(apiKey = 'test-key') {
  const event: any = { headers: new Headers({ 'x-api-key': apiKey }) }
  return event
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DEVICE_API_KEY = 'test-key'
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.readBody = vi.fn() as any
  // Default: echo the input back as a public-looking resolution unless a
  // test overrides it. Individual tests set the resolved address explicitly.
  mockLookup.mockImplementation(async (host: string) => ({ address: host, family: 4 }))
  mockMutation.mockResolvedValue({ success: true })
})

afterEach(() => {
  delete process.env.DEVICE_API_KEY
})

describe('SSRF resolved-IP bypass', () => {
  const RESOLVED_INTERNAL: Array<[string, string]> = [
    ['tcp://attacker.example:1234', '169.254.169.254'],
    ['tcp://attacker.example:1234', '127.0.0.1'],
    ['tcp://attacker.example:1234', '10.0.0.5'],
    ['tcp://attacker.example:1234', '172.18.0.2'],
    ['tcp://attacker.example:1234', '192.168.1.1'],
    ['tcp://attacker.example:1234', '::ffff:127.0.0.1'],
  ]

  it.each(RESOLVED_INTERNAL)(
    'rejects %s resolving to %s with 400 and never touches Convex/dialer',
    async (streamUrl, resolved) => {
      vi.resetModules()
      mockLookup.mockResolvedValue({ address: resolved, family: resolved.includes(':') ? 6 : 4 })
      const { default: register } = await import(SRC)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.mocked(globalThis.readBody).mockResolvedValue({ deviceId: 'dev-1', streamUrl })

      try {
        await expect(register(deviceEvent())).rejects.toMatchObject({ statusCode: 400 })
        expect(mockMutation).not.toHaveBeenCalled()
        expect(mockConnect).not.toHaveBeenCalled()
      } finally {
        warnSpy.mockRestore()
      }
    },
  )
})

describe('SSRF obfuscated host forms', () => {
  const OBFUSCATED = [
    'tcp://2130706433:1234',
    'tcp://3232235521:1234',
    'tcp://0x7f.0.0.1:1234',
    'tcp://0x7f000001:1234',
    'tcp://0177.0.0.1:1234',
    'tcp://[::ffff:127.0.0.1]:1234',
  ]

  it.each(OBFUSCATED)('rejects %s with 400 without consulting DNS', async (streamUrl) => {
    vi.resetModules()
    const { default: register } = await import(SRC)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(globalThis.readBody).mockResolvedValue({ deviceId: 'dev-1', streamUrl })

    try {
      await expect(register(deviceEvent())).rejects.toMatchObject({ statusCode: 400 })
      expect(mockLookup).not.toHaveBeenCalled()
      expect(mockMutation).not.toHaveBeenCalled()
      expect(mockConnect).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('SSRF DNS fail-closed', () => {
  it('rejects unresolvable hosts with 400 and never touches Convex/dialer', async () => {
    vi.resetModules()
    mockLookup.mockRejectedValue(
      Object.assign(new Error('getaddrinfo ENOTFOUND nosuchhost.invalid'), { code: 'ENOTFOUND' }),
    )
    const { default: register } = await import(SRC)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-1',
      streamUrl: 'tcp://nosuchhost.invalid:8554',
    })

    try {
      await expect(register(deviceEvent())).rejects.toMatchObject({ statusCode: 400 })
      expect(mockMutation).not.toHaveBeenCalled()
      expect(mockConnect).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('SSRF legit hosts still pass', () => {
  it('allows a domain resolving to a public IP', async () => {
    vi.resetModules()
    mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 })
    const { default: register } = await import(SRC)
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-1',
      streamUrl: 'tcp://camera.example.com:8554',
    })

    const result = await register(deviceEvent())
    expect(result.success).toBe(true)
    expect(mockMutation).toHaveBeenCalledWith(
      'registerStream',
      expect.objectContaining({ deviceId: 'dev-1', deviceKey: 'test-key' }),
    )
    expect(mockConnect).toHaveBeenCalledWith('dev-1', 'camera.example.com', 8554)
  })

  it('allows a public IP literal', async () => {
    vi.resetModules()
    mockLookup.mockResolvedValue({ address: '100.64.0.1', family: 4 })
    const { default: register } = await import(SRC)
    vi.mocked(globalThis.readBody).mockResolvedValue({
      deviceId: 'dev-1',
      streamUrl: 'tcp://100.64.0.1:8554',
    })

    const result = await register(deviceEvent())
    expect(result.success).toBe(true)
    expect(mockConnect).toHaveBeenCalledWith('dev-1', '100.64.0.1', 8554)
  })
})

describe('isBlockedStreamHost on resolved values', () => {
  it('blocks resolved internal targets, allows public IPs', async () => {
    vi.resetModules()
    const { isBlockedStreamHost } = await import(SRC)

    expect(isBlockedStreamHost('169.254.169.254')).not.toBeNull()
    expect(isBlockedStreamHost('172.18.0.2')).not.toBeNull()
    expect(isBlockedStreamHost('::ffff:127.0.0.1')).not.toBeNull()
    expect(isBlockedStreamHost('::ffff:7f00:1')).not.toBeNull()
    expect(isBlockedStreamHost('93.184.216.34')).toBeNull()
    expect(isBlockedStreamHost('100.64.0.1')).toBeNull()
  })
})
