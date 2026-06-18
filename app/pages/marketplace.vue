<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import { createBreadcrumbSchema } from '@/lib/seo'

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
const { data } = await usePublicConvexQuery('public-marketplace-listing', api.growmate.marketplace, {})

const communityProducts = computed(() => data.value?.community ?? [])
const filteredProducts = computed(() => {
  const search = query.value.trim().toLowerCase()
  if (!search) return communityProducts.value
  return communityProducts.value.filter((product) =>
    `${product.title} ${product.description} ${product.category} ${product.sellerName}`
      .toLowerCase()
      .includes(search),
  )
})
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
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-8 flex items-center justify-between gap-4">
          <h2 class="font-headline text-2xl text-gm-text sm:text-3xl">Daftar penawaran terbaru</h2>
          <p class="text-sm text-gm-muted">{{ filteredProducts.length }} penawaran</p>
        </RevealBlock>

        <div v-if="filteredProducts.length" class="flex flex-wrap justify-center gap-4 lg:gap-6">
          <RevealBlock v-for="(product, index) in filteredProducts" :key="product._id" as="div" :delay="Math.min(index * 70, 280)" origin="up" class="w-[calc(50%-0.5rem)] lg:w-[calc(25%-1.125rem)]">
            <MarketingProductCard :product="product" compact centered />
          </RevealBlock>
        </div>
        <div v-else class="rounded-[2rem] bg-[#f5f6f2] p-10 text-center text-sm text-gm-muted">
          Belum ada penawaran komunitas yang sesuai dengan pencarian Anda.
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
