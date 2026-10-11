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
import seedUsers, { demoUser } from '../../convex/seedData/users'
import seedDevices from '../../convex/seedData/devices'
import seedUserPlants from '../../convex/seedData/userPlants'
import seedPlants from '../../convex/seedData/plants'
import seedFieldCrops from '../../convex/seedData/fieldCrops'
import seedCommunityPosts from '../../convex/seedData/communityPosts'
import seedCommunityListings from '../../convex/seedData/communityListings'
import seedThreads from '../../convex/seedData/threads'
import seedTickets from '../../convex/seedData/tickets'
import seedDrafts from '../../convex/seedData/drafts'

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
  for (const f of ['plants.ts', 'fieldCrops.ts', 'products.ts', 'blog.ts', 'communityListings.ts', 'communityPosts.ts']) {
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

describe('seed fleet shape (36 users + demo, 41 devices)', () => {
  it('has 36 Javanese gmail growers with 22 advanced, plus an advanced demo', () => {
    expect(seedUsers).toHaveLength(36)
    expect(seedUsers.filter((u) => u.tier === 'advanced')).toHaveLength(22)
    expect(seedUsers.filter((u) => u.tier === 'basic')).toHaveLength(14)
    const emails = seedUsers.map((u) => u.email)
    expect(new Set(emails).size).toBe(36)
    const handles = seedUsers.map((u) => u.handle)
    expect(new Set(handles).size).toBe(36)
    for (const u of seedUsers) {
      expect(u.email).toMatch(/^[^@\s]+@gmail\.com$/)
      expect(u.role).toBe('grower')
    }
    expect(demoUser.tier).toBe('advanced')
    expect(demoUser.role).toBe('grower')
    expect(demoUser.email).toBe('demo@growmate.bond')
    expect(emails).not.toContain(demoUser.email)
  })

  it('has 18 Pods + 9 Tech + 14 Tech-Addon with spec hardware flags', () => {
    expect(seedDevices).toHaveLength(41)
    const ids = seedDevices.map((d) => d.deviceId)
    expect(new Set(ids).size).toBe(41)
    const pods = seedDevices.filter((d) => d.deviceId.startsWith('IAET-'))
    const tech = seedDevices.filter((d) => d.deviceId.startsWith('IAFU-'))
    const addon = seedDevices.filter((d) => d.deviceId.startsWith('IAFT-'))
    expect(pods).toHaveLength(18)
    expect(tech).toHaveLength(9)
    expect(addon).toHaveLength(14)
    for (const d of pods) {
      expect(d.version).toBe('v1')
      expect(d.firmwareVersion).toBe('2.1.3')
      expect(d.hasModem).toBe(false)
      expect(d.hasSolarPanel).toBe(false)
    }
    for (const d of tech) {
      expect(d.version).toBe('v2')
      expect(d.firmwareVersion).toBe('3.0.2')
      expect(d.hasModem).toBe(false)
      expect(d.hasSolarPanel).toBe(false)
    }
    for (const d of addon) {
      expect(d.version).toBe('v2')
      expect(d.firmwareVersion).toBe('3.0.2')
      expect(d.hasModem).toBe(true)
      expect(d.hasSolarPanel).toBe(true)
    }
    // Demo units are the heads of each range
    for (const id of ['IAET-01', 'IAET-02', 'IAFU-01', 'IAFT-01', 'IAFT-02']) {
      expect(ids).toContain(id)
    }
  })

  it('plants cover every device exactly once (36 users + 5 demo)', () => {
    expect(seedUserPlants).toHaveLength(41)
    const regular = seedUserPlants.filter((p) => !p.demo)
    const demo = seedUserPlants.filter((p) => p.demo)
    expect(regular).toHaveLength(36)
    expect(demo).toHaveLength(5)
    expect(regular.map((p) => p.userIndex).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 36 }, (_, i) => i),
    )
    expect(demo.map((p) => p.deviceId).sort()).toEqual(
      ['IAET-01', 'IAET-02', 'IAFU-01', 'IAFT-01', 'IAFT-02'].sort(),
    )
    const deviceIds = new Set(seedDevices.map((d) => d.deviceId))
    const plantDevices = seedUserPlants.map((p) => p.deviceId)
    expect(new Set(plantDevices).size).toBe(41)
    for (const id of plantDevices) {
      expect(deviceIds.has(id), `plant references unknown device ${id}`).toBe(true)
    }
    const catalogKeys = new Set([
      ...seedPlants.map((p) => p.key),
      ...seedFieldCrops.map((p) => p.key),
    ])
    expect(seedPlants.length + seedFieldCrops.length).toBeGreaterThanOrEqual(510)
    for (const p of seedUserPlants) {
      expect(catalogKeys.has(p.catalogKey), `unknown catalog key ${p.catalogKey}`).toBe(true)
    }
  })

  it('community posts are authentic: every user posts >= 2, comments 2-6, no images', () => {
    expect(seedCommunityPosts.length).toBeGreaterThanOrEqual(72)
    const perUser = new Map<number, number>()
    for (const p of seedCommunityPosts) {
      perUser.set(p.userIndex, (perUser.get(p.userIndex) ?? 0) + 1)
      expect(p.title.length).toBeGreaterThan(5)
      expect(p.body.length).toBeGreaterThan(20)
      expect(p.image, `post "${p.title}" must have no image`).toBeUndefined()
      expect(p.comments.length, `post "${p.title}" comments`).toBeGreaterThanOrEqual(2)
      expect(p.comments.length, `post "${p.title}" comments`).toBeLessThanOrEqual(6)
      expect(p.likes.length, `post "${p.title}" likes`).toBeGreaterThanOrEqual(2)
      for (const c of p.comments) {
        expect(c.userIndex).toBeGreaterThanOrEqual(0)
        expect(c.userIndex).toBeLessThan(36)
        expect(c.body.length).toBeGreaterThan(3)
      }
      for (const l of p.likes) {
        expect(l).toBeGreaterThanOrEqual(0)
        expect(l).toBeLessThan(36)
        expect(l, 'liker must not be the author').not.toBe(p.userIndex)
      }
    }
    for (let i = 0; i < 36; i++) {
      expect(perUser.get(i) ?? 0, `user ${i} must post >= 2`).toBeGreaterThanOrEqual(2)
    }
  })

  it('marketplace threads reference real listings and users', () => {
    const titles = new Set(seedCommunityListings.map((l) => l.title))
    expect(seedThreads.length).toBeGreaterThanOrEqual(10)
    for (const t of seedThreads) {
      expect(titles.has(t.productTitle), `unknown listing ${t.productTitle}`).toBe(true)
      expect(t.buyerIndex).toBeGreaterThanOrEqual(0)
      expect(t.buyerIndex).toBeLessThan(36)
      expect(t.messages.length).toBeGreaterThanOrEqual(2)
      for (const m of t.messages) {
        expect(['buyer', 'seller']).toContain(m.from)
        expect(m.body.length).toBeGreaterThan(3)
        expect(m.dayAgo).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('support tickets and drafts are well-formed', () => {
    expect(seedTickets.length).toBeGreaterThanOrEqual(8)
    for (const t of seedTickets) {
      expect(t.userIndex).toBeGreaterThanOrEqual(0)
      expect(t.userIndex).toBeLessThan(36)
      expect(['open', 'in_progress', 'resolved', 'closed']).toContain(t.status)
      expect(['low', 'normal', 'high', 'urgent']).toContain(t.priority)
      expect(t.messages.length).toBeGreaterThanOrEqual(1)
      for (const m of t.messages) expect(['user', 'admin']).toContain(m.from)
    }
    expect(seedDrafts.length).toBeGreaterThanOrEqual(10)
    for (const d of seedDrafts) {
      expect(d.userIndex).toBeGreaterThanOrEqual(0)
      expect(d.userIndex).toBeLessThan(36)
      expect(['draft', 'published', 'archived']).toContain(d.status)
      expect(['chat', 'pickup', 'delivery']).toContain(d.contactPreference)
      expect(d.price).toBeGreaterThan(0)
    }
  })

  it('field-crop catalog is well-formed (unique keys, pod/field division)', () => {
    expect(seedFieldCrops.length).toBeGreaterThanOrEqual(500)
    const keys = seedFieldCrops.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    const originalKeys = new Set(seedPlants.map((p) => p.key))
    for (const k of keys) {
      expect(originalKeys.has(k), `field crop collides with original key ${k}`).toBe(false)
    }
    const validCats = new Set(['herb', 'leafy', 'fruiting', 'houseplant', 'flower', 'microgreen'])
    let field = 0
    let pod = 0
    for (const p of seedFieldCrops) {
      expect(validCats.has(p.category)).toBe(true)
      expect(Array.isArray(p.suitableFor) && p.suitableFor!.length > 0).toBe(true)
      for (const s of p.suitableFor!) expect(['pod', 'field']).toContain(s)
      if (p.suitableFor!.includes('field')) field += 1
      if (p.suitableFor!.includes('pod')) pod += 1
      expect(p.image.hash).toMatch(/^[0-9a-f]{8,}$/)
    }
    expect(field).toBeGreaterThan(200)
    expect(pod).toBeGreaterThan(100)
  })
})
