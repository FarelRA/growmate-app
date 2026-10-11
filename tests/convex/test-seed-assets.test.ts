/**
 * Seed asset externalization test (no live backend required).
 *
 * Contract: seed image bytes live as files in `public/seed-images/<hash>/`,
 * dataset modules carry only content hashes, and all four image-seeding
 * handlers share `uploadSeedImageSet` from `convex/seed/images.ts`.
 *
 * Invariants enforced:
 *  1. No `data:image` URIs remain anywhere in `convex/seedData/`.
 *  2. Every hash referenced by a dataset resolves to 5 valid webp files
 *     (`50w/200w/400w/800w/1200w`) with RIFF....WEBP magic.
 *  3. `plants/products/blog/community` handlers use the shared uploader —
 *     no per-file `parseDataUri` copies.
 *  4. `devices.ts` is deterministic (no `Math.random` at module load).
 *  5. `community.ts` scales moduli off `userIds.length` (no hardcoded `% 20`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const seedDataDir = join(root, 'convex/seedData')
const seedDir = join(root, 'convex/seed')
const assetDir = join(root, 'public/seed-images')
const SIZES = ['50w', '200w', '400w', '800w', '1200w'] as const

function readSeedData(name: string): string {
  return readFileSync(join(seedDataDir, name), 'utf8')
}

/** All content hashes referenced as `hash: "<hex>"` in image datasets. */
function referencedHashes(): Set<string> {
  const out = new Set<string>()
  for (const f of ['plants.ts', 'products.ts', 'blog.ts', 'communityListings.ts', 'communityPosts.ts']) {
    for (const m of readSeedData(f).matchAll(/hash:\s*"([0-9a-f]{8,})"/g)) {
      out.add(m[1]!)
    }
  }
  return out
}

describe('seed image externalization', () => {
  it('has no inline data-URI images in any seedData module', () => {
    for (const f of readdirSync(seedDataDir).filter((f) => f.endsWith('.ts'))) {
      expect(readSeedData(f), `${f} must not inline image bytes`).not.toContain('data:image')
    }
  })

  it('every referenced hash resolves to 5 valid webp asset files', () => {
    const hashes = referencedHashes()
    expect(hashes.size).toBeGreaterThan(0)
    for (const hash of hashes) {
      for (const size of SIZES) {
        const file = join(assetDir, hash, `${size}.webp`)
        const stat = statSync(file)
        expect(stat.size, `${hash}/${size} must be non-trivial`).toBeGreaterThan(50)
        const head = readFileSync(file).subarray(0, 12)
        expect(head.subarray(0, 4).toString('ascii'), `${hash}/${size} RIFF magic`).toBe('RIFF')
        expect(head.subarray(8, 12).toString('ascii'), `${hash}/${size} WEBP magic`).toBe('WEBP')
      }
    }
  })

  it('image handlers share uploadSeedImageSet (no parseDataUri copies)', () => {
    for (const mod of ['plants.ts', 'products.ts', 'blog.ts', 'community.ts']) {
      const src = readFileSync(join(seedDir, mod), 'utf8')
      expect(src, `${mod} uses shared uploader`).toContain('uploadSeedImageSet')
      expect(src, `${mod} has no local data-uri parser`).not.toContain('parseDataUri')
      expect(src, `${mod} has no local size list`).not.toContain('IMAGE_SIZES_FOR_SEED')
    }
  })

  it('devices dataset is deterministic', () => {
    expect(readSeedData('devices.ts')).not.toContain('Math.random')
  })

  it('community handler scales off actual user count', () => {
    const src = readFileSync(join(seedDir, 'community.ts'), 'utf8')
    expect(src).toContain('userIds.length')
    expect(src).not.toMatch(/% 20\b/)
  })
})
