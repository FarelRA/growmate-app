import { describe, it, expect } from 'vitest'
import {
  extractNalUnits,
  getNalType,
  isKeyframeNal,
  isParameterSetNal,
  isVclNal,
} from '~~/server/utils/stream/nalParser'
import { buildSegmentFileName, segmentFilePath } from '~~/server/utils/stream/segmentStore'

const SC4 = Buffer.from([0x00, 0x00, 0x00, 0x01])
const SC3 = Buffer.from([0x00, 0x00, 0x01])

describe('nalParser', () => {
  it('frames complete NALs split across 4-byte start codes', () => {
    const buf = Buffer.concat([SC4, Buffer.from([0x67, 0x70]), SC4, Buffer.from([0x65, 0x99]), SC4])
    const { units, rest } = extractNalUnits(buf)
    expect(units).toHaveLength(2)
    expect([...units[0]!]).toEqual([0x67, 0x70])
    expect([...units[1]!]).toEqual([0x65, 0x99])
    expect(rest).toHaveLength(0)
  })

  it('frames complete NALs split across 3-byte start codes', () => {
    const buf = Buffer.concat([SC3, Buffer.from([0x41, 0x01]), SC3])
    const { units, rest } = extractNalUnits(buf)
    expect(units).toHaveLength(1)
    expect([...units[0]!]).toEqual([0x41, 0x01])
    expect(rest).toHaveLength(0)
  })

  it('returns trailing incomplete bytes as rest and drops empty units', () => {
    const buf = Buffer.concat([SC4, SC4, Buffer.from([0x41])])
    const { units, rest } = extractNalUnits(buf)
    expect(units).toHaveLength(0)
    expect([...rest]).toEqual([0x41])
  })

  it('keeps buffers without a start code untouched', () => {
    const buf = Buffer.from([0xaa, 0xbb])
    const { units, rest } = extractNalUnits(buf)
    expect(units).toHaveLength(0)
    expect(rest).toBe(buf)
  })

  it('classifies NAL types', () => {
    expect(getNalType(Buffer.from([0x65]))).toBe(5)
    expect(getNalType(Buffer.alloc(0))).toBeUndefined()
    expect(isVclNal(1)).toBe(true)
    expect(isVclNal(7)).toBe(false)
    expect(isParameterSetNal(7)).toBe(true)
    expect(isParameterSetNal(8)).toBe(true)
    expect(isKeyframeNal(5)).toBe(true)
    expect(isKeyframeNal(1)).toBe(false)
  })
})

describe('segmentStore naming', () => {
  it('builds timestamped .h264 file names under the device dir', () => {
    const now = new Date(2026, 0, 2, 3, 4, 5)
    expect(buildSegmentFileName(now)).toBe('20260102_030405.h264')
    expect(segmentFilePath('dev-1', now)).toBe(
      `${process.env.GROWMATE_SEGMENT_DIR ?? '/var/growmate/segments'}/dev-1/20260102_030405.h264`,
    )
  })
})
