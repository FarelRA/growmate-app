import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'

let _client: S3Client | null = null
let _bucketPromise: Promise<void> | null = null
let _bucketKnown = false

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

async function ensureBucket(bucket: string): Promise<void> {
  if (_bucketKnown) return

  if (_bucketPromise) return _bucketPromise

  _bucketPromise = (async () => {
    const client = getClient()
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }))
      _bucketKnown = true
      return
    } catch (error) {
      const is404 =
        error instanceof Error &&
        'name' in error
        ? (error as { name: string }).name === 'NotFound'
        : false
      if (!is404) {
        _bucketPromise = null
        throw error
      }
    }

    await client.send(new CreateBucketCommand({ Bucket: bucket }))

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
              Resource: [`arn:aws:s3:::${bucket}/uploads/*`],
            },
          ],
        }),
      }),
    )

    _bucketKnown = true
  })()

  return _bucketPromise
}

export async function uploadImage(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await ensureBucket(bucket)
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

export function getPublicUrl(key: string): string {
  const baseUrl =
    process.env.NUXT_PUBLIC_IMAGE_BASE_URL ?? 'https://images.growmate.bond'
  return `${baseUrl}/${key}`
}
