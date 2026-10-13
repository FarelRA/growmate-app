/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Security regression locks.
 *
 * One-file sweep over this session's security fixes so a future refactor
 * cannot silently reopen them:
 *  1. Fail-closed device auth on every device-key route (unset env → 500,
 *     wrong/missing key → 401, never a passthrough to Convex).
 *  2. `Bearer` required on the recordings list.
 *  3. `deviceKey` forwarded into every device mutation call.
 *
 * Pattern follows tests/server/api/device-auth.test.ts (hoisted mocks,
 * per-test `vi.resetModules()` + dynamic imports, h3 globals on globalThis).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockMutation, mockQuery } = vi.hoisted(() => ({
  mockMutation: vi.fn(),
  mockQuery: vi.fn(),
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

const V1_SENSORS_SRC = '../../../../server/routes/v1/sensors.post'
const CAMERA_SRC = '../../../../server/routes/v1/camera.post'
const RECORDINGS_SRC = '../../../../server/api/v2/recordings/[deviceId].get'

const VALID_SENSORS = {
  deviceId: 'dev-1',
  sensors: [{ kind: 'soil', value: 50, unit: '%' }],
}
// Firmware-exact envelope for the v1 ingest deviceKey test (ingestHandler
// validates via validateDeviceEnvelope: analog kinds are RAW-only).
const VALID_ENVELOPE = {
  deviceId: 'dev-1',
  sensors: [{ kind: 'soil', raw: 2000, unit: 'raw' }],
}

function deviceEvent(apiKey?: string) {
  const event: any = { headers: new Headers() }
  if (apiKey !== undefined) event.headers.set('authorization', `Bearer ${apiKey}`)
  event.headers.set('x-device-id', 'dev-1')
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

beforeEach(() => {
  vi.clearAllMocks()
  for (const m of [mockMutation, mockQuery, mockProcessImage, mockGenerateHash, mockUploadFile]) {
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
  it('answers v1 sensors and camera with JSON 500 when env is unset', async () => {
    vi.resetModules()
    delete process.env.DEVICE_API_KEY
    const { default: v1Sensors } = await import(V1_SENSORS_SRC)
    const { default: camera } = await import(CAMERA_SRC)
    mockCameraSuccess()

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SENSORS })
    await expect(v1Sensors(deviceEvent('any-key'))).resolves.toMatchObject({ statusCode: 500 })
    await expect(camera(cameraEvent('any-key'))).resolves.toMatchObject({ statusCode: 500 })

    // No passthrough to Convex.
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('answers every device-key route with JSON 401 on wrong key and missing key', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'secret-key'
    const { default: v1Sensors } = await import(V1_SENSORS_SRC)
    const { default: camera } = await import(CAMERA_SRC)
    mockCameraSuccess()

    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SENSORS })
    await expect(v1Sensors(deviceEvent('wrong-key'))).resolves.toMatchObject({ statusCode: 401 })
    await expect(v1Sensors(deviceEvent())).resolves.toMatchObject({ statusCode: 401 })
    await expect(camera(cameraEvent('wrong-key'))).resolves.toMatchObject({ statusCode: 401 })

    expect(mockMutation).not.toHaveBeenCalled()
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
  it('v1 ingest passes deviceKey to ingestAndAckSensorData', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: v1Sensors } = await import(V1_SENSORS_SRC)
    mockMutation.mockResolvedValue({ success: true, updated: 1, commands: [] })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_ENVELOPE })

    await v1Sensors(deviceEvent('test-key'))
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
})
