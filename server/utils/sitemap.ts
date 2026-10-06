import { ConvexHttpClient } from 'convex/browser'
import { api } from '~~/convex/_generated/api'
import { GROWMATE_SITE_URL } from '~~/shared/utils/seo'
import { withConvexTimeout } from './convex'

/** Per-call budget for the sitemap's Convex queries (Convex down => fast fallback, not 500s). */
export const SITEMAP_CONVEX_TIMEOUT_MS = 5000

/**
 * Short cache for the rendered sitemap XML.
 *
 * NOTE: caching lives here (module-level, single entry) instead of Nitro
 * because server/routes/sitemap.xml.ts uses a plain defineEventHandler and is
 * out of scope for this change. For proper HTTP caching, switch that route to
 * defineCachedEventHandler (or set Cache-Control there) and this can go away.
 */
export const SITEMAP_CACHE_TTL_MS = 5 * 60 * 1000

let _cached: { xml: string; expiresAt: number } | null = null

/** Test seam: drop the cached sitemap XML. */
export function clearSitemapCache(): void {
  _cached = null
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function toIsoDate(value?: number) {
  return value ? new Date(value).toISOString() : undefined
}

type SitemapEntry = {
  loc: string
  lastmod?: string
}

export async function buildSitemapXml(convexUrl?: string) {
  const now = Date.now()
  if (_cached && _cached.expiresAt > now) return _cached.xml
  const xml = await buildSitemapXmlUncached(convexUrl)
  // Cache static-only fallbacks too: a Convex outage shouldn't make every
  // crawler hit wait out the query timeout. TTL is short, so recovery after
  // an outage is delayed by at most SITEMAP_CACHE_TTL_MS.
  _cached = { xml, expiresAt: now + SITEMAP_CACHE_TTL_MS }
  return xml
}

export async function buildSitemapXmlUncached(convexUrl?: string) {
  const staticEntries: SitemapEntry[] = [
    { loc: `${GROWMATE_SITE_URL}/` },
    { loc: `${GROWMATE_SITE_URL}/products` },
    { loc: `${GROWMATE_SITE_URL}/marketplace` },
    { loc: `${GROWMATE_SITE_URL}/plant-library` },
    { loc: `${GROWMATE_SITE_URL}/support` },
    { loc: `${GROWMATE_SITE_URL}/about` },
    { loc: `${GROWMATE_SITE_URL}/blog` },
    { loc: `${GROWMATE_SITE_URL}/stories` },
  ]

  let dynamicEntries: SitemapEntry[] = []

  // Server-side: prefer the in-cluster Convex URL to avoid hairpinning
  // through Traefik + TLS + public DNS; fall back to the caller-supplied URL.
  const url = process.env.CONVEX_INTERNAL_URL ?? convexUrl
  if (url) {
    try {
      const client = new ConvexHttpClient(url)
      const [marketplace, community, blogPosts] = await withConvexTimeout(
        Promise.all([
          client.query(api.marketplace.marketplace, {}),
          client.query(api.community.community, {}),
          client.query(api.blog.publicBlog, {}),
        ]),
        SITEMAP_CONVEX_TIMEOUT_MS,
      )

      dynamicEntries = [
        ...(marketplace.official ?? []).map((product: { _id: unknown; updatedAt?: number }) => ({
          loc: `${GROWMATE_SITE_URL}/products/${product._id}`,
          lastmod: toIsoDate(product.updatedAt),
        })),
        ...(community.posts ?? []).map((story: { _id: unknown; updatedAt?: number }) => ({
          loc: `${GROWMATE_SITE_URL}/stories/${story._id}`,
          lastmod: toIsoDate(story.updatedAt),
        })),
        ...(blogPosts ?? []).map((post: { _id: unknown; updatedAt?: number }) => ({
          loc: `${GROWMATE_SITE_URL}/blog/${post._id}`,
          lastmod: toIsoDate(post.updatedAt),
        })),
      ]
    } catch (err) {
      // Convex down or slow: serve the static entries rather than 500ing.
      console.warn('[sitemap] Convex unavailable, serving static entries only:', err)
    }
  }

  const urls = [...staticEntries, ...dynamicEntries]
    .map(
      (entry) => `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
}
