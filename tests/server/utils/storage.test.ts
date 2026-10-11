import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, S3ClientMock } = vi.hoisted(() => {
  const send = vi.fn()
  return {
    mockSend: send,
    S3ClientMock: vi.fn(function () {
      return { send }
    }),
  }
})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: S3ClientMock,
  PutObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
  CreateBucketCommand: vi.fn(),
  PutBucketPolicyCommand: vi.fn(),
}))

beforeEach(() => {
  vi.resetModules()
  mockSend.mockReset()
  S3ClientMock.mockClear()
  delete process.env.RUSTFS_ENDPOINT
  delete process.env.RUSTFS_ACCESS_KEY
  delete process.env.RUSTFS_SECRET_KEY
})

describe('ensureBucket', () => {
  it('creates bucket when it does not exist', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('Not found'), { name: 'NotFound' }))
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('test-bucket', { publicRead: true })

    expect(S3ClientMock).toHaveBeenCalledTimes(1)
    expect(S3ClientMock).toHaveBeenCalledWith({
      endpoint: 'http://localhost:9000',
      credentials: { accessKeyId: '', secretAccessKey: '' },
      region: 'auto',
      forcePathStyle: true,
    })
    expect(mockSend).toHaveBeenCalledTimes(3)
  })

  it('skips creation when bucket exists', async () => {
    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('existing-bucket', { publicRead: true })

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('returns cached promise for duplicate calls', async () => {
    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('same-bucket', { publicRead: true })
    await ensureBucket('same-bucket', { publicRead: true })

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('re-throws non-NotFound errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('Network error'))

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await expect(ensureBucket('faulty-bucket', { publicRead: true })).rejects.toThrow('Network error')
    expect(S3ClientMock).toHaveBeenCalledTimes(1)
  })

  it('uses env vars for client config', async () => {
    process.env.RUSTFS_ENDPOINT = 'https://storage.example.com'
    process.env.RUSTFS_ACCESS_KEY = 'access'
    process.env.RUSTFS_SECRET_KEY = 'secret'

    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('env-bucket', { publicRead: true })

    expect(S3ClientMock).toHaveBeenCalledWith({
      endpoint: 'https://storage.example.com',
      credentials: { accessKeyId: 'access', secretAccessKey: 'secret' },
      region: 'auto',
      forcePathStyle: true,
    })
  })
})

describe('uploadFile', () => {
  it('ensures bucket then uploads object', async () => {
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)

    const { uploadFile } = await import('../../../../server/utils/storage')
    await uploadFile('bucket', 'key/file.webp', Buffer.from('data'), 'image/webp', {
      publicRead: true,
    })

    expect(mockSend).toHaveBeenCalledTimes(2)
  })

  it('creates new bucket then uploads', async () => {
    mockSend.mockRejectedValueOnce(Object.assign(new Error('Not found'), { name: 'NotFound' }))
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)

    const { uploadFile } = await import('../../../../server/utils/storage')
    await uploadFile('new-bucket', 'path/img.webp', Buffer.from('img'), 'image/webp', {
      publicRead: true,
    })

    expect(mockSend).toHaveBeenCalledTimes(4)
  })

  it('throws on upload failure', async () => {
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockRejectedValueOnce(new Error('Upload failed'))

    const { uploadFile } = await import('../../../../server/utils/storage')
    await expect(
      uploadFile('bucket', 'key', Buffer.from('data'), 'text/plain', { publicRead: true }),
    ).rejects.toThrow('Upload failed')
  })
})
