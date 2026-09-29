import { ConvexError } from 'convex/values'

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ConvexError) {
    if (error.data) return String(error.data)
    return fallback
  }

  if (error instanceof Error && error.message) {
    if (import.meta.client) {
      console.warn('[getErrorMessage] Unhandled non-ConvexError:', error)
    }
    return error.message
  }

  return fallback
}
