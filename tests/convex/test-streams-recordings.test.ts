import { describe, it, expect } from 'vitest'
import {
  DEFAULT_RECORDINGS_CAP,
  MAX_RECORDINGS_CAP,
  clampRecordingsLimit,
} from '../../convex/streams'
import {
  PLANT_IMAGES_PER_PLANT_CAP,
  NOTIFICATIONS_PER_USER_CAP,
  NOTIFICATIONS_TTL_DAYS,
  USER_ACTIVITIES_TTL_DAYS,
  retentionCutoff,
  overflowBeyondCap,
  encodeS3Key,
} from '../../convex/crons'

describe('listRecordings server-side limit', () => {
  it('defaults to 50 when no limit is requested', () => {
    expect(DEFAULT_RECORDINGS_CAP).toBe(50)
    expect(clampRecordingsLimit(undefined)).toBe(50)
  })

  it('caps the requested limit at 100', () => {
    expect(MAX_RECORDINGS_CAP).toBe(100)
    expect(clampRecordingsLimit(200)).toBe(100)
    expect(clampRecordingsLimit(100)).toBe(100)
  })

  it('passes through limits under the cap', () => {
    expect(clampRecordingsLimit(20)).toBe(20)
    expect(clampRecordingsLimit(1)).toBe(1)
  })

  it('floors negative limits at 0 and falls back for NaN', () => {
    expect(clampRecordingsLimit(-5)).toBe(0)
    expect(clampRecordingsLimit(Number.NaN)).toBe(50)
  })
})

describe('retention helpers', () => {
  it('exposes the required retention caps and TTLs', () => {
    expect(PLANT_IMAGES_PER_PLANT_CAP).toBe(50)
    expect(NOTIFICATIONS_PER_USER_CAP).toBe(50)
    expect(NOTIFICATIONS_TTL_DAYS).toBe(30)
    expect(USER_ACTIVITIES_TTL_DAYS).toBe(90)
  })

  it('computes TTL cutoffs in milliseconds', () => {
    const now = 1_000_000_000_000
    expect(retentionCutoff(now, 30)).toBe(now - 30 * 24 * 60 * 60 * 1000)
    expect(retentionCutoff(now, 90)).toBe(now - 90 * 24 * 60 * 60 * 1000)
  })

  it('selects only items beyond the cap for deletion (oldest last)', () => {
    const newestFirst = [5, 4, 3, 2, 1]
    expect(overflowBeyondCap(newestFirst, 50)).toEqual([])
    expect(overflowBeyondCap(newestFirst, 5)).toEqual([])
    expect(overflowBeyondCap(newestFirst, 3)).toEqual([2, 1])
  })

  it('encodes S3 keys per path segment', () => {
    expect(encodeS3Key('dev1/stream/20240101_120000.h264')).toBe('dev1/stream/20240101_120000.h264')
    expect(encodeS3Key('dev 1/stream/a b.h264')).toBe('dev%201/stream/a%20b.h264')
  })
})
