import { randomUUID } from 'node:crypto'
import type { EventHandler, EventHandlerRequest } from 'h3'

/**
 * Firmware route boundary (/v1/*): the stock firmware speaks only JSON and
 * never follows redirects, so every outcome — including errors — must be a
 * JSON body. Thrown H3Errors outside /api/** render as Nuxt's HTML error
 * page (status preserved, body useless to a device), hence this boundary
 * converts: H3 status/message verbatim, no request-URL echo, plus a short
 * request id echoed in the X-Request-Id header, the body, and the server
 * log line for correlation.
 */
export function defineFirmwareHandler<T extends EventHandlerRequest>(
  handler: EventHandler<T>,
): EventHandler<T> {
  return defineEventHandler<T>(async (event) => {
    const requestId = randomUUID().slice(0, 8)
    if (!event.context) event.context = {}
    event.context.requestId = requestId
    setResponseHeader(event, 'X-Request-Id', requestId)
    try {
      return await handler(event)
    } catch (error: unknown) {
      const statusCode =
        error instanceof Error && 'statusCode' in error && typeof error.statusCode === 'number'
          ? error.statusCode
          : 500
      const statusMessage =
        error instanceof Error && 'statusMessage' in error && typeof error.statusMessage === 'string' && error.statusMessage
          ? error.statusMessage
          : 'Server Error'
      if (statusCode >= 500) {
        console.error(`[firmware ${requestId}] ${event.method} ${event.path} failed:`, error)
      }
      setResponseStatus(event, statusCode)
      return { statusCode, statusMessage, message: statusMessage, requestId }
    }
  })
}
