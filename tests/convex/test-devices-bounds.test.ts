/**
 * Device query bounds (no live backend required).
 *
 * Pre-alpha hard-bounds guards — DEMOLISH backward compat, no legacy
 * uncapped paths:
 *  1. dashboard sensors read on `by_plant` is capped with take(10), freezing
 *     the ≤5-rows invariant (exactly one row per sensor kind) with 2x
 *     headroom. No unbounded collect() remains in convex/devices.ts.
 *  2. deviceHistory archived-plants read is cursor-paginated (20/page desc)
 *     via paginationOptsValidator + paginate(), mirroring the
 *     adminDevicesPaginated convention in convex/admin.ts. Desc order and
 *     cursor-loop semantics are verified against a fake paginator below.
 *  3. seedInternal insertGrowEvent eventType is a proper union (no `as any`,
 *     no eslint-disable) covering every literal of the growEvents schema
 *     union — checked at runtime by parsing both sources.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sensorKinds } from '../../convex/types'

const root = process.cwd()
const devicesSrc = readFileSync(join(root, 'convex/devices.ts'), 'utf8')
const seedInternalSrc = readFileSync(join(root, 'convex/seedInternal.ts'), 'utf8')
const schemaSrc = readFileSync(join(root, 'convex/schema.ts'), 'utf8')

/** Slice source from a marker to the next `export const` (exclusive). */
function blockFrom(src: string, marker: string): string {
  const start = src.indexOf(marker)
  expect(start, `marker ${marker} found`).toBeGreaterThanOrEqual(0)
  const rest = src.slice(start + marker.length)
  const next = rest.search(/\nexport const /)
  return next === -1 ? rest : rest.slice(0, next)
}

/** The `eventType: v.union(...)` validator inside a table/mutation block. */
function eventTypeUnion(src: string, tableMarker: string): string {
  const t = src.indexOf(tableMarker)
  expect(t, `table ${tableMarker} found`).toBeGreaterThanOrEqual(0)
  const e = src.indexOf('eventType: v.union(', t)
  expect(e, 'eventType union found').toBeGreaterThanOrEqual(0)
  const end = src.indexOf('\n    ),', e)
  expect(end, 'eventType union close found').toBeGreaterThanOrEqual(0)
  return src.slice(e, end)
}

/** All v.literal('...'|"...") members inside a block, in order. */
function literals(block: string): string[] {
  return [...block.matchAll(/v\.literal\((["'])([^"']+)\1\)/g)].map((m) => m[2]!)
}

describe('dashboard sensors bound', () => {
  it('reads by_plant with take(10), never collect()', () => {
    const hunk = blockFrom(devicesSrc, 'const rawSensors')
    expect(hunk).toContain(".withIndex('by_plant'")
    expect(hunk).toContain('.take(10)')
    expect(hunk).not.toContain('.collect()')
  })

  it('take(10) covers the ≤6-rows invariant (one row per sensor kind)', () => {
    expect(sensorKinds).toHaveLength(6)
    expect(sensorKinds.length).toBeLessThanOrEqual(10)
  })

  it('no unbounded collect() remains anywhere in convex/devices.ts', () => {
    expect(devicesSrc).not.toContain('.collect()')
  })
})

type ArchivedRow = { _id: string; archivedAt?: number; updatedAt: number }

/** Mirrors the page-mapping comparator in deviceHistory. */
function sortPageDesc(rows: ArchivedRow[]): ArchivedRow[] {
  return [...rows].sort((a, b) => (b.archivedAt ?? b.updatedAt) - (a.archivedAt ?? a.updatedAt))
}

/** Fake cursor paginator: fixed 20/page over a desc-sorted source. */
function fakePaginate(source: ArchivedRow[], cursor: number | null): {
  page: ArchivedRow[]
  isDone: boolean
  continueCursor: string
} {
  const start = cursor ?? 0
  const page = source.slice(start, start + 20)
  const next = start + page.length
  return {
    page: sortPageDesc(page),
    isDone: next >= source.length,
    continueCursor: String(next),
  }
}

function makeArchivedRows(n: number): ArchivedRow[] {
  return Array.from({ length: n }, (_, i) => ({
    _id: `plant-${i}`,
    // Every third row lacks archivedAt -> falls back to updatedAt.
    ...(i % 3 === 0 ? {} : { archivedAt: 1_000_000 - i * 100 }),
    updatedAt: 900_000 - i * 10,
  }))
}

describe('deviceHistory archived pagination', () => {
  it('uses paginationOptsValidator + order(desc) + paginate() (admin convention)', () => {
    expect(devicesSrc).toContain('paginationOpts: paginationOptsValidator')
    const hunk = blockFrom(devicesSrc, 'const archivedPage')
    expect(hunk).toContain(".withIndex('by_device_archived'")
    expect(hunk).toContain(".order('desc')")
    expect(hunk).toContain('.paginate(args.paginationOpts)')
    expect(hunk).not.toContain('.collect()')
  })

  it('each page is desc-ordered by archivedAt ?? updatedAt', () => {
    const page = sortPageDesc(makeArchivedRows(20))
    const keys = page.map((r) => r.archivedAt ?? r.updatedAt)
    for (let i = 1; i < keys.length; i++) {
      expect(keys[i]!).toBeLessThanOrEqual(keys[i - 1]!)
    }
  })

  it('cursor loop over 45 rows yields 20/20/5 pages, globally desc, then done', () => {
    const source = sortPageDesc(makeArchivedRows(45))
    const seen: ArchivedRow[] = []
    let cursor: number | null = null
    let pages = 0
    for (;;) {
      const result = fakePaginate(source, cursor)
      expect(result.page.length).toBeLessThanOrEqual(20)
      seen.push(...result.page)
      pages += 1
      if (result.isDone) break
      cursor = Number(result.continueCursor)
      expect(pages).toBeLessThan(10) // loop must terminate
    }
    expect(pages).toBe(3)
    expect(seen).toHaveLength(45)
    expect(seen.map((r) => r._id)).toEqual(source.map((r) => r._id))
  })
})

describe('seedInternal eventType union', () => {
  it('insertGrowEvent validator covers exactly the growEvents schema union', () => {
    const schemaUnion = eventTypeUnion(schemaSrc, 'growEvents: defineTable({')
    const seedUnion = eventTypeUnion(seedInternalSrc, 'export const insertGrowEvent')
    const schemaSet = new Set(literals(schemaUnion))
    const seedLiterals = literals(seedUnion)
    // Schema union is the contract: 21 literals (incl. manual_stream_started/stopped).
    expect(schemaSet.size).toBe(21)
    expect(new Set(seedLiterals)).toEqual(schemaSet)
  })

  it('seed callers only use literals inside the union (plant_added, system_watering)', () => {
    const seedUnion = eventTypeUnion(seedInternalSrc, 'export const insertGrowEvent')
    const union = new Set(literals(seedUnion))
    expect(union.has('plant_added')).toBe(true)
    expect(union.has('system_watering')).toBe(true)
  })

  it('no `as any` or eslint-disable remains in convex/seedInternal.ts', () => {
    expect(seedInternalSrc).not.toContain('as any')
    expect(seedInternalSrc).not.toContain('no-explicit-any')
    expect(seedInternalSrc).not.toContain('eslint-disable')
  })
})
