import type { H3Event, EventHandlerRequest } from 'h3'

let misconfiguredLogged = false

export function requireDeviceKey(event: H3Event<EventHandlerRequest>): string {
  const expected = process.env.DEVICE_API_KEY
  if (!expected) {
    if (!misconfiguredLogged) {
      misconfiguredLogged = true
      console.error('DEVICE_API_KEY is not set — rejecting device request (server misconfigured)')
    }
    throw createError({ statusCode: 500, statusMessage: 'server misconfigured' })
  }
  const provided = getHeader(event, 'x-api-key')
  if (!provided || provided !== expected) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return provided
}

export default requireDeviceKey
