<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/images'
import { createBreadcrumbSchema } from '@/lib/seo'

definePageMeta({ public: true })

usePublicSeo({
  title: 'Produk GrowMate | Solusi Smart Farming dan IoT',
  description:
    'Jelajahi produk resmi GrowMate untuk budidaya cerdas, pemantauan tanaman, otomatisasi perangkat, dan dukungan pertanian berbasis IoT.',
  path: '/products',
  schema: [
    createBreadcrumbSchema([
      { name: 'Beranda', path: '/' },
      { name: 'Produk', path: '/products' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Produk GrowMate',
      url: 'https://growmate.bond/products',
      description:
        'Jelajahi produk resmi GrowMate untuk budidaya cerdas, pemantauan tanaman, otomatisasi perangkat, dan dukungan pertanian berbasis IoT.',
      inLanguage: 'id-ID',
    },
  ],
})

interface MarketplaceProduct {
  _id: string
  title: string
  description: string
  category: string
  imageUrl: string | null
  featured: boolean
  price: number
  status: string
  type: 'official' | 'community'
  priceLabel: string
  quantityLabel: string
  statusLabel: string
  sellerName: string
  shopeeUrl?: string | null
}

interface MarketplaceResponse {
  official: MarketplaceProduct[]
  community: MarketplaceProduct[]
  featured: MarketplaceProduct | null
}

const query = ref('')
const { data } = await usePublicConvexQuery<Record<string, never>, MarketplaceResponse>('public-marketplace-products', api.marketplace.marketplace, {})

const officialProducts = computed(() => data.value?.official ?? [])
const featured = computed(() => data.value?.featured ?? officialProducts.value[0] ?? null)
const featuredImage = computed(() => getImageUrl(featured.value?.imageUrl, 1200))
const filteredProducts = computed(() => {
  const search = query.value.trim().toLowerCase()
  if (!search) return officialProducts.value
  return officialProducts.value.filter((product) =>
    `${product.title} ${product.description} ${product.category}`.toLowerCase().includes(search),
  )
})
</script>

<template>
  <MarketingPageShell>
    <section class="bg-[linear-gradient(135deg,#f6fbf2_0%,#edf7e8_50%,#dfeeda_100%)]">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 pt-6 pb-16 sm:px-6 lg:grid-cols-[1fr_1fr] lg:px-8 lg:pt-10 lg:pb-20">
        <RevealBlock as="div">
          <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Produk</p>
          <h1 class="font-headline text-4xl text-[#17351a] sm:text-5xl">Solusi GrowMate untuk budidaya skala kecil hingga besar.</h1>
          <p class="mt-5 max-w-2xl text-base text-gm-muted sm:text-lg">
            GrowMate menghadirkan produk resmi untuk membantu pengguna memulai budidaya cerdas dengan pemantauan, otomatisasi, dan pendampingan yang lebih praktis.
          </p>
          <div class="mt-8 max-w-xl rounded-full bg-white px-5 py-3 shadow-sm">
            <input v-model="query" class="w-full bg-transparent text-sm outline-none" placeholder="Cari produk resmi dan kategori" />
          </div>
        </RevealBlock>

        <RevealBlock as="div" origin="left" :delay="120" class="gm-card-lift overflow-hidden rounded-[2rem] bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-6">
          <div class="aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#eef5ea]">
            <img v-if="featured?.imageUrl" :src="featuredImage || undefined" :alt="featured.title" class="h-full w-full object-cover" fetchpriority="high" decoding="async" width="1200" height="900" />
            <div v-else class="flex h-full items-center justify-center text-gm-primary">
              <span class="material-symbols-outlined gm-visual-icon">devices</span>
            </div>
          </div>
          <div class="mt-5">
            <div class="text-xs font-semibold uppercase tracking-[0.22em] text-gm-muted">Produk unggulan</div>
            <div class="mt-2 text-2xl font-bold text-gm-text">{{ featured?.title || 'Produk resmi GrowMate' }}</div>
            <p class="mt-3 text-sm leading-relaxed text-gm-muted">{{ featured?.description || 'Perangkat resmi GrowMate untuk membantu budidaya yang lebih terarah dan efisien.' }}</p>
          </div>
        </RevealBlock>
      </div>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-8 flex items-center justify-between gap-4">
          <h2 class="font-headline text-2xl text-gm-text sm:text-3xl">Daftar produk resmi</h2>
          <p class="text-sm text-gm-muted">{{ filteredProducts.length }} produk</p>
        </RevealBlock>

        <div v-if="filteredProducts.length" class="flex flex-wrap justify-center gap-4 lg:gap-6">
          <RevealBlock v-for="(product, index) in filteredProducts" :key="product._id" as="div" :delay="Math.min(index * 70, 280)" origin="up" class="w-[calc(50%-0.5rem)] lg:w-[calc(25%-1.125rem)]">
            <MarketingProductCard :product="product" compact centered />
          </RevealBlock>
        </div>
        <div v-else class="rounded-[2rem] bg-[#f5f6f2] p-10 text-center text-sm text-gm-muted">
          Belum ada produk resmi yang sesuai dengan pencarian Anda.
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
