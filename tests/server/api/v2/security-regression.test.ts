/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Security regression locks.
 *
 * One-file sweep over this session's security fixes so a future refactor
 * cannot silently reopen them:
 *  1. Fail-closed device auth on every device-key route (unset env → 500,
 *     wrong/missing key → 401, never a passthrough to Convex/streamManager).
 *  2. SSRF host rejection on stream register.
 *  3. `?token=` required on the live WebSocket upgrade.
 *  4. `Bearer` required on the recordings list.
 *  5. `deviceKey` forwarded into every device mutation call.
 *
 * Pattern follows tests/server/api/device-auth.test.ts (hoisted mocks,
 * per-test `vi.resetModules()` + dynamic imports, h3 globals on globalThis).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockMutation, mockQuery } = vi.hoisted(() => ({
  mockMutation: vi.fn(),
  mockQuery: vi.fn(),
}))
const { mockConnect, mockAddViewer, mockRemoveViewer } = vi.hoisted(() => ({
  mockConnect: vi.fn(),
  mockAddViewer: vi.fn(),
  mockRemoveViewer: vi.fn(),
}))
const { mockProcessImage, mockGenerateHash, mockUploadFile } = vi.hoisted(() => ({
  mockProcessImage: vi.fn(),
  mockGenerateHash: vi.fn(),
  mockUploadFile: vi.fn(),
}))
const { mockGetSignedUrl, mockPublicClient } = vi.hoisted(() => ({
  mockGetSignedUrl: vi.fn(async () => 'https://signed.example/url'),
  mockPublicClient: {},
}))

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    auth: { isAuthenticated: 'isAuthenticated' },
    sensors: {
      ingestAndAckSensorData: 'ingestAndAckSensorData',
      ingestCameraImage: 'ingestCameraImage',
    },
    streams: {
      registerStream: 'registerStream',
      recordStreamSegment: 'recordStreamSegment',
      getOwnedDevice: 'getOwnedDevice',
      listRecordings: 'listRecordings',
    },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    mutation: (...args: unknown[]) => (mockMutation as any)(...args),
  }),
  useConvexAuth: () => ({
    query: (...args: unknown[]) => (mockQuery as any)(...args),
  }),
}))

vi.mock('~~/server/utils/streamManager', () => ({
  streamManager: {
    connect: (...args: unknown[]) => (mockConnect as any)(...args),
    addViewer: (...args: unknown[]) => (mockAddViewer as any)(...args),
    removeViewer: (...args: unknown[]) => (mockRemoveViewer as any)(...args),
  },
}))

vi.mock('~~/server/utils/images', () => ({
  processImage: (...args: unknown[]) => (mockProcessImage as any)(...args),
  generateHash: (...args: unknown[]) => (mockGenerateHash as any)(...args),
}))

vi.mock('~~/server/utils/storage', () => ({
  uploadFile: (...args: unknown[]) => (mockUploadFile as any)(...args),
  s3PublicClient: () => mockPublicClient,
  RECORDINGS_BUCKET: 'recordings',
}))

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: class GetObjectCommand {
    constructor(public input: unknown) {}
  },
}))

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => (mockGetSignedUrl as (...a: unknown[]) => unknown)(...args),
}))

// NOTE: ~~ /shared/utils/streamUrl is intentionally NOT mocked — the SSRF
// locks below must exercise the real parser + blocklist end to end.

const V1_SENSORS_SRC = '../../../../server/api/v1/sensors.post'
const V2_SENSORS_SRC = '../../../../server/api/v2/sensors.post'
const CAMERA_SRC = '../../../../server/api/v1/camera.post'
const REGISTER_SRC = '../../../../server/api/v2/stream/register.post'
const RECORDING_SRC = '../../../../server/api/v2/stream/recording.post'
const LIVE_SRC = '../../../../server/api/v2/stream/[deviceId]/live.get'
const RECORDINGS_SRC = '../../../../server/api/v2/recordings/[deviceId].get'

const VALID_SENSORS = {
  deviceId: 'dev-1',
  sensors: [{ kind: 'soil', value: 50, unit: '%' }],
}
const VALID_STREAM = { deviceId: 'dev-1', streamUrl: 'tcp://100.64.0.1:8554' }
const VALID_SEGMENT = {
  deviceId: 'dev-1',
  fileName: 'a.h264',
  path: 'dev-1/stream/a.h264',
  size: 10,
}

