/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Minimal in-memory fake of the Convex `ctx` object.
 *
 * Shared by `test-ingest-rules.test.ts` and `test-marketplace.test.ts` so
 * mutation handlers can be invoked directly via their `_handler` (no
 * `convex-test` dependency — adding deps is out of scope for this worker).
 *
 * Supports the db surface used by the handlers under test:
 * `get` / `insert` / `patch` / `delete`, and `query(table)` with
 * `.withIndex(name, q => q.eq(...).eq(...))`, `.order()`, `.take()`,
 * `.collect()`, `.first()`. Index names are ignored; `eq` filters are
 * applied in memory and `order()` follows insertion order (like Convex's
 * `_creationTime` ordering for the small datasets used here).
 *
 * NOTE: this file intentionally has no `.test.ts` suffix so vitest does
 * not run it as a suite.
 *
 * NOTE (index-order caveat): FakeQueryRunner ignores index names and serves
 * rows in insertion order (_seq), never real Convex index order — do not
 * trust this fake for index-ordering assertions; verify those on real Convex.
 */

type Doc = Record<string, any>

interface EqFilter {
  field: string
  value: unknown
}

class FakeQueryRunner {
  private getDocs: () => Doc[]
  private filters: EqFilter[]
  private desc: boolean

  constructor(getDocs: () => Doc[], filters: EqFilter[] = [], desc = false) {
    this.getDocs = getDocs
    this.filters = filters
    this.desc = desc
  }

  order(direction: 'asc' | 'desc'): FakeQueryRunner {
    return new FakeQueryRunner(this.getDocs, this.filters, direction === 'desc')
  }

  private run(): Doc[] {
    const out = this.getDocs().filter((d) => this.filters.every((f) => d[f.field] === f.value))
    out.sort((a, b) => (this.desc ? b._seq - a._seq : a._seq - b._seq))
    return out
  }

  async collect(): Promise<Doc[]> {
    return this.run()
  }

  async first(): Promise<Doc | null> {
    return this.run()[0] ?? null
  }

  async take(n: number): Promise<Doc[]> {
    return this.run().slice(0, n)
  }

  async unique(): Promise<Doc | null> {
    const rows = this.run()
    if (rows.length > 1) throw new Error('unique() matched multiple docs')
    return rows[0] ?? null
  }

  async paginate(opts: { cursor?: string | null; numItems?: number }): Promise<{
    page: Doc[]
    isDone: boolean
    continueCursor: string
  }> {
    const rows = this.run()
    const numItems = opts.numItems ?? 100
    const offset = opts.cursor ? Number(opts.cursor) : 0
    const page = rows.slice(offset, offset + numItems)
    const next = offset + numItems
    return {
      page,
      isDone: next >= rows.length,
      continueCursor: String(next),
    }
  }
}

export interface FakeDb {
  get: (id: string) => Promise<Doc | null>
  insert: (table: string, doc: Record<string, unknown>) => Promise<string>
  patch: (id: string, value: Record<string, unknown>) => Promise<void>
  delete: (id: string) => Promise<void>
  query: (table: string) => {
    withIndex: (name: string, fn: (q: any) => void) => FakeQueryRunner
    order: (direction: 'asc' | 'desc') => FakeQueryRunner
    collect: () => Promise<Doc[]>
    first: () => Promise<Doc | null>
    take: (n: number) => Promise<Doc[]>
    paginate: (opts: { cursor?: string | null; numItems?: number }) => Promise<{
      page: Doc[]
      isDone: boolean
      continueCursor: string
    }>
  }
  /** Raw table access for assertions. */
  all: (table: string) => Doc[]
}

export function createFakeDb(): FakeDb {
  const tables = new Map<string, Map<string, Doc>>()
  let seq = 0

  const tableMap = (name: string): Map<string, Doc> => {
    let m = tables.get(name)
    if (!m) {
      m = new Map()
      tables.set(name, m)
    }
    return m
  }

  const snapshot = (name: string): Doc[] => [...tableMap(name).values()]

  const db: FakeDb = {
    get: async (id: string) => {
      const key = String(id)
      for (const m of tables.values()) {
        const doc = m.get(key)
        if (doc) return doc
      }
      return null
    },
    insert: async (table: string, doc: Record<string, unknown>) => {
      seq += 1
      const id = `${table}|${seq}`
      const stored: Doc = { ...doc, _id: id, _seq: seq }
      tableMap(table).set(id, stored)
      return id
    },
    patch: async (id: string, value: Record<string, unknown>) => {
      const doc = await db.get(id)
      if (!doc) throw new Error(`patch: doc not found: ${id}`)
      Object.assign(doc, value)
    },
    delete: async (id: string) => {
      const key = String(id)
      for (const m of tables.values()) m.delete(key)
    },
    query: (table: string) => {
      const getDocs = () => snapshot(table)
      return {
        withIndex: (_name: string, fn: (q: any) => void) => {
          const filters: EqFilter[] = []
          const q: any = {
            eq: (field: string, value: unknown) => {
              filters.push({ field, value })
              return q
            },
          }
          fn(q)
          return new FakeQueryRunner(getDocs, filters)
        },
        order: (direction: 'asc' | 'desc') =>
          new FakeQueryRunner(getDocs, [], direction === 'desc'),
        collect: () => new FakeQueryRunner(getDocs).collect(),
        first: () => new FakeQueryRunner(getDocs).first(),
        take: (n: number) => new FakeQueryRunner(getDocs).take(n),
        paginate: (opts: { cursor?: string | null; numItems?: number }) =>
          new FakeQueryRunner(getDocs).paginate(opts),
      }
    },
    all: (table: string) => snapshot(table),
  }

  return db
}

export interface FakeCtx {
  db: FakeDb
  /** Read by the mocked `@convex-dev/auth/server` getAuthUserId. */
  __testUserId: string | null
}

/**
 * Build a fake mutation/query ctx. Pass `userId: null` for unauthenticated.
 * Each test file mocks `@convex-dev/auth/server` so `getAuthUserId(ctx)`
 * resolves to `ctx.__testUserId`.
 */
export function createFakeCtx(userId: string | null = null): FakeCtx {
  return { db: createFakeDb(), __testUserId: userId }
}

/** Invoke a registered mutation/query handler with a fake ctx. */
export async function callHandler(fn: any, ctx: FakeCtx, args: any): Promise<any> {
  return await fn._handler(ctx, args)
}
