<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '~~/convex/_generated/api'
import { createBreadcrumbSchema } from '~~/shared/utils/seo'
import type { CommunityMarketplaceItem, OfficialMarketplaceItem } from '@/utils/convex-types'

interface PublicMarketplaceData {
  official: OfficialMarketplaceItem[]
  community: CommunityMarketplaceItem[]
  featured: OfficialMarketplaceItem | null
}

definePageMeta({ public: true })

usePublicSeo({
  title: 'Marketplace GrowMate | Hasil Panen dan Produk Pengguna',
  description:
    'Lihat hasil panen, bibit, dan produk budidaya dari komunitas GrowMate melalui marketplace publik yang terhubung dengan ekosistem pertanian cerdas.',
  path: '/marketplace',
  schema: [
    createBreadcrumbSchema([
      { name: 'Beranda', path: '/' },
      { name: 'Marketplace', path: '/marketplace' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Marketplace GrowMate',
      url: 'https://growmate.bond/marketplace',
      description:
        'Lihat hasil panen, bibit, dan produk budidaya dari komunitas GrowMate melalui marketplace publik yang terhubung dengan ekosistem pertanian cerdas.',
      inLanguage: 'id-ID',
    },
  ],
})

const query = ref('')
const selectedCategory = ref<'all' | 'official' | 'community'>('all')
const failedImages = ref<string[]>([])
const { data } = await usePublicConvexQuery<Record<string, unknown>, PublicMarketplaceData>('public-marketplace-listing', api.marketplace.marketplace, {})

const featured = computed(() => data.value?.featured ?? null)

const filteredOfficial = computed(() => {
  const official = data.value?.official ?? []
  const search = query.value.trim().toLowerCase()
  return official.filter((item) => {
    if (selectedCategory.value === 'community') return false
    if (!search) return true
    return `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(search)
  })
})

const filteredCommunity = computed(() => {
  const community = data.value?.community ?? []
  const search = query.value.trim().toLowerCase()
  return community.filter((item) => {
    if (selectedCategory.value === 'official') return false
    if (!search) return true
    return `${item.title} ${item.description} ${item.category} ${item.sellerName}`
      .toLowerCase()
      .includes(search)
  })
})

function openExternal(url: string) {
  if (url) window.open(url, '_blank')
}

function hasWorkingImage(id: string, image?: string | null) {
  return Boolean(image) && !failedImages.value.includes(id)
}

function handleImageError(id: string) {
  if (!failedImages.value.includes(id)) {
    failedImages.value = [...failedImages.value, id]
  }
}
</script>

<template>
  <MarketingPageShell>
    <section class="bg-[linear-gradient(135deg,#f6fbf2_0%,#edf7e8_50%,#dfeeda_100%)]">
      <RevealBlock as="div" class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Marketplace</p>
        <h1 class="font-headline text-4xl text-[#17351a] sm:text-5xl">Ruang distribusi hasil panen dan produk dari sesama pengguna.</h1>
        <p class="mt-5 max-w-3xl text-base text-gm-muted sm:text-lg">
          Halaman ini membantu pengguna melihat hasil panen, bibit, dan kebutuhan budidaya lain yang dibagikan melalui marketplace komunitas GrowMate.
        </p>
        <div class="mt-8 max-w-xl rounded-full bg-white px-5 py-3 shadow-sm">
          <input v-model="query" class="w-full bg-transparent text-sm outline-none" placeholder="Cari hasil panen, kategori, atau nama penjual" />
        </div>
      </RevealBlock>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <ListingGrid
          :featured="featured"
          :filtered-official="filteredOfficial"
          :filtered-community="filteredCommunity"
          :search-query="query"
          :selected-category="selectedCategory"
          :has-working-image="hasWorkingImage"
          :readonly="true"
          @open-external="openExternal"
          @handle-image-error="handleImageError"
          @update:search-query="query = $event"
          @update:selected-category="selectedCategory = $event"
        />
      </div>
    </section>
  </MarketingPageShell>
</template>
