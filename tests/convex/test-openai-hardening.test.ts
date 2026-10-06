/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

vi.mock('@convex-dev/auth/server', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getAuthUserId: async (ctx: any) => ctx?.__testUserId ?? null,
  }
})

import {
  getAiBackendStatus,
  parseToolArguments,
  resolveClientTimezoneOffsetMinutes,
  executeTool,
} from '../../convex/openai'
import { sendAssistantMessage } from '../../convex/assistant'
import { createFakeCtx, callHandler, type FakeCtx } from './test-ingest-rules-fake'

const AI_KEYS = ['OPENAI_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_MODEL'] as const
const savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of AI_KEYS) savedEnv[key] = process.env[key]
})

afterEach(() => {
  for (const key of AI_KEYS) {
    const value = savedEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  vi.restoreAllMocks()
})

function setAiEnv(values: Partial<Record<(typeof AI_KEYS)[number], string | undefined>>) {
  for (const key of AI_KEYS) {
    const value = values[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

function readOpenAiSource(): string {
  const candidates = [
    resolve(process.cwd(), 'convex/openai.ts'),
    resolve(process.cwd(), 'projects/apps/growmate-app/convex/openai.ts'),
  ]
  for (const path of candidates) {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      // try next
    }
  }
  // Fallback relative to the test file location.
  return readFileSync(resolve(__dirname, '../../convex/openai.ts'), 'utf8')
}

/** Same gte-capable fake upgrade as the assistant suites + capturing scheduler. */
function withAssistantSupport(ctx: FakeCtx): FakeCtx {
  const calls: any[] = []
  ;(ctx as any).scheduler = {
    runAfter: async (...args: any[]) => {
      calls.push(args)
      return undefined
    },
  }
  ;(ctx as any).__schedulerCalls = calls
  const apply = (
    docs: any[],
    eq: { field: string; value: unknown }[],
    gte: { field: string; value: any }[],
  ) =>
    docs.filter(
      (d) => eq.every((f) => d[f.field] === f.value) && gte.every((f) => d[f.field] >= f.value),
    )
  const makeRunner = (
    docs: () => any[],
    eq: { field: string; value: unknown }[],
    gte: { field: string; value: any }[],
    desc: boolean,
  ) => {
    const run = () => {
      const out = apply(docs(), eq, gte)
      out.sort((a, b) => (desc ? b._seq - a._seq : a._seq - b._seq))
      return out
    }
    return {
      order: (dir: 'asc' | 'desc') => makeRunner(docs, eq, gte, dir === 'desc'),
      collect: async () => run(),
      first: async () => run()[0] ?? null,
      take: async (n: number) => run().slice(0, n),
      unique: async () => {
        const rows = run()
        if (rows.length > 1) throw new Error('unique() matched multiple docs')
        return rows[0] ?? null
      },
      paginate: async (opts: { cursor?: string | null; numItems?: number }) => {
        const rows = run()
        const numItems = opts.numItems ?? 100
        const offset = opts.cursor ? Number(opts.cursor) : 0
        const page = rows.slice(offset, offset + numItems)
        const next = offset + numItems
        return { page, isDone: next >= rows.length, continueCursor: String(next) }
      },
    }
  }
  ctx.db.query = ((table: string) => ({
    withIndex: (_name: string, fn: (q: any) => void) => {
      const eq: { field: string; value: unknown }[] = []
      const gte: { field: string; value: any }[] = []
      const q: any = {
        eq: (field: string, value: unknown) => {
          eq.push({ field, value })
          return q
        },
        gte: (field: string, value: any) => {
          gte.push({ field, value })
          return q
        },
      }
      fn(q)
      return makeRunner(() => ctx.db.all(table), eq, gte, false)
    },
    order: (dir: 'asc' | 'desc') => makeRunner(() => ctx.db.all(table), [], [], dir === 'desc'),
    collect: () => makeRunner(() => ctx.db.all(table), [], [], false).collect(),
    first: () => makeRunner(() => ctx.db.all(table), [], [], false).first(),
    take: (n: number) => makeRunner(() => ctx.db.all(table), [], [], false).take(n),
    paginate: (opts: { cursor?: string | null; numItems?: number }) =>
      makeRunner(() => ctx.db.all(table), [], [], false).paginate(opts),
  })) as any
  return ctx
}

describe('openai hardening: malformed tool args become a tool error, never a throw', () => {
  it('parseToolArguments returns ok:false without throwing on malformed JSON', () => {
    expect(() => parseToolArguments('{not-json')).not.toThrow()
    const bad = parseToolArguments('{not-json')
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(typeof bad.error).toBe('string')

    expect(parseToolArguments('')).toEqual({ ok: true, value: {} })
    expect(parseToolArguments('{"enabled":true}')).toEqual({
      ok: true,
      value: { enabled: true },
    })
    // Non-object JSON is not a valid tool-arg bag.
    expect(parseToolArguments('[1,2]').ok).toBe(false)
    expect(parseToolArguments('null').ok).toBe(false)
  })

  it('executeTool surfaces malformed args as a tool-error payload with no side effects', async () => {
    const runMutation = vi.fn(async () => {
      throw new Error('runMutation must not be called for malformed args')
    })
    const ctx = { runMutation } as any

    // executeTool rejects with a friendly parse error (not a raw SyntaxError
    // crash); the action handler catches this per-tool and pushes the
    // existing tool-error shape { ok:false, error } back to the model.
    const failure = await executeTool(ctx, {
      userId: 'users|1',
      name: 'trigger_watering',
      rawArguments: '{bad-json',
    }).then(
      () => {
        throw new Error('executeTool must reject on malformed args')
      },
      (error) => error,
    )
    expect(runMutation).not.toHaveBeenCalled()
    expect(failure).toBeInstanceOf(Error)
    expect(String((failure as Error).message)).toMatch(/bukan JSON valid/i)

    // Same envelope the tool loop pushes on every tool failure
    // (openai.ts handler: { role:'tool', content: JSON.stringify({ ok:false, error }) }).
    const toolContent = JSON.stringify({
      ok: false,
      error: failure instanceof Error ? failure.message : 'Tool execution failed.',
    })
    expect(JSON.parse(toolContent)).toMatchObject({ ok: false })
    expect(typeof JSON.parse(toolContent).error).toBe('string')
  })
})

describe('openai hardening: single live env source (gate and use cannot diverge)', () => {
  it('reads process.env from exactly one site and keeps no module-load snapshot', () => {
    const source = readOpenAiSource()
    const envReads = source.match(/process\?\.env|process\.env/g) ?? []
    expect(envReads).toHaveLength(1)
    expect(source).not.toMatch(/\bconst env\b/)
    expect(source).not.toMatch(/\benv\.OPENAI_/)
    expect(source).not.toMatch(/const OPENAI_(BASE_URL|MODEL) = env/)
  })

  it('gate reflects live env changes with no stale snapshot', () => {
    setAiEnv({
      OPENAI_BASE_URL: 'https://example.test/v1',
      OPENAI_API_KEY: 'sk-test',
      OPENAI_MODEL: 'test-model',
    })
    expect(getAiBackendStatus()).toEqual({ configured: true, missing: [] })

    // Mutating env after module load must be visible immediately — a stale
    // module-load snapshot would keep reporting configured here.
    delete process.env.OPENAI_API_KEY
    expect(getAiBackendStatus()).toEqual({ configured: false, missing: ['OPENAI_API_KEY'] })

    process.env.OPENAI_API_KEY = 'sk-rotated'
    expect(getAiBackendStatus()).toEqual({ configured: true, missing: [] })

    // BASE_URL/MODEL are part of the same live gate, not a frozen snapshot.
    process.env.OPENAI_BASE_URL = 'https://rotated.test/v1'
    process.env.OPENAI_MODEL = 'rotated-model'
    expect(getAiBackendStatus()).toEqual({ configured: true, missing: [] })
  })
})

describe('openai hardening: client timezone threads into create_schedule', () => {
  it('resolveClientTimezoneOffsetMinutes only accepts finite numbers (rounded)', () => {
    expect(resolveClientTimezoneOffsetMinutes(420)).toBe(420)
    expect(resolveClientTimezoneOffsetMinutes(420.7)).toBe(421)
    expect(resolveClientTimezoneOffsetMinutes(undefined)).toBeUndefined()
    expect(resolveClientTimezoneOffsetMinutes('420' as any)).toBeUndefined()
    expect(resolveClientTimezoneOffsetMinutes(NaN)).toBeUndefined()
    expect(resolveClientTimezoneOffsetMinutes(Infinity)).toBeUndefined()
  })

  it('executeTool forwards the client offset and falls back to server local when absent', async () => {
    const seen: any[] = []
    const ctx = {
      runMutation: vi.fn(async (_ref: any, args: any) => {
        seen.push(args)
        return { success: true }
      }),
    } as any
    const validArgs = JSON.stringify({
      title: 'Siram pagi',
      cadenceUnit: 'days',
      cadenceValue: 1,
      timeOfDayMinutes: 480,
    })

    await executeTool(ctx, {
      userId: 'users|1',
      name: 'create_schedule',
      rawArguments: validArgs,
      timezoneOffsetMinutes: 420,
    })
    expect(seen).toHaveLength(1)
    expect(seen[0].timezoneOffsetMinutes).toBe(420)

    seen.length = 0
    await executeTool(ctx, {
      userId: 'users|1',
      name: 'create_schedule',
      rawArguments: validArgs,
    })
    expect(seen).toHaveLength(1)
    expect(seen[0].timezoneOffsetMinutes).toBe(-new Date().getTimezoneOffset())
  })

  it('sendAssistantMessage threads client TZ into the scheduled AI context', async () => {
    const ctx = withAssistantSupport(createFakeCtx())
    const userId = await ctx.db.insert('users', { name: 'TZ', role: 'grower', tier: 'basic' })
    ctx.__testUserId = userId

    const res = await callHandler(sendAssistantMessage, ctx, {
      body: 'buatkan jadwal siram harian',
      timezoneOffsetMinutes: 420,
    })
    expect(res.success).toBe(true)
    const calls = (ctx as any).__schedulerCalls as any[]
    expect(calls).toHaveLength(1)
    expect(calls[0][2].context.clientTimezoneOffsetMinutes).toBe(420)
  })

  it('sendAssistantMessage omits client TZ when the client sends none (fallback path)', async () => {
    const ctx = withAssistantSupport(createFakeCtx())
    const userId = await ctx.db.insert('users', { name: 'TZ2', role: 'grower', tier: 'basic' })
    ctx.__testUserId = userId

    const res = await callHandler(sendAssistantMessage, ctx, { body: 'halo' })
    expect(res.success).toBe(true)
    const calls = (ctx as any).__schedulerCalls as any[]
    expect(calls).toHaveLength(1)
    expect(calls[0][2].context.clientTimezoneOffsetMinutes).toBeUndefined()
  })
})
