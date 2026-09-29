export const GROWMATE_SITE_NAME = 'GrowMate'
export const GROWMATE_SITE_URL = 'https://growmate.bond'
export const GROWMATE_DEFAULT_IMAGE = '/growmate-icon.png'
export const GROWMATE_DEFAULT_ROBOTS =
  'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'

export function toAbsoluteUrl(path?: string | null) {
  if (!path) {
    return new URL(GROWMATE_DEFAULT_IMAGE, GROWMATE_SITE_URL).toString()
  }

  if (/^https?:\/\//.test(path)) {
    return path
  }

  return new URL(path, GROWMATE_SITE_URL).toString()
}

export function toMetaDescription(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`
}

export function createBreadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: toAbsoluteUrl(item.path),
    })),
  }
}

export function createOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: GROWMATE_SITE_NAME,
    url: GROWMATE_SITE_URL,
    logo: toAbsoluteUrl('/growmate-icon.png'),
    description:
      'GrowMate adalah solusi pertanian cerdas berbasis IoT dan AI untuk pemantauan tanaman, otomatisasi budidaya, dan penguatan ekosistem pangan berkelanjutan.',
    identifier: [
      {
        '@type': 'PropertyValue',
        name: 'Nomor Induk Berusaha',
        value: '1902260052173',
      },
      {
        '@type': 'PropertyValue',
        name: 'Hak Cipta',
        value: 'EC002026055570',
      },
    ],
    knowsAbout: [
      'Internet of Things',
      'Artificial Intelligence',
      'Smart Farming',
      'Pemantauan Tanaman',
      'Otomatisasi Budidaya',
    ],
    sameAs: [
      'https://www.instagram.com/grow.mateai',
      'https://wa.me/6285157813352',
    ],
  }
}

export function createBusinessSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Corporation',
    name: GROWMATE_SITE_NAME,
    url: GROWMATE_SITE_URL,
    logo: toAbsoluteUrl('/growmate-icon.png'),
    identifier: [
      {
        '@type': 'PropertyValue',
        name: 'Nomor Induk Berusaha',
        value: '1902260052173',
      },
      {
        '@type': 'PropertyValue',
        name: 'Hak Cipta',
        value: 'EC002026055570',
      },
    ],
  }
}

export function createWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: GROWMATE_SITE_NAME,
    url: GROWMATE_SITE_URL,
    inLanguage: 'id-ID',
  }
}
