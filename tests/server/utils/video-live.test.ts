import { describe, it, expect, beforeEach } from 'vitest'
import {
  extractJpegs,
  ingestVideoBytes,
  getLatestFrame,
  getStreamCounters,
  subscribeFrames,
  resetVideoLiveState,
} from '~~/server/utils/videoLive'

function fakeJpeg(byte: number, len = 64): Buffer {
  const body = Buffer.alloc(len, byte)
  return Buffer.concat([Buffer.from([0xff, 0xd8]), body, Buffer.from([0xff, 0xd9])])
}

beforeEach(() => {
  resetVideoLiveState()
})

describe('extractJpegs', () => {
  it('finds complete frames and ignores partial data', () => {
    const chunk = Buffer.concat([Buffer.from('hdr'), fakeJpeg(1), Buffer.from('mid'), fakeJpeg(2), Buffer.from([0xff])])
    const out = extractJpegs(chunk)
    expect(out).toHaveLength(2)
    expect(out[0]![0]).toBe(0xff)
    expect(out[0]![1]).toBe(0xd8)
  })
})

describe('ingestVideoBytes', () => {
  it('parses multipart parts, honors X-Frame-Seq, and tracks latest', () => {
    const part = (seq: number, byte: number) =>
      Buffer.concat([
        Buffer.from(`--frame\r\nContent-Type: image/jpeg\r\nX-Frame-Seq: ${seq}\r\nContent-Length: 68\r\n\r\n`),
        fakeJpeg(byte),
        Buffer.from('\r\n'),
      ])
    const chunk = Buffer.concat([part(7, 1), part(8, 2)])
    const res = ingestVideoBytes('TECH01', 'vid-1', chunk, 0)
    expect(res.frames).toBe(2)
    expect(res.nextSeq).toBe(9)

    const latest = getLatestFrame('TECH01')
    expect(latest?.seq).toBe(8)
    expect(latest?.videoId).toBe('vid-1')
    expect(getStreamCounters('TECH01')).toMatchObject({ frames: 2 })
  })

  it('fans out to subscribers and isolates devices', () => {
    const seen: number[] = []
    const unsub = subscribeFrames('TECH01', (frame) => seen.push(frame.seq))
    ingestVideoBytes('TECH01', 'vid-1', fakeJpeg(3), 0)
    ingestVideoBytes('OTHER', 'vid-9', fakeJpeg(4), 0)
    expect(seen).toEqual([0])
    expect(getLatestFrame('OTHER')?.videoId).toBe('vid-9')
    unsub()
    ingestVideoBytes('TECH01', 'vid-1', fakeJpeg(5), 1)
    expect(seen).toEqual([0])
  })
})
