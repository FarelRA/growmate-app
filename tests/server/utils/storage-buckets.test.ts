import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockSend, S3ClientMock, PutBucketPolicyMock, CreateBucketMock } = vi.hoisted(() => {
  const send = vi.fn()
  return {
    mockSend: send,
    S3ClientMock: vi.fn(function () {
      return { send }
    }),
    PutBucketPolicyMock: vi.fn(),
    CreateBucketMock: vi.fn(),
  }
})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: S3ClientMock,
  PutObjectCommand: vi.fn(),
  HeadBucketCommand: vi.fn(),
  CreateBucketCommand: CreateBucketMock,
  PutBucketPolicyCommand: PutBucketPolicyMock,
  DeleteObjectCommand: vi.fn(),
}))

function notFound() {
  return Object.assign(new Error('Not found'), { name: 'NotFound' })
}

beforeEach(() => {
  vi.resetModules()
  mockSend.mockReset()
  S3ClientMock.mockClear()
  PutBucketPolicyMock.mockClear()
  CreateBucketMock.mockClear()
  delete process.env.RUSTFS_ENDPOINT
  delete process.env.RUSTFS_ACCESS_KEY
  delete process.env.RUSTFS_SECRET_KEY
  delete process.env.NUXT_PUBLIC_RUSTFS_BASE_URL
})

describe('bucket visibility split', () => {
  it('grants public GetObject policy for public buckets (images)', async () => {
    mockSend.mockRejectedValueOnce(notFound())
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('images', { publicRead: true })

    expect(CreateBucketMock).toHaveBeenCalledTimes(1)
    expect(PutBucketPolicyMock).toHaveBeenCalledTimes(1)
    const input = PutBucketPolicyMock.mock.calls[0]![0] as { Bucket: string; Policy: string }
    expect(input.Bucket).toBe('images')
    const policy = JSON.parse(input.Policy) as {
      Statement: Array<{
        Effect: string
        Principal: { AWS: string[] }
        Action: string[]
        Resource: string[]
      }>
    }
    expect(policy.Statement).toHaveLength(1)
    expect(policy.Statement[0]).toMatchObject({
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: ['arn:aws:s3:::images/*'],
    })
  })

  it('applies NO bucket policy for private buckets (recordings stay 403 by default)', async () => {
    mockSend.mockRejectedValueOnce(notFound())
    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('recordings', { publicRead: false })

    expect(CreateBucketMock).toHaveBeenCalledTimes(1)
    expect(PutBucketPolicyMock).not.toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledTimes(2)
  })

  it('leaves existing private buckets untouched (no create, no policy)', async () => {
    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('recordings', { publicRead: false })

    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(CreateBucketMock).not.toHaveBeenCalled()
    expect(PutBucketPolicyMock).not.toHaveBeenCalled()
  })

  it('uploadFile propagates publicRead:false for recordings (no policy)', async () => {
    mockSend.mockRejectedValueOnce(notFound())
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)

    const { uploadFile } = await import('../../../../server/utils/storage')
    await uploadFile('recordings', 'dev-1/stream/a.h264', Buffer.from('data'), 'video/h264', {
      publicRead: false,
    })

    expect(CreateBucketMock).toHaveBeenCalledTimes(1)
    expect(PutBucketPolicyMock).not.toHaveBeenCalled()
  })

  it('uploadFile propagates publicRead:true for images (policy applied)', async () => {
    mockSend.mockRejectedValueOnce(notFound())
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)
    mockSend.mockResolvedValueOnce(undefined)

    const { uploadFile } = await import('../../../../server/utils/storage')
    await uploadFile('images', 'hash/50w.webp', Buffer.from('data'), 'image/webp', {
      publicRead: true,
    })

    expect(PutBucketPolicyMock).toHaveBeenCalledTimes(1)
  })
})

describe('presigned URL host', () => {
  it('signing client uses the PUBLIC host, not the internal endpoint', async () => {
    process.env.RUSTFS_ENDPOINT = 'http://rustfs:9000'
    process.env.NUXT_PUBLIC_RUSTFS_BASE_URL = 'https://storage.example.com'

    const { s3PublicClient } = await import('../../../../server/utils/storage')
    s3PublicClient()

    expect(S3ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://storage.example.com' }),
    )
  })

  it('strips trailing slashes from the public base URL', async () => {
    process.env.NUXT_PUBLIC_RUSTFS_BASE_URL = 'https://storage.example.com/'

    const { s3PublicClient } = await import('../../../../server/utils/storage')
    s3PublicClient()

    expect(S3ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://storage.example.com' }),
    )
  })

  it('server transport still uses the internal endpoint when a public URL is set', async () => {
    process.env.RUSTFS_ENDPOINT = 'http://rustfs:9000'
    process.env.NUXT_PUBLIC_RUSTFS_BASE_URL = 'https://storage.example.com'
    mockSend.mockResolvedValueOnce(undefined)

    const { ensureBucket } = await import('../../../../server/utils/storage')
    await ensureBucket('images', { publicRead: true })

    expect(S3ClientMock).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'http://rustfs:9000' }),
    )
  })
})
