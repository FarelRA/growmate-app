<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '~~/convex/_generated/api'
import { createBreadcrumbSchema } from '~~/shared/utils/seo'
import type { CommunityMarketplaceItem, OfficialMarketplaceItem } from '@/utils/convex-types'
import { filterCommunityItems, filterOfficialItems } from '@/composables/useMarketplace'

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
const {
  data,
  error: marketplaceError,
  refresh: refreshMarketplace,
} = await usePublicConvexQuery<Record<string, unknown>, PublicMarketplaceData>(
  'public-marketplace-listing',
  api.marketplace.marketplace,
  {},
)

const featured = computed(() => data.value?.featured ?? null)

const filteredOfficial = computed(() =>
  filterOfficialItems(data.value?.official ?? [], query.value, selectedCategory.value),
)

const filteredCommunity = computed(() =>
  filterCommunityItems(data.value?.community ?? [], query.value, selectedCategory.value),
)

function openExternal(url: string) {
  if (url) window.open(url, '_blank', 'noopener')
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
      <RevealBlock
        as="div"
        class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20"
      >
        <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">
          Marketplace
        </p>
        <h1 class="font-headline text-4xl text-[#17351a] sm:text-5xl">
          Ruang distribusi hasil panen dan produk dari sesama pengguna.
        </h1>
        <p class="mt-5 max-w-3xl text-base text-gm-muted sm:text-lg">
          Halaman ini membantu pengguna melihat hasil panen, bibit, dan kebutuhan budidaya lain yang
          dibagikan melalui marketplace komunitas GrowMate.
        </p>
        <div class="mt-8 max-w-xl rounded-full bg-white px-5 py-3 shadow-sm">
          <label class="block">
            <span class="sr-only">Cari hasil panen</span>
            <input
              v-model="query"
              aria-label="Cari hasil panen"
              class="w-full bg-transparent text-sm outline-none"
              placeholder="Cari hasil panen, kategori, atau nama penjual"
            />
          </label>
        </div>
      </RevealBlock>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div v-if="marketplaceError" class="rounded-[2rem] bg-[#f3f3f3] p-8 text-center">
          <p class="text-sm font-bold text-gm-text">Gagal memuat marketplace</p>
          <p class="mx-auto mt-2 max-w-md text-sm text-gm-muted">
            Periksa koneksi Anda lalu coba lagi.
          </p>
          <button
            type="button"
            class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white"
            @click="refreshMarketplace()"
          >
            Coba lagi
          </button>
        </div>
        <ListingGrid
          v-else
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
