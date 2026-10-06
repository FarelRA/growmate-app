/**
 * Pure H.264 Annex-B NAL framing.
 *
 * Byte-identical extraction logic for the TCP reassembly path: split an
 * accumulated buffer on 3- and 4-byte start codes, drop zero-length units,
 * and return the trailing incomplete bytes as `rest` for the next chunk.
 * No I/O, no timers, no sockets — safe to unit test in isolation.
 */

const START_CODE_4 = Buffer.from([0x00, 0x00, 0x00, 0x01])
const START_CODE_3 = Buffer.from([0x00, 0x00, 0x01])

export function findStartCode(
  buf: Buffer,
  offset: number,
): { pos: number; len: number } | null {
  for (const sc of [START_CODE_4, START_CODE_3]) {
    const pos = buf.indexOf(sc, offset)
    if (pos !== -1) return { pos, len: sc.length }
  }
  return null
}

export interface FramedNals {
  /** Complete non-empty NAL units (start codes stripped), in order. */
  units: Buffer[]
  /** Trailing bytes after the last start code; feed back with the next chunk. */
  rest: Buffer
}

export function extractNalUnits(buffer: Buffer): FramedNals {
  const first = findStartCode(buffer, 0)
  if (!first) return { units: [], rest: buffer }

  const units: Buffer[] = []
  let nalStart = first.pos + first.len
  let searchFrom = nalStart

  while (searchFrom < buffer.length) {
    const next = findStartCode(buffer, searchFrom)
    if (!next) break

    if (next.pos === nalStart) {
      searchFrom = next.pos + next.len
      nalStart = searchFrom
      continue
    }

    const nalUnit = buffer.subarray(nalStart, next.pos)
    if (nalUnit.length === 0) {
      searchFrom = next.pos + next.len
      nalStart = searchFrom
      continue
    }

    units.push(nalUnit)
    searchFrom = next.pos + next.len
    nalStart = searchFrom
  }

  return { units, rest: buffer.subarray(nalStart) }
}

/** H.264 NAL unit type from the first byte; undefined for empty units. */
export function getNalType(nalUnit: Buffer): number | undefined {
  const firstByte = nalUnit.at(0)
  if (firstByte === undefined) return undefined
  return firstByte & 0x1f
}

export function isVclNal(nalType: number): boolean {
  return nalType === 1 || nalType === 5
}

export function isParameterSetNal(nalType: number): boolean {
  return nalType === 7 || nalType === 8
}

export function isKeyframeNal(nalType: number): boolean {
  return nalType === 5
}
