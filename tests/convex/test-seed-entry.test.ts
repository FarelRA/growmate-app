/**
 * Seed entry-point wiring test (no live backend required).
 *
 * Guards the `convex:seed:*` <-> `convex/seed.ts` contract statically:
 * `convex run <module>:<fn>` resolves purely by module export name, so
 * parsing package.json targets against seed.ts exports simulates `convex
 * run` resolution without a deployment.
 *
 * Structure: `convex/seed.ts` is the thin CLI entry — it re-exports the
 * dataset handlers from `convex/seed/*.ts` and owns the `comprehensive`
 * orchestrator. Resolution follows re-exports, so this test resolves the
 * effective export set as direct `export const` defs in seed.ts plus
 * `export { ... } from './seed/<module>'` re-exports, verified against
 * the defining submodule.
 *
 * Invariants enforced:
 *  1. Every `convex:seed:*` script targets an export that exists in seed.ts
 *     (directly or via re-export from `convex/seed/*.ts`).
 *  2. Every seed.ts effective export is targeted by exactly one script (no
 *     orphans, no dual entry points).
 *  3. `convex:seed:all` is a single `convex run seed:comprehensive` (no
 *     npm-chained multi-invoke path duplicating `comprehensive`).
 *  4. `comprehensive` orchestrates all 8 dataset entries via runAction.
 *  5. All seed.ts effective exports stay `internalAction` (CLI/dashboard-
 *     runnable but never client-callable over HTTP; widening to public
 *     `action` would let any client trigger seed writes).
 *  6. Every re-export resolves to an `export const <name> = internalAction(`
 *     definition in the referenced `convex/seed/*.ts` submodule.
 *
 * The handlers themselves are NOT invoked here: they require
 * ctx.runQuery/runMutation/runAction (absent from the repo's db-only fake
 * ctx), plus live MinIO/Auth and 1.6MB of fixture data — an integration
 * concern, not a unit one.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}
const seedSrc = readFileSync(join(root, 'convex/seed.ts'), 'utf8')
const seedDir = join(root, 'convex/seed')
const seedModules: Record<string, string> = {}
for (const f of readdirSync(seedDir).filter((f) => f.endsWith('.ts'))) {
  seedModules[f.replace(/\.ts$/, '')] = readFileSync(join(seedDir, f), 'utf8')
}

/** Script name -> `convex run` target. The full contract; keep in sync. */
const SCRIPT_TARGETS: Record<string, string> = {
  'convex:seed:admin': 'seed:admin',
  'convex:seed:plants': 'seed:plants',
  'convex:seed:users': 'seed:users',
  'convex:seed:devices': 'seed:devices',
  'convex:seed:claims': 'seed:processClaims',
  'convex:seed:products': 'seed:products',
  'convex:seed:community': 'seed:community',
  'convex:seed:blog': 'seed:blog',
  'convex:seed:all': 'seed:comprehensive',
}

/** The 8 dataset entries orchestrated by `comprehensive`, in run order. */
const DATASET_FNS = [
  'admin',
  'plants',
  'users',
  'devices',
  'processClaims',
  'products',
  'community',
  'blog',
] as const

