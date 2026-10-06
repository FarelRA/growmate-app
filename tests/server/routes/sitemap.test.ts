/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}))

vi.mock('convex/browser', () => ({
  ConvexHttpClient: class ConvexHttpClientMock {
    query = mockQuery
    constructor(public url?: string) {}
  },
}))

vi.mock('~~/convex/_generated/api', () => ({
  api: {
    marketplace: { marketplace: 'marketplace' },
    community: { community: 'community' },
    blog: { publicBlog: 'publicBlog' },
  },
}))

import {
  buildSitemapXml,
  buildSitemapXmlUncached,
  clearSitemapCache,
  SITEMAP_CACHE_TTL_MS,
} from '../../../server/utils/sitemap'
import routeHandler from '../../../server/routes/sitemap.xml'
import { GROWMATE_SITE_URL } from '../../../shared/utils/seo'

const CONVEX_URL = 'https://convex.test'
const STATIC_PATHS = [
  '/',
  '/products',
  '/marketplace',
  '/plant-library',
  '/support',
  '/about',
  '/blog',
  '/stories',
]

function emptyLists() {
  mockQuery.mockImplementation(async (ref: string) => {
    if (ref === 'marketplace') return { official: [] }
    if (ref === 'community') return { posts: [] }
    if (ref === 'publicBlog') return []
    throw new Error(`unexpected query: ${ref}`)
  })
}

let savedInternalUrl: string | undefined

beforeEach(() => {
  vi.clearAllMocks()
  clearSitemapCache()
  savedInternalUrl = process.env.CONVEX_INTERNAL_URL
  delete process.env.CONVEX_INTERNAL_URL
  emptyLists()
})

afterEach(() => {
  if (savedInternalUrl === undefined) delete process.env.CONVEX_INTERNAL_URL
  else process.env.CONVEX_INTERNAL_URL = savedInternalUrl
  vi.restoreAllMocks()
  const g = globalThis as any
  if ('useRuntimeConfig' in g && typeof g.useRuntimeConfig === 'function' && g.__stubbedRuntimeConfig) {
    delete g.useRuntimeConfig
    delete g.__stubbedRuntimeConfig
  }
  if ('setHeader' in g && g.__stubbedSetHeader) {
    delete g.setHeader
    delete g.__stubbedSetHeader
  }
})

describe('buildSitemapXmlUncached XML shape', () => {
  it('emits a valid sitemap envelope with all static entries', async () => {
    const xml = await buildSitemapXmlUncached(CONVEX_URL)

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
    for (const path of STATIC_PATHS) {
      expect(xml).toContain(`<loc>${GROWMATE_SITE_URL}${path}</loc>`)
    }
    expect(xml.match(/<url>/g)).toHaveLength(STATIC_PATHS.length)
  })

  it('appends dynamic product / story / blog entries with lastmod when present', async () => {
    mockQuery.mockImplementation(async (ref: string) => {
      if (ref === 'marketplace') return { official: [{ _id: 'p1', updatedAt: 1700000000000 }] }
      if (ref === 'community') return { posts: [{ _id: 's1' }] }
      if (ref === 'publicBlog') return [{ _id: 'b1', updatedAt: 1700000001000 }]
      throw new Error(`unexpected query: ${ref}`)
    })

    const xml = await buildSitemapXmlUncached(CONVEX_URL)

    expect(xml).toContain(`<loc>${GROWMATE_SITE_URL}/products/p1</loc>`)
    expect(xml).toContain(`<lastmod>${new Date(1700000000000).toISOString()}</lastmod>`)
    expect(xml).toContain(`<loc>${GROWMATE_SITE_URL}/stories/s1</loc>`)
    expect(xml).toContain(`<loc>${GROWMATE_SITE_URL}/blog/b1</loc>`)
    // Entry without updatedAt omits lastmod.
    expect(xml).not.toContain(`<loc>${GROWMATE_SITE_URL}/stories/s1</loc>\n    <lastmod>`)
  })
})

