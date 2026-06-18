/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest'
import { ConvexError } from 'convex/values'
import { getErrorMessage } from '../../../app/lib/errors'

describe('getErrorMessage', () => {
  const fallback = 'Terjadi kesalahan'

  it('returns message for standard Error', () => {
    const error = new Error('Something went wrong')
    expect(getErrorMessage(error, fallback)).toBe('Something went wrong')
  })

  it('returns fallback for standard Error with empty message', () => {
    const error = new Error('')
    expect(getErrorMessage(error, fallback)).toBe(fallback)
  })

  it('returns fallback for string thrown value', () => {
    expect(getErrorMessage('string error', fallback)).toBe(fallback)
  })

  it('returns fallback for number thrown value', () => {
    expect(getErrorMessage(42, fallback)).toBe(fallback)
  })

  it('returns fallback for null', () => {
    expect(getErrorMessage(null, fallback)).toBe(fallback)
  })

  it('returns fallback for undefined', () => {
    expect(getErrorMessage(undefined, fallback)).toBe(fallback)
  })

  it('returns fallback for object without message', () => {
    expect(getErrorMessage({ code: 500 }, fallback)).toBe(fallback)
  })

  it('returns fallback when error has no message property', () => {
    const error = new Error()
    delete (error as any).message
    expect(getErrorMessage(error, fallback)).toBe(fallback)
  })

  it('returns data from ConvexError', () => {
    const error = new ConvexError('Database connection failed')
    expect(getErrorMessage(error, fallback)).toBe('Database connection failed')
  })

  it('returns ConvexError data even when it is an object', () => {
    const error = new ConvexError({ code: 'RATE_LIMITED', message: 'Too fast' })
    expect(getErrorMessage(error, fallback)).toBe('[object Object]')
  })

  it('returns fallback for ConvexError with empty data', () => {
    const error = new ConvexError('')
    expect(getErrorMessage(error, fallback)).toBe(fallback)
  })
})
