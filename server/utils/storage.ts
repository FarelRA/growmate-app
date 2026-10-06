import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'

let _client: S3Client | null = null
const _bucketPromises = new Map<string, Promise<void>>()

export const RECORDINGS_BUCKET = 'recordings'

function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? '',
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
      },
      region: 'auto',
      forcePathStyle: true,
    })
  }
  return _client
}

/** Browser-reachable MinIO base URL. Never the internal docker hostname. */
function publicBaseUrl(): string {
  const raw =
    process.env.NUXT_PUBLIC_MINIO_BASE_URL ??
    process.env.MINIO_ENDPOINT ??
    'http://localhost:9000'
  return raw.replace(/\/+$/, '')
}

/**
 * Signing-only S3 client pointed at the PUBLIC MinIO host.
 * Presigning is local crypto (no transport), so this client must use the
 * browser-reachable base URL — signing with the internal endpoint bakes an
 * unresolvable hostname (e.g. http://minio:9000) into every URL.
 * Built fresh per call so env changes are always honored.
 */
export function s3PublicClient(): S3Client {
  return new S3Client({
    endpoint: publicBaseUrl(),
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? '',
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
    },
    region: 'auto',
    forcePathStyle: true,
  })
}

export async function ensureBucket(bucket: string, opts: { publicRead: boolean }): Promise<void> {
  const cacheKey = `${bucket}:${opts.publicRead ? 'public' : 'private'}`
  if (_bucketPromises.has(cacheKey)) return _bucketPromises.get(cacheKey)!

  const promise = (async () => {
    const client = getClient()
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      return
    } catch (error) {
      const is404 =
        error instanceof Error && 'name' in error
          ? (error as { name: string }).name === 'NotFound'
          : false
      if (!is404) {
        _bucketPromises.delete(cacheKey)
        throw error
      }
    }

    await client.send(new CreateBucketCommand({ Bucket: bucket }))

    // Private buckets stay private by default (unauthenticated GETs 403).
    // Only image buckets get a public GetObject policy.
    if (!opts.publicRead) return

    await client.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    )
  })()

  _bucketPromises.set(cacheKey, promise)
  return promise
}

export function s3Client(): S3Client {
  return getClient()
}

export async function uploadFile(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
  opts: { publicRead: boolean },
): Promise<void> {
  await ensureBucket(bucket, opts)
  const client = getClient()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  )
}

export async function deleteS3Object(bucket: string, key: string): Promise<void> {
  const client = getClient()
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
