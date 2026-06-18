import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import {
  GROWMATE_DEFAULT_IMAGE,
  GROWMATE_DEFAULT_ROBOTS,
  GROWMATE_SITE_NAME,
  GROWMATE_SITE_URL,
  toAbsoluteUrl,
} from '@/lib/seo'

type JsonLd = Record<string, unknown>

type PublicSeoOptions = {
  title: MaybeRefOrGetter<string>
  description: MaybeRefOrGetter<string>
  path?: MaybeRefOrGetter<string>
  image?: MaybeRefOrGetter<string | null | undefined>
  type?: MaybeRefOrGetter<'website' | 'article'>
  robots?: MaybeRefOrGetter<string>
  schema?: MaybeRefOrGetter<JsonLd | JsonLd[] | null | undefined>
}

export function usePublicSeo(options: PublicSeoOptions) {
  const route = useRoute()

  const title = computed(() => toValue(options.title))
  const description = computed(() => toValue(options.description))
  const type = computed(() => toValue(options.type) ?? 'website')
  const robots = computed(() => toValue(options.robots) ?? GROWMATE_DEFAULT_ROBOTS)
  const path = computed(() => toValue(options.path) ?? route.path)
  const canonicalUrl = computed(() => new URL(path.value, GROWMATE_SITE_URL).toString())
  const image = computed(() => toAbsoluteUrl(toValue(options.image) ?? GROWMATE_DEFAULT_IMAGE))
  const schema = computed(() => {
    const value = toValue(options.schema)
    if (!value) return []
    return Array.isArray(value) ? value : [value]
  })

  useSeoMeta({
    title,
    description,
    robots,
    ogTitle: title,
    ogDescription: description,
    ogType: type,
    ogUrl: canonicalUrl,
    ogImage: image,
    ogSiteName: GROWMATE_SITE_NAME,
    ogLocale: 'id_ID',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
  })

  useHead(() => ({
    htmlAttrs: {
      lang: 'id',
    },
    link: [{ rel: 'canonical', href: canonicalUrl.value }],
    meta: [{ property: 'article:publisher', content: GROWMATE_SITE_NAME }],
    script: schema.value.length
      ? [
          {
            key: `ld-json-${path.value}`,
            type: 'application/ld+json',
            children: JSON.stringify(schema.value),
          },
        ]
      : [],
  }))
}