describe('buildSitemapXmlUncached Convex fallback', () => {
  it('serves static entries only when Convex queries fail', async () => {
    mockQuery.mockRejectedValue(new Error('Convex down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const xml = await buildSitemapXmlUncached(CONVEX_URL)

      for (const path of STATIC_PATHS) {
        expect(xml).toContain(`<loc>${GROWMATE_SITE_URL}${path}</loc>`)
      }
      expect(xml.match(/<url>/g)).toHaveLength(STATIC_PATHS.length)
      expect(xml).toContain('</urlset>')
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('serves static entries without querying when no Convex URL is configured', async () => {
    const xml = await buildSitemapXmlUncached(undefined)

    expect(mockQuery).not.toHaveBeenCalled()
    for (const path of STATIC_PATHS) {
      expect(xml).toContain(`<loc>${GROWMATE_SITE_URL}${path}</loc>`)
    }
  })
})

describe('buildSitemapXml cache', () => {
  it('caches the rendered XML within the TTL', async () => {
    const xml1 = await buildSitemapXml(CONVEX_URL)
    const xml2 = await buildSitemapXml(CONVEX_URL)

    expect(xml2).toBe(xml1)
    expect(mockQuery).toHaveBeenCalledTimes(3)
  })

  it('re-queries after clearSitemapCache', async () => {
    await buildSitemapXml(CONVEX_URL)
    expect(mockQuery).toHaveBeenCalledTimes(3)

    clearSitemapCache()
    await buildSitemapXml(CONVEX_URL)
    expect(mockQuery).toHaveBeenCalledTimes(6)
  })

  it('re-queries after the TTL expires', async () => {
    const nowSpy = vi.spyOn(Date, 'now')
    try {
      nowSpy.mockReturnValue(1_000_000)
      const xml1 = await buildSitemapXml(CONVEX_URL)
      nowSpy.mockReturnValue(1_000_000 + SITEMAP_CACHE_TTL_MS - 1)
      expect(await buildSitemapXml(CONVEX_URL)).toBe(xml1)
      expect(mockQuery).toHaveBeenCalledTimes(3)

      nowSpy.mockReturnValue(1_000_000 + SITEMAP_CACHE_TTL_MS + 1)
      await buildSitemapXml(CONVEX_URL)
      expect(mockQuery).toHaveBeenCalledTimes(6)
    } finally {
      nowSpy.mockRestore()
    }
  })

  it('caches static-only fallbacks too (outage does not hammer Convex)', async () => {
    mockQuery.mockRejectedValue(new Error('Convex down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      await buildSitemapXml(CONVEX_URL)
      await buildSitemapXml(CONVEX_URL)
      expect(mockQuery).toHaveBeenCalledTimes(3)
    } finally {
      warnSpy.mockRestore()
    }
  })
})

describe('GET /sitemap.xml route', () => {
  function stubRouteGlobals() {
    const g = globalThis as any
    g.useRuntimeConfig = () => ({ public: { convexUrl: CONVEX_URL } })
    g.__stubbedRuntimeConfig = true
    g.setHeader = vi.fn()
    g.__stubbedSetHeader = true
    return g.setHeader as ReturnType<typeof vi.fn>
  }

  it('returns XML with the sitemap content type', async () => {
    const setHeader = stubRouteGlobals()

    const xml = await (routeHandler as any)({})

    expect(typeof xml).toBe('string')
    expect(xml).toContain('<urlset')
    expect(setHeader).toHaveBeenCalledWith(
      expect.anything(),
      'content-type',
      'application/xml; charset=UTF-8',
    )
  })

  it('serves the static fallback when Convex is down', async () => {
    stubRouteGlobals()
    mockQuery.mockRejectedValue(new Error('Convex down'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const xml = await (routeHandler as any)({})

      expect(xml).toContain(`<loc>${GROWMATE_SITE_URL}/</loc>`)
      expect(xml).toContain('</urlset>')
    } finally {
      warnSpy.mockRestore()
    }
  })
})
