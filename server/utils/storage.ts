import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'

let _client: S3Client | null = null
const _bucketPromises = new Map<string, Promise<void>>()

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

export async function ensureBucket(bucket: string): Promise<void> {
  if (_bucketPromises.has(bucket)) return _bucketPromises.get(bucket)!

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
        _bucketPromises.delete(bucket)
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
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    )
  })()

  _bucketPromises.set(bucket, promise)
  return promise
}

export async function uploadFile(
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
