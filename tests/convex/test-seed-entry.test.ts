/**
 * Seed entry-point wiring test (no live backend required).
 *
 * Guards the `convex:seed:*` <-> `convex/seed.ts` contract statically:
 * `convex run <module>:<fn>` resolves purely by module export name, so
 * parsing package.json targets against seed.ts exports simulates `convex
 * run` resolution without a deployment.
 *
 * Invariants enforced:
 *  1. Every `convex:seed:*` script targets an export that exists in seed.ts.
 *  2. Every seed.ts export is targeted by exactly one script (no orphans,
 *     no dual entry points).
 *  3. `convex:seed:all` is a single `convex run seed:comprehensive` (no
 *     npm-chained multi-invoke path duplicating `comprehensive`).
 *  4. `comprehensive` orchestrates all 8 dataset entries via runAction.
 *  5. All seed.ts exports stay `internalAction` (CLI/dashboard-runnable but
 *     never client-callable over HTTP; widening to public `action` would let
 *     any client trigger seed writes).
 *
 * The handlers themselves are NOT invoked here: they require
 * ctx.runQuery/runMutation/runAction (absent from the repo's db-only fake
 * ctx), plus live MinIO/Auth and 1.6MB of fixture data — an integration
 * concern, not a unit one.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}
const seedSrc = readFileSync(join(root, 'convex/seed.ts'), 'utf8')

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

/** export name -> builder used, e.g. ["admin", "internalAction"]. */
function seedExports(): Array<[string, string]> {
  const re = /export const (\w+) = (internalAction|action|internalQuery|query|internalMutation|mutation)\(/g
  return [...seedSrc.matchAll(re)].map((m) => [m[1]!, m[2]!])
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
})
