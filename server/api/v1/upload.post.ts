import { api } from '~~/convex/_generated/api'
import { useConvexAuth } from '~~/server/utils/convex'
import { runUploadPipeline } from '~~/server/utils/uploadPipeline'

export default defineEventHandler(async (event) => {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const token = authHeader.slice(7).trim()
    if (!token) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

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

    const parts = await readMultipartFormData(event)
    if (!parts || parts.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    }

    const file = parts.find((p) => p.name === 'file' && p.data && p.data.length > 0)
    if (!file) {
      throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    }

    if (!file.type?.startsWith('image/')) {
      throw createError({ statusCode: 400, statusMessage: 'File must be an image' })
    }

    const input = file.data
    const { path: pathPrefix } = await runUploadPipeline(input)

    return { path: pathPrefix }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Image upload failed:', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
