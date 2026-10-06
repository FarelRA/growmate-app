/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockMutation, mockConnect, mockProcessImage, mockGenerateHash, mockUploadFile } =
  vi.hoisted(() => ({
    mockMutation: vi.fn(),
    mockConnect: vi.fn(),
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
    streams: {
      registerStream: 'registerStream',
      recordStreamSegment: 'recordStreamSegment',
    },
  },
}))

vi.mock('~~/server/utils/convex', () => ({
  useConvex: () => ({
    mutation: mockMutation,
  }),
}))

vi.mock('~~/server/utils/streamManager', () => ({
  streamManager: {
    connect: mockConnect,
  },
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
const REGISTER_SRC = '../../../server/api/v2/stream/register.post'
const RECORDING_SRC = '../../../server/api/v2/stream/recording.post'

const VALID_BODY = {
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

function mockEvent(apiKey?: string) {
  const event: any = { headers: new Headers() }
  if (apiKey !== undefined) event.headers.set('x-api-key', apiKey)
  return event
}

function mockCameraSuccess() {
  mockGenerateHash.mockReturnValue('hash123')
  mockProcessImage.mockResolvedValue([{ size: 50, buffer: Buffer.from('s50') }])
  mockUploadFile.mockResolvedValue(undefined)
  mockMutation.mockResolvedValue(undefined)
  vi.mocked(globalThis.readRawBody).mockResolvedValue('fake-body')
}

function cameraEvent(apiKey?: string) {
  const event = mockEvent(apiKey)
  event.headers.set('x-device-id', 'device-1')
  return event
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMutation.mockReset()
  mockConnect.mockReset()
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

    await expect(handleSensorIngest(mockEvent('any-key'), 'v1')).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: 'server misconfigured',
    })
    expect(mockMutation).not.toHaveBeenCalled()
  })

  it('returns 500 for every device route when env is unset (no passthrough)', async () => {
    vi.resetModules()
    delete process.env.DEVICE_API_KEY
    const { default: cameraHandler } = await import(CAMERA_SRC)
    const { default: registerHandler } = await import(REGISTER_SRC)
    const { default: recordingHandler } = await import(RECORDING_SRC)
    mockCameraSuccess()
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_STREAM })

    await expect(cameraHandler(cameraEvent('any-key'))).rejects.toMatchObject({
      statusCode: 500,
    })
    await expect(registerHandler(mockEvent('any-key'))).rejects.toMatchObject({
      statusCode: 500,
    })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SEGMENT })
    await expect(recordingHandler(mockEvent('any-key'))).rejects.toMatchObject({
      statusCode: 500,
    })
    expect(mockMutation).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
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
  it('returns 401 for wrong key on all device routes (no passthrough)', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'secret-key'
    const { default: handleSensorIngest } = await import(INGEST_SRC)
    const { default: cameraHandler } = await import(CAMERA_SRC)
    const { default: registerHandler } = await import(REGISTER_SRC)
    const { default: recordingHandler } = await import(RECORDING_SRC)
    mockCameraSuccess()
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_BODY })

    await expect(handleSensorIngest(mockEvent('wrong-key'), 'v2')).rejects.toMatchObject({
      statusCode: 401,
    })
    await expect(cameraHandler(cameraEvent('wrong-key'))).rejects.toMatchObject({
      statusCode: 401,
    })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_STREAM })
    await expect(registerHandler(mockEvent('wrong-key'))).rejects.toMatchObject({
      statusCode: 401,
    })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SEGMENT })
    await expect(recordingHandler(mockEvent('wrong-key'))).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(mockMutation).not.toHaveBeenCalled()
    expect(mockConnect).not.toHaveBeenCalled()
  })

  it('returns 401 when the client key header is missing', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'secret-key'
    const { default: handleSensorIngest } = await import(INGEST_SRC)
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_BODY })

    await expect(handleSensorIngest(mockEvent(), 'v1')).rejects.toMatchObject({
      statusCode: 401,
    })
    expect(mockMutation).not.toHaveBeenCalled()
  })
})

describe('valid key passes deviceKey through to Convex', () => {
  it('ingest passes deviceKey to ingestAndAckSensorData', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: handleSensorIngest } = await import(INGEST_SRC)
    mockMutation.mockResolvedValue({ success: true, updated: 1, commands: [] })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_BODY })

    const result = await handleSensorIngest(mockEvent('test-key'), 'v2')
    expect(result.success).toBe(true)
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

  it('register passes deviceKey to registerStream', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: registerHandler } = await import(REGISTER_SRC)
    mockMutation.mockResolvedValue({ success: true })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_STREAM })

    const result = await registerHandler(mockEvent('test-key'))
    expect(result.success).toBe(true)
    expect(mockMutation).toHaveBeenCalledWith(
      'registerStream',
      expect.objectContaining({ deviceId: 'dev-1', deviceKey: 'test-key' }),
    )
    expect(mockConnect).toHaveBeenCalledWith('dev-1', '100.64.0.1', 8554)
  })

  it('recording passes deviceKey to recordStreamSegment', async () => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: recordingHandler } = await import(RECORDING_SRC)
    mockMutation.mockResolvedValue({ success: true })
    vi.mocked(globalThis.readBody).mockResolvedValue({ ...VALID_SEGMENT })

    const result = await recordingHandler(mockEvent('test-key'))
    expect(result).toEqual({ success: true })
    expect(mockMutation).toHaveBeenCalledWith(
      'recordStreamSegment',
      expect.objectContaining({ deviceId: 'dev-1', deviceKey: 'test-key' }),
    )
  })
})

describe('register SSRF guard', () => {
  const BLOCKED_URLS = [
    'tcp://localhost:8554',
    'tcp://127.0.0.1:8554',
    'tcp://127.1.2.3:8554',
    'tcp://0.0.0.0:8554',
    'tcp://device.local:8554',
    'tcp://169.254.169.254:80',
    'tcp://10.0.0.5:8554',
    'tcp://172.16.0.5:8554',
    'tcp://172.31.255.1:8554',
    'tcp://192.168.1.10:8554',
    'tcp://minio:9000',
    'tcp://convex:8000',
    'tcp://traefik:8080',
    'tcp://growmate:3000',
  ]

  it.each(BLOCKED_URLS)('rejects blocked host %s with 400 and logs the reason', async (streamUrl) => {
    vi.resetModules()
    process.env.DEVICE_API_KEY = 'test-key'
    const { default: registerHandler } = await import(REGISTER_SRC)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(globalThis.readBody).mockResolvedValue({ deviceId: 'dev-1', streamUrl })

    try {
      await expect(registerHandler(mockEvent('test-key'))).rejects.toMatchObject({
        statusCode: 400,
      })
      expect(mockMutation).not.toHaveBeenCalled()
      expect(mockConnect).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      warnSpy.mockRestore()
    }
  })

  it.each(['tcp://100.64.0.1:8554', 'tcp://172.15.0.1:8554', 'tcp://172.32.0.1:8554'])(
    'allows non-blocked host %s',
    async (streamUrl) => {
      vi.resetModules()
      process.env.DEVICE_API_KEY = 'test-key'
      const { default: registerHandler } = await import(REGISTER_SRC)
      mockMutation.mockResolvedValue({ success: true })
      vi.mocked(globalThis.readBody).mockResolvedValue({ deviceId: 'dev-1', streamUrl })

      const result = await registerHandler(mockEvent('test-key'))
      expect(result.success).toBe(true)
      expect(mockConnect).toHaveBeenCalledTimes(1)
    },
  )
})
