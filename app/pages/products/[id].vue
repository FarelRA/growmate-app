<script setup lang="ts">
import { computed } from 'vue'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/images'
import { createBreadcrumbSchema, toAbsoluteUrl, toMetaDescription } from '@/lib/seo'

definePageMeta({ public: true })

const route = useRoute()
const productId = String(route.params.id || '')
const { data: product, pending, error } = await usePublicConvexQuery(`public-marketplace-product-detail-${productId}`, api.marketplace.getProductById, { productId })
const productImage = computed(() => getImageUrl(product.value?.imageUrl, 1200))

usePublicSeo({
  title: computed(() => (product.value ? `${product.value.title} | Produk GrowMate` : 'Produk GrowMate')),
  description: computed(
    () =>
      toMetaDescription(
        product.value?.description ||
          'Lihat detail produk GrowMate untuk solusi budidaya cerdas, pemantauan perangkat, dan kebutuhan pertanian modern.',
      ),
  ),
  path: computed(() => `/products/${productId.value}`),
  image: computed(() => product.value?.imageUrl ? getImageUrl(product.value.imageUrl, 1200) : null),
  type: 'website',
  schema: computed(() => {
    if (!product.value) return createBreadcrumbSchema([{ name: 'Beranda', path: '/' }, { name: 'Produk', path: '/products' }])

    return [
      createBreadcrumbSchema([
        { name: 'Beranda', path: '/' },
        { name: 'Produk', path: '/products' },
        { name: product.value.title, path: `/products/${productId.value}` },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.value.title,
        description: product.value.description,
        image: product.value.imageUrl ? [getImageUrl(product.value.imageUrl, 1200)] : undefined,
        category: product.value.category,
        brand: { '@type': 'Brand', name: 'GrowMate' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'IDR',
          price: product.value.price,
          availability:
            product.value.status === 'sold'
              ? 'https://schema.org/OutOfStock'
              : 'https://schema.org/InStock',
          url: toAbsoluteUrl(`/products/${productId.value}`),
        },
      },
    ]
  }),
})
</script>

<template>
  <MarketingPageShell>
    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div v-if="pending" class="flex items-center justify-center py-24">
          <div class="h-10 w-10 animate-spin rounded-full border-4 border-gm-primary border-t-transparent" />
        </div>

        <div v-else-if="error" class="rounded-[2rem] bg-red-50 p-10 text-center text-sm text-red-600">
          Gagal memuat detail produk. Silakan coba lagi nanti.
        </div>

        <div v-else-if="product" class="grid gap-10 lg:grid-cols-[1fr_0.92fr] lg:items-start">
          <RevealBlock as="div" origin="right" class="gm-card-lift overflow-hidden rounded-[2rem] bg-[#f5f6f2] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div class="aspect-square overflow-hidden rounded-[1.5rem] bg-white">
              <img v-if="product.imageUrl" :src="productImage || undefined" :alt="product.title" class="h-full w-full object-cover" fetchpriority="high" decoding="async" width="1200" height="1200" />
              <div v-else class="flex h-full items-center justify-center text-gm-primary">
                <span class="material-symbols-outlined gm-visual-icon">shopping_bag</span>
              </div>
            </div>
          </RevealBlock>

          <RevealBlock as="div" origin="left" :delay="120">
            <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">{{ product.category }}</p>
            <h1 class="font-headline text-4xl text-gm-text sm:text-5xl">{{ product.title }}</h1>
            <p class="mt-4 text-lg font-semibold text-gm-primary">{{ product.priceLabel }}</p>
            <p class="mt-6 text-sm leading-8 text-gm-muted">{{ product.description }}</p>

            <div class="mt-8 grid gap-4 sm:grid-cols-2">
              <div class="gm-card-lift rounded-[1.5rem] bg-[#f5f6f2] p-5">
                <div class="text-xs font-semibold uppercase tracking-[0.22em] text-gm-muted">Ketersediaan</div>
                <div class="mt-3 text-sm text-gm-text">{{ product.quantityLabel }}</div>
                <div class="mt-1 text-sm text-gm-muted">{{ product.statusLabel }}</div>
              </div>
              <div class="gm-card-lift rounded-[1.5rem] bg-[#f5f6f2] p-5">
                <div class="text-xs font-semibold uppercase tracking-[0.22em] text-gm-muted">Penjual</div>
                <div class="mt-3 text-sm text-gm-text">{{ product.sellerName }}</div>
                <div class="mt-1 text-sm text-gm-muted">{{ product.type === 'official' ? 'Produk resmi GrowMate' : 'Penawaran dari komunitas' }}</div>
              </div>
            </div>

            <div class="mt-8 flex flex-wrap gap-3">
              <a
                v-if="product.shopeeUrl"
                :href="product.shopeeUrl"
                target="_blank"
                rel="noreferrer"
                class="gm-soft-button rounded-full bg-[#17351a] px-6 py-3 text-sm font-bold text-white"
              >
                Beli melalui Shopee
              </a>
              <NuxtLink
                v-else
                to="/register"
                class="gm-soft-button rounded-full bg-[#17351a] px-6 py-3 text-sm font-bold text-white"
              >
                Masuk untuk melanjutkan
              </NuxtLink>
              <NuxtLink
                :to="product.type === 'official' ? '/products' : '/marketplace'"
                class="gm-soft-button rounded-full bg-[#f5f6f2] px-6 py-3 text-sm font-bold text-gm-text"
              >
                {{ product.type === 'official' ? 'Kembali ke produk' : 'Kembali ke marketplace' }}
              </NuxtLink>
            </div>
          </RevealBlock>
        </div>

        <div v-else class="rounded-[2rem] bg-[#f5f6f2] p-10 text-center text-sm text-gm-muted">
          Produk tidak ditemukan.
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
