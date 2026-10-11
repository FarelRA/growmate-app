import { describe, it, expect, beforeEach } from 'vitest'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  extractJpegs,
  ingestVideoBytes,
  getLatestFrame,
  getStreamCounters,
  subscribeFrames,
  resetVideoLiveState,
  startLiveSession,
  appendLiveBytes,
  endLiveSession,
  discardLiveSpool,
  VIDEO_MAX_SESSION_BYTES,
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
    const res = ingestVideoBytes('IAFT01', 'vid-1', chunk, 0)
    expect(res.frames).toBe(2)
    expect(res.nextSeq).toBe(9)

    const latest = getLatestFrame('IAFT01')
    expect(latest?.seq).toBe(8)
    expect(latest?.videoId).toBe('vid-1')
    expect(getStreamCounters('IAFT01')).toMatchObject({ frames: 2 })
  })

  it('fans out to subscribers and isolates devices', () => {
    const seen: number[] = []
    const unsub = subscribeFrames('IAFT01', (frame) => seen.push(frame.seq))
    ingestVideoBytes('IAFT01', 'vid-1', fakeJpeg(3), 0)
    ingestVideoBytes('OTHER', 'vid-9', fakeJpeg(4), 0)
    expect(seen).toEqual([0])
    expect(getLatestFrame('OTHER')?.videoId).toBe('vid-9')
    unsub()
    ingestVideoBytes('IAFT01', 'vid-1', fakeJpeg(5), 1)
    expect(seen).toEqual([0])
  })
})

describe('live session spool', () => {
  it('start/append/end roundtrips bytes to a spool file with correct stats', async () => {
    await startLiveSession('TECH-SPOOL', 'vid-1')
    const chunkA = Buffer.from('--frame\r\nContent-Type: image/jpeg\r\n\r\nfake-jpeg-a\r\n')
    const chunkB = Buffer.from('--frame\r\nContent-Type: image/jpeg\r\n\r\nfake-jpeg-b\r\n')
    appendLiveBytes('TECH-SPOOL', chunkA)
    appendLiveBytes('TECH-SPOOL', chunkB)

    const ended = await endLiveSession('TECH-SPOOL')
    expect(ended).not.toBeNull()
    expect(ended!.videoId).toBe('vid-1')
    expect(ended!.bytes).toBe(chunkA.length + chunkB.length)
    expect(ended!.truncated).toBe(false)
    expect(ended!.startedAt).toBeLessThanOrEqual(Date.now())
    expect(ended!.durationMs).toBeGreaterThanOrEqual(0)

    const onDisk = await fs.readFile(ended!.path)
    expect(Buffer.concat([chunkA, chunkB]).equals(onDisk)).toBe(true)

    await discardLiveSpool(ended!.path)
  })

  it('end with no session returns null', async () => {
    expect(await endLiveSession('TECH-NOPE')).toBeNull()
  })

  it('second start unlinks the previous spool file', async () => {
    await startLiveSession('TECH-REPLACE', 'vid-1')
    appendLiveBytes('TECH-REPLACE', Buffer.from('first-bytes'))
    const entries = await fs.readdir(tmpdir())
    const first = entries.find((e) => e.startsWith('growmate-live-TECH-REPLACE-'))
    expect(first).toBeDefined()
    const firstPath = join(tmpdir(), first!)

    await startLiveSession('TECH-REPLACE', 'vid-2')
    await expect(fs.stat(firstPath)).rejects.toThrow()

    const ended = await endLiveSession('TECH-REPLACE')
    expect(ended?.videoId).toBe('vid-2')
    if (ended) await discardLiveSpool(ended.path)
  })

  it('exposes a 256MB cap and does not truncate small appends', async () => {
    expect(VIDEO_MAX_SESSION_BYTES).toBe(256 * 1024 * 1024)
    await startLiveSession('TECH-CAP', 'vid-1')
    appendLiveBytes('TECH-CAP', Buffer.from('tiny'))
    const ended = await endLiveSession('TECH-CAP')
    expect(ended!.truncated).toBe(false)
    expect(ended!.bytes).toBe(Buffer.from('tiny').length)
    await discardLiveSpool(ended!.path)
  })

  it('discardLiveSpool removes the file', async () => {
    await startLiveSession('TECH-DISCARD', 'vid-1')
    appendLiveBytes('TECH-DISCARD', Buffer.from('data'))
    const ended = await endLiveSession('TECH-DISCARD')
    expect(ended).not.toBeNull()
    await fs.stat(ended!.path)
    await discardLiveSpool(ended!.path)
    await expect(fs.stat(ended!.path)).rejects.toThrow()
  })

  it('resetVideoLiveState removes spool files', async () => {
    await startLiveSession('TECH-RESET', 'vid-1')
    appendLiveBytes('TECH-RESET', Buffer.from('data'))
    const entries = await fs.readdir(tmpdir())
    const name = entries.find((e) => e.startsWith('growmate-live-TECH-RESET-'))
    expect(name).toBeDefined()
    const spoolPath = join(tmpdir(), name!)
    await fs.stat(spoolPath)

    resetVideoLiveState()
    await new Promise((resolve) => setTimeout(resolve, 50))
    await expect(fs.stat(spoolPath)).rejects.toThrow()
    expect(await endLiveSession('TECH-RESET')).toBeNull()
  })
})
