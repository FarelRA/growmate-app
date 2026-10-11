/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockMutation, mockProcessImage, mockGenerateHash, mockUploadFile } =
  vi.hoisted(() => ({
    mockMutation: vi.fn(),
    mockProcessImage: vi.fn(),
    mockGenerateHash: vi.fn(),
    mockUploadFile: vi.fn(),
  }))

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    sensors: {
      ingestAndAckSensorData: 'ingestAndAckSensorData',
      ingestCameraImage: 'ingestCameraImage',
    },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    mutation: mockMutation,
  }),
}))

vi.mock('~~/server/utils/images', () => ({
  processImage: mockProcessImage,
  generateHash: mockGenerateHash,
}))

vi.mock('~~/server/utils/storage', () => ({
  uploadFile: mockUploadFile,
}))

const REQUIRE_SRC = '../../../server/utils/requireDeviceKey'
const INGEST_SRC = '../../../server/utils/ingestHandler'
const CAMERA_SRC = '../../../server/api/v1/camera.post'

const VALID_BODY = {
  deviceId: 'dev-1',
  sensors: [{ kind: 'soil', unit: '%', raw: 100 }],
}

function mockEvent(bearerKey?: string) {
  const event: any = { headers: new Headers() }
  if (bearerKey !== undefined) event.headers.set('authorization', `Bearer ${bearerKey}`)
  return event
}

function mockCameraSuccess() {
  mockGenerateHash.mockReturnValue('hash123')
  mockProcessImage.mockResolvedValue([{ size: 50, buffer: Buffer.from('s50') }])
  mockUploadFile.mockResolvedValue(undefined)
  mockMutation.mockResolvedValue(undefined)
  vi.mocked(globalThis.readRawBody).mockResolvedValue('fake-body')
}

function cameraEvent(bearerKey?: string) {
  const event = mockEvent(bearerKey)
  event.headers.set('x-device-id', 'device-1')
  return event
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  mockProcessImage.mockReset()
  mockGenerateHash.mockReset()
  mockUploadFile.mockReset()
  globalThis.getHeader = vi.fn(
    (event: any, name: string) => event.headers?.get(name) ?? undefined,
  ) as any
  globalThis.readBody = vi.fn() as any
  globalThis.readRawBody = vi.fn() as any
})

afterEach(() => {
  delete process.env.DEVICE_API_KEY
})

describe('requireDeviceKey fail-closed', () => {
  it('returns 500 server misconfigured when env is unset (ingest, no passthrough)', async () => {
    vi.resetModules()
    delete process.env.DEVICE_API_KEY
    const { default: handleSensorIngest } = await import(INGEST_SRC)
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_BODY })

    await expect(handleSensorIngest(mockEvent('any-key'))).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'server misconfigured',
    })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('returns 500 for every device route when env is unset (no passthrough)', async () => {
    vi.resetModules()
    delete process.env.DEVICE_API_KEY
    const { default: cameraHandler } = await import(CAMERA_SRC)
    mockCameraSuccess()

    await expect(cameraHandler(cameraEvent('any-key'))).rejects.toMatchObject({
      statusCode: 500,
    })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('logs the misconfiguration only once', async () => {
    vi.resetModules()
    delete process.env.DEVICE_API_KEY
    const { requireDeviceKey } = await import(REQUIRE_SRC)
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    try {
      expect(() => requireDeviceKey(mockEvent('k'))).toThrowError(
        expect.objectContaining({ statusCode: 500 }),
      )
      expect(() => requireDeviceKey(mockEvent('k'))).toThrowError(
        expect.objectContaining({ statusCode: 500 }),
      )
      expect(errSpy).toHaveBeenCalledTimes(1)
    } finally {
      errSpy.mockRestore()
    }
  })
})

describe('requireDeviceKey wrong/missing client key', () => {
  it('returns 401 for wrong Bearer token on all device routes (no passthrough)', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'secret-key'
    const { default: handleSensorIngest } = await import(INGEST_SRC)
    const { default: cameraHandler } = await import(CAMERA_SRC)
    mockCameraSuccess()
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_BODY })

    await expect(handleSensorIngest(mockEvent('wrong-key'))).rejects.toMatchObject({
      statusCode: 401,
    })
    await expect(cameraHandler(cameraEvent('wrong-key'))).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('returns 401 when the Authorization Bearer header is missing', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'secret-key'
    const { default: handleSensorIngest } = await import(INGEST_SRC)
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_BODY })

    await expect(handleSensorIngest(mockEvent())).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('returns 401 when the Authorization header is not a Bearer token', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'secret-key'
    const { requireDeviceKey } = await import(REQUIRE_SRC)
    const event: any = { headers: new Headers() }
    event.headers.set('authorization', 'secret-key')

    expect(() => requireDeviceKey(event)).toThrowError(
      expect.objectContaining({ statusCode: 401 }),
    )
  })
})

describe('valid Bearer key passes deviceKey through to Convex', () => {
  it('ingest passes deviceKey to ingestAndAckSensorData', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: handleSensorIngest } = await import(INGEST_SRC)
    mockMutation.mockResolvedValue({ commands: [] })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_BODY })

    const result = await handleSensorIngest(mockEvent('test-key'))
    expect(result).toEqual({ commands: [] })
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestAndAckSensorData',
      expect.objectContaining({ deviceId: 'dev-1', deviceKey: 'test-key' }),
    )
  })

  it('camera passes deviceKey to ingestCameraImage', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: cameraHandler } = await import(CAMERA_SRC)
    mockCameraSuccess()

    const result = await cameraHandler(cameraEvent('test-key'))
    expect(result).toEqual({ success: true, path: 'hash123' })
    expect(mockMutation).toHaveBeenCalledWith(
      'ingestCameraImage',
      expect.objectContaining({ deviceId: 'device-1', deviceKey: 'test-key' }),
    )
  })
})
