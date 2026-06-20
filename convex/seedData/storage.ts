import {
  S3Client,
  PutObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3'

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {}
}

function getClient(): S3Client {
  const env = getEnv()
  return new S3Client({
    endpoint: env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY ?? '',
      secretAccessKey: env.MINIO_SECRET_KEY ?? '',
    },
    region: 'auto',
    forcePathStyle: true,
  })
}

export async function ensureBucket(bucket: string): Promise<void> {
  const client = getClient()
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }))
    return
  } catch {
    // bucket doesn't exist, create it
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
}

export async function uploadFile(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
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