function deviceEvent(apiKey?: string) {
  const event: any = { headers: new Headers() }
  if (apiKey !== undefined) event.headers.set('x-api-key', apiKey)
  return event
}

function cameraEvent(apiKey?: string) {
  const event = deviceEvent(apiKey)
  event.headers.set('x-device-id', 'device-1')
  return event
}

function mockCameraSuccess() {
  mockGenerateHash.mockReturnValue('hash123')
  mockProcessImage.mockResolvedValue([{ size: 50, buffer: Buffer.from('s50') }])
  mockUploadFile.mockResolvedValue(undefined)
  mockMutation.mockResolvedValue(undefined)
  vi.mocked(globalThis.readRawBody).mockResolvedValue('fake-body')
}

function recordingsEvent(deviceId = 'dev-1', authorization?: string) {
  const event: any = { headers: new Headers(), params: { deviceId } }
  if (authorization !== undefined) event.headers.set('authorization', authorization)
  return event
}

function upgradeRequest(deviceId = 'dev-1', token: string | null = 'token-123') {
  const base = `ws://localhost/api/v2/stream/${deviceId}/live`
  return new Request(token ? `${base}?token=${encodeURIComponent(token)}` : base)
}

beforeEach(() => {
  vi.clearAllMocks()
  for (const m of [mockMutation, mockQuery, mockConnect, mockProcessImage, mockGenerateHash, mockUploadFile]) {
    m.mockReset()
  }
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.readBody = vi.fn() as any
  globalThis.readRawBody = vi.fn() as any
  globalThis.getRouterParam = vi.fn((event: any, name: string) => event.params?.[name]) as any
  ;(globalThis as any).defineWebSocketHandler = (hooks: any) => hooks
  mockQuery.mockImplementation(async (ref: string) => {
    if (ref === 'isAuthenticated') return true
    if (ref === 'getOwnedDevice') return { deviceId: 'dev-1', name: 'GrowMate' }
    if (ref === 'listRecordings') return []
    throw new Error(`unexpected query: ${ref}`)
  })
})

afterEach(() => {
  delete process.env.DEVICE_API_KEY
})

describe('fail-closed device auth on every device-key route', () => {
  it('rejects v1 sensors, v2 sensors, camera, register, recording with 500 when env is unset', async () => {
    vi.resetModules()
    delete process.env.DEVICE_API_KEY
    const { default: v1Sensors } = await import(V1_SENSORS_SRC)
    const { default: v2Sensors } = await import(V2_SENSORS_SRC)
    const { default: camera } = await import(CAMERA_SRC)
    const { default: register } = await import(REGISTER_SRC)
    const { default: recording } = await import(RECORDING_SRC)
    mockCameraSuccess()

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SENSORS })
    await expect(v1Sensors(deviceEvent('any-key'))).rejects.toMatchObject({ statusCode: 500 })
    await expect(v2Sensors(deviceEvent('any-key'))).rejects.toMatchObject({ statusCode: 500 })
    await expect(camera(cameraEvent('any-key'))).rejects.toMatchObject({ statusCode: 500 })

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_STREAM })
    await expect(register(deviceEvent('any-key'))).rejects.toMatchObject({ statusCode: 500 })

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SEGMENT })
    await expect(recording(deviceEvent('any-key'))).rejects.toMatchObject({ statusCode: 500 })

    // No passthrough: neither Convex nor the stream dialer may run.
    expect(mockMutation).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('rejects every device-key route with 401 on wrong key and missing key', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'secret-key'
    const { default: v1Sensors } = await import(V1_SENSORS_SRC)
    const { default: v2Sensors } = await import(V2_SENSORS_SRC)
    const { default: camera } = await import(CAMERA_SRC)
    const { default: register } = await import(REGISTER_SRC)
    const { default: recording } = await import(RECORDING_SRC)
    mockCameraSuccess()

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SENSORS })
    await expect(v1Sensors(deviceEvent('wrong-key'))).rejects.toMatchObject({ statusCode: 401 })
    await expect(v2Sensors(deviceEvent())).rejects.toMatchObject({ statusCode: 401 })
    await expect(camera(cameraEvent('wrong-key'))).rejects.toMatchObject({ statusCode: 401 })

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_STREAM })
    await expect(register(deviceEvent('wrong-key'))).rejects.toMatchObject({ statusCode: 401 })

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SEGMENT })
    await expect(recording(deviceEvent())).rejects.toMatchObject({ statusCode: 401 })

    expect(mockMutation).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })
})