const DEF_RE =
  /export const (\w+) = (internalAction|action|internalQuery|query|internalMutation|mutation)\(/g
const REEXPORT_RE = /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g

/** export name -> builder used, across seed.ts + convex/seed/*.ts. */
function allDefinitions(): Map<string, { builder: string; file: string }> {
  const defs = new Map<string, { builder: string; file: string }>()
  for (const m of seedSrc.matchAll(DEF_RE)) {
    defs.set(m[1]!, { builder: m[2]!, file: 'convex/seed.ts' })
  }
  for (const [mod, src] of Object.entries(seedModules)) {
    for (const m of src.matchAll(DEF_RE)) {
      defs.set(`${mod}:${m[1]!}`, { builder: m[2]!, file: `convex/seed/${mod}.ts` })
    }
  }
  return defs
}

/**
 * Effective `convex run seed:<fn>` surface: direct `export const` defs in
 * seed.ts plus `export { ... } from './seed/<module>'` re-exports resolved
 * against the defining submodule. Returns export name -> builder + origin.
 */
function seedExports(): Array<[string, string]> {
  const defs = allDefinitions()
  const out = new Map<string, string>()
  for (const m of seedSrc.matchAll(DEF_RE)) {
    out.set(m[1]!, m[2]!)
  }
  for (const m of seedSrc.matchAll(REEXPORT_RE)) {
    const target = m[2]!
    const modMatch = target.match(/^\.\/seed\/(\w+)$/)
    if (!modMatch) continue
    const mod = modMatch[1]!
    for (const name of m[1]!.split(',')) {
      const trimmed = name.trim()
      if (!trimmed) continue
      // `export { foo }` or `export { foo as bar }`
      const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/)
      const srcName = asMatch ? asMatch[1]! : trimmed
      const exportName = asMatch ? asMatch[2]! : trimmed
      const def = defs.get(`${mod}:${srcName}`)
      if (!def) {
        throw new Error(
          `seed.ts re-exports '${exportName}' from './seed/${mod}' but '${srcName}' is not defined there`,
        )
      }
      out.set(exportName, def.builder)
    }
  }
  return [...out.entries()]
}

function runTarget(script: string): string {
  const cmd: string = pkg.scripts[script]
  const m = cmd?.match(/convex run (\S+)/)
  if (!m) throw new Error(`script ${script} has no 'convex run <target>'`)
  return m[1]!
}

describe('seed entry wiring', () => {
  it('declares exactly the contracted convex:seed:* scripts (no extras, none missing)', () => {
    const actual = Object.keys(pkg.scripts)
      .filter((s) => s.startsWith('convex:seed:'))
      .sort()
    expect(actual).toEqual(Object.keys(SCRIPT_TARGETS).sort())
  })

  it('every script target resolves to an export in convex/seed.ts', () => {
    const exported = new Set(seedExports().map(([name]) => name))
    for (const [script, want] of Object.entries(SCRIPT_TARGETS)) {
      expect(runTarget(script)).toBe(want)
      const [, fn] = want.split(':')
      expect(exported.has(fn!), `${script} -> ${want} has no matching export`).toBe(true)
    }
  })

  it('every seed.ts export is invoked by exactly one script (no orphans, no dual paths)', () => {
    const targets = Object.values(SCRIPT_TARGETS)
    const counts = new Map<string, number>()
    for (const t of targets) counts.set(t, (counts.get(t) ?? 0) + 1)
    for (const [name] of seedExports()) {
      expect(counts.get(`seed:${name}`) ?? 0).toBe(1)
    }
  })

  it('convex:seed:all is a single comprehensive run, not an npm chain', () => {
    expect(pkg.scripts['convex:seed:all']).toBe('convex run seed:comprehensive')
    expect(pkg.scripts['convex:seed:all']).not.toContain('&&')
  })

  it('comprehensive orchestrates all 8 dataset entries via runAction', () => {
    const body = seedSrc.slice(seedSrc.indexOf('export const comprehensive'))
    for (const fn of DATASET_FNS) {
      expect(body).toContain(`internal.seed.${fn}`)
    }
  })

  it('all seed.ts exports stay internalAction (never client-reachable)', () => {
    for (const [, builder] of seedExports()) {
      expect(builder).toBe('internalAction')
    }
  })

  it('every re-export resolves to an internalAction definition in convex/seed/*.ts', () => {
    const defs = allDefinitions()
    const reexports = [...seedSrc.matchAll(REEXPORT_RE)].filter((m) =>
      m[2]!.startsWith('./seed/'),
    )
    expect(reexports.length).toBeGreaterThan(0)
    for (const m of reexports) {
      const mod = m[2]!.replace('./seed/', '')
      expect(seedModules[mod]).toBeDefined()
      for (const name of m[1]!.split(',')) {
        const trimmed = name.trim()
        if (!trimmed) continue
        const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/)
        const srcName = asMatch ? asMatch[1]! : trimmed
        const def = defs.get(`${mod}:${srcName}`)
        expect(def, `'${srcName}' must be defined in convex/seed/${mod}.ts`).toBeDefined()
        expect(def!.builder).toBe('internalAction')
        expect(def!.file).toBe(`convex/seed/${mod}.ts`)
      }
    }
  })
})
