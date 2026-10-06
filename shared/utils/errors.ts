interface ConvexErrorLike {
  readonly name?: unknown
  readonly message?: unknown
  readonly data?: unknown
}

function asErrorLike(error: unknown): ConvexErrorLike | null {
  if (typeof error !== 'object' || error === null) return null
  return error as ConvexErrorLike
}

export function getErrorMessage(error: unknown, fallback: string) {
  const like = asErrorLike(error)
  if (like?.name === 'ConvexError') {
    if (like.data) return String(like.data)
    return fallback
  }

  if (error instanceof Error && error.message) {
    console.warn('[getErrorMessage] Unhandled non-ConvexError:', error)
    return error.message
  }

  return fallback
}
