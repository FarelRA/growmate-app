import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { convexErrorToH3Status } from '../../../server/utils/convexErrors'

describe('convexErrorToH3Status', () => {
  it('maps coded Convex validation failures to their real status', () => {
    expect(
      convexErrorToH3Status(new ConvexError({ statusCode: 400, message: 'deviceId tidak valid' })),
    ).toEqual({ statusCode: 400, statusMessage: 'deviceId tidak valid' })
    expect(
      convexErrorToH3Status(new ConvexError({ statusCode: 409, message: 'ID perangkat tersebut sudah digunakan' })),
    ).toEqual({ statusCode: 409, statusMessage: 'ID perangkat tersebut sudah digunakan' })
    expect(convexErrorToH3Status(new ConvexError({ statusCode: 401, message: 'Unauthorized' }))).toEqual(
      { statusCode: 401, statusMessage: 'Unauthorized' },
    )
  })

  it('passes H3-shaped errors through untouched', async () => {
    const { createError } = await import('h3')
    const h3 = createError({ statusCode: 429, statusMessage: 'Rate limited' })
    expect(convexErrorToH3Status(h3)).toEqual({ statusCode: 429, statusMessage: 'Rate limited' })
  })

  it('collapses plain errors, strings, and out-of-range codes to generic 500', () => {
    expect(convexErrorToH3Status(new Error('boom'))).toEqual({
      statusCode: 500,
      statusMessage: 'Server Error',
    })
    expect(convexErrorToH3Status(new ConvexError('plain string'))).toEqual({
      statusCode: 500,
      statusMessage: 'Server Error',
    })
    expect(convexErrorToH3Status(new ConvexError({ statusCode: 99, message: 'bogus' }))).toEqual({
      statusCode: 500,
      statusMessage: 'Server Error',
    })
    expect(convexErrorToH3Status(new ConvexError({ statusCode: 400, message: '' }))).toEqual({
      statusCode: 500,
      statusMessage: 'Server Error',
    })
  })
})
