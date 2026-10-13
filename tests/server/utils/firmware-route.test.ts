import { describe, it, expect } from 'vitest'
import { defineFirmwareHandler } from '../../../server/utils/firmwareRoute'

function mockEvent() {
  return { context: {}, method: 'POST', path: '/v1/sensors' } as never
}

describe('defineFirmwareHandler', () => {
  it('passes successful results through untouched', async () => {
    const handler = defineFirmwareHandler(async () => ({ commands: [] }))
    await expect(handler(mockEvent())).resolves.toEqual({ commands: [] })
  })

  it('serializes H3 errors as JSON without the request URL', async () => {
    const { createError } = await import('h3')
    const handler = defineFirmwareHandler(async () => {
      throw createError({ statusCode: 400, statusMessage: 'deviceId is required' })
    })
    const result = (await handler(mockEvent())) as Record<string, unknown>
    expect(result).toMatchObject({
      statusCode: 400,
      statusMessage: 'deviceId is required',
      message: 'deviceId is required',
    })
    expect(result).not.toHaveProperty('url')
    expect(typeof result.requestId).toBe('string')
  })

  it('maps unexpected failures to generic JSON 500 with a request id', async () => {
    const handler = defineFirmwareHandler(async () => {
      throw new Error('sharp exploded')
    })
    const result = (await handler(mockEvent())) as Record<string, unknown>
    expect(result).toMatchObject({ statusCode: 500, statusMessage: 'Server Error' })
    expect(typeof result.requestId).toBe('string')
  })
})