describe('SSRF host rejection on register', () => {
  const BLOCKED = [
    'tcp://localhost:8554',
    'tcp://127.0.0.1:8554',
    'tcp://0.0.0.0:8554',
    'tcp://10.0.0.5:8554',
    'tcp://192.168.1.10:8554',
    'tcp://172.16.0.5:8554',
    'tcp://169.254.169.254:80',
    'tcp://minio:9000',
  ]

  it.each(BLOCKED)('rejects %s with 400 and never touches Convex/dialer', async (streamUrl) => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: register } = await import(REGISTER_SRC)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(globalThis.readBody).mockResolvedValue({ deviceId: 'dev-1', streamUrl })

    try {
      await expect(register(deviceEvent('test-key'))).rejects.toMatchObject({ statusCode: 400 })
      expect(mockMutation).not.toHaveBeenCalled()
      expect(mockConnect).not.toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('still allows a public CGNAT host', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: register } = await import(REGISTER_SRC)
    mockMutation.mockResolvedValue({ success: true })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_STREAM })

    const result = await register(deviceEvent('test-key'))
    expect(result.success).toBe(true)
    expect(mockConnect).toHaveBeenCalledTimes(1)
  })
})

describe('live upgrade requires ?token=', () => {
  it('rejects upgrade without a token (401) before any auth query', async () => {
    vi.resetModules()
    const handler = (await import(LIVE_SRC)).default as any
    const result = await handler.upgrade(upgradeRequest('dev-1', null))
    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects upgrade with an empty token (401)', async () => {
    vi.resetModules()
    const handler = (await import(LIVE_SRC)).default as any
    const result = await handler.upgrade(upgradeRequest('dev-1', ''))
    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(401)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('recordings list requires Bearer', () => {
  it('rejects requests with no authorization header (401)', async () => {
    const handler = (await import(RECORDINGS_SRC)).default
    await expect(handler(recordingsEvent('dev-1'))).rejects.toMatchObject({ statusCode: 401 })
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('rejects non-Bearer schemes (401)', async () => {
    const handler = (await import(RECORDINGS_SRC)).default
    await expect(handler(recordingsEvent('dev-1', 'Token abc'))).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('deviceKey forwarded into mutation calls', () => {
  it('v2 ingest passes deviceKey to ingestAndAckSensorData', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: v2Sensors } = await import(V2_SENSORS_SRC)
    mockMutation.mockResolvedValue({ success: true, updated: 1, commands: [] })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SENSORS })

    await v2Sensors(deviceEvent('test-key'))
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({ deviceId: 'dev-1', deviceKey: 'test-key' }),
    )
  })

  it('camera passes deviceKey to ingestCameraImage', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: camera } = await import(CAMERA_SRC)
    mockCameraSuccess()

    await camera(cameraEvent('test-key'))
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestCameraImage',
      expect.objectContaining({ deviceId: 'device-1', deviceKey: 'test-key' }),
    )
  })

  it('register passes deviceKey to registerStream', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: register } = await import(REGISTER_SRC)
    mockMutation.mockResolvedValue({ success: true })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_STREAM })

    await register(deviceEvent('test-key'))
    expect(mockMutation).toHaveBeenCalledWith(
      'registerStream',
      expect.objectContaining({ deviceId: 'dev-1', deviceKey: 'test-key' }),
    )
  })

  it('recording passes deviceKey to recordStreamSegment', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: recording } = await import(RECORDING_SRC)
    mockMutation.mockResolvedValue({ success: true })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SEGMENT })

    await recording(deviceEvent('test-key'))
    expect(mockMutation).toHaveBeenCalledWith(
      'recordStreamSegment',
      expect.objectContaining({ deviceId: 'dev-1', deviceKey: 'test-key' }),
    )
  })
})
