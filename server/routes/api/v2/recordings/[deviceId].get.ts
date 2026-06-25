import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { api } from '~~/convex/_generated/api'
import { useConvexAuth } from '~~/server/utils/convex'
import { s3Client, RECORDINGS_BUCKET } from '~~/server/utils/storage'

export default defineEventHandler(async (event) => {
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const token = authHeader.slice(7)
  const convex = useConvexAuth(token)

  let isAuthenticated = false
  try {
    isAuthenticated = await convex.query(api.auth.isAuthenticated, {})
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  if (!isAuthenticated) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const deviceId = getRouterParam(event, 'deviceId')
  if (!deviceId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing deviceId' })
  }

  const device = await convex.query(api.devices.getUnclaimedDevice, { deviceId })
  if (!device) {
    throw createError({ statusCode: 404, statusMessage: 'Device not found' })
  }

  const recordings = await convex.query(api.streams.listRecordings, {
    deviceId,
    limit: 50,
  })

  const client = s3Client()
  const recordingsWithUrls = await Promise.all(recordings.map(async (rec) => {
    const command = new GetObjectCommand({
      Bucket: RECORDINGS_BUCKET,
      Key: rec.path,
    })
    const downloadUrl = await getSignedUrl(client, command, { expiresIn: 3600 })
    return { ...rec, downloadUrl }
  }))

  return { recordings: recordingsWithUrls }
})
