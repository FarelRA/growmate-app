/**
 * Maps errors from Convex device mutations back to H3 errors.
 *
 * Convex validation failures are thrown as coded errors (see codedError in
 * convex/sensors.ts: `{ statusCode, message }` object data, which survives
 * Convex serialization on the client's `.data`). Without this mapping every
 * one of them surfaced as a generic 500 — and devices retry 500s that can
 * never succeed. Anything unrecognized stays a 500.
 */
export function convexErrorToH3Status(error: unknown): { statusCode: number; statusMessage: string } {
  const data = (error as { data?: unknown } | null)?.data
  const candidate = typeof data === 'string' ? tryParseCoded(data) : data
  if (
    candidate !== null &&
    typeof candidate === 'object' &&
    !Array.isArray(candidate) &&
    Number.isInteger((candidate as { statusCode?: unknown }).statusCode)
  ) {
    const statusCode = (candidate as { statusCode: number }).statusCode
    const message = (candidate as { message?: unknown }).message
    if (statusCode >= 400 && statusCode <= 599 && typeof message === 'string' && message.length > 0) {
      return { statusCode, statusMessage: message }
    }
  }
  if (error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number') {
    const statusCode = error.statusCode
    const statusMessage =
      'statusMessage' in error && typeof error.statusMessage === 'string' && error.statusMessage
        ? error.statusMessage
        : 'Server Error'
    return { statusCode, statusMessage }
  }
  return { statusCode: 500, statusMessage: 'Server Error' }
}

function tryParseCoded(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/** Throw the mapped H3 error (never returns). */
export function throwMappedConvexError(error: unknown): never {
  const { statusCode, statusMessage } = convexErrorToH3Status(error)
  throw createError({ statusCode, statusMessage })
}

/** True for H3 errors (thrown by requireDeviceKey, validators, Convex mocks). */
export function isH3Error(error: unknown): boolean {
  return (
    error instanceof Error &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
  )
}
