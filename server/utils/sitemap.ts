import { ConvexHttpClient } from 'convex/browser'
import { api } from '~~/convex/_generated/api'
import { GROWMATE_SITE_URL } from '~~/app/lib/seo'

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

  if (convexUrl) {
    const client = new ConvexHttpClient(convexUrl)
    const [marketplace, community, blogPosts] = await Promise.all([
      client.query(api.growmate.marketplace, {}),
      client.query(api.growmate.community, {}),
      client.query(api.growmate.publicBlog, {}),
    ])

    dynamicEntries = [
      ...(marketplace.official ?? []).map((product) => ({
        loc: `${GROWMATE_SITE_URL}/products/${product._id}`,
        lastmod: toIsoDate(product.updatedAt),
      })),
      ...(community.posts ?? []).map((story) => ({
        loc: `${GROWMATE_SITE_URL}/stories/${story._id}`,
        lastmod: toIsoDate(story.updatedAt),
      })),
      ...(blogPosts ?? []).map((post) => ({
        loc: `${GROWMATE_SITE_URL}/blog/${post._id}`,
        lastmod: toIsoDate(post.updatedAt),
      })),
    ]
  }

  const urls = [...staticEntries, ...dynamicEntries]
    .map(
      (entry) => `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : ''}\n  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
}
