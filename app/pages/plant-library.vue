<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import { toOptimizedImageUrl } from '@/lib/images'
import { createBreadcrumbSchema } from '@/lib/seo'

definePageMeta({ public: true })

usePublicSeo({
  title: 'Pustaka Tanaman GrowMate | Panduan Profil dan Kebutuhan Tanaman',
  description:
    'Pelajari profil tanaman, kategori budidaya, dan kebutuhan dasar perawatan melalui pustaka tanaman GrowMate yang disusun untuk membantu keputusan budidaya.',
  path: '/plant-library',
  schema: [
    createBreadcrumbSchema([
      { name: 'Beranda', path: '/' },
      { name: 'Pustaka Tanaman', path: '/plant-library' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Pustaka Tanaman GrowMate',
      url: 'https://growmate.bond/plant-library',
      description:
        'Pelajari profil tanaman, kategori budidaya, dan kebutuhan dasar perawatan melalui pustaka tanaman GrowMate yang disusun untuk membantu keputusan budidaya.',
      inLanguage: 'id-ID',
    },
  ],
})

const selectedCategory = ref<'all' | string>('all')
const { data } = await usePublicConvexQuery('public-plant-library', api.growmate.plantLibrary, {})

const categories = computed(() => ['all', ...new Set((data.value ?? []).map((item) => item.category))])
const filtered = computed(() => {
  if (selectedCategory.value === 'all') return data.value ?? []
  return (data.value ?? []).filter((item) => item.category === selectedCategory.value)
})

function formatCategoryLabel(category: string) {
  return category.toUpperCase()
}
</script>

<template>
  <MarketingPageShell>
    <section class="bg-[linear-gradient(135deg,#f6fbf2_0%,#edf7e8_50%,#dfeeda_100%)]">
      <RevealBlock as="div" class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Pustaka Tanaman</p>
        <h1 class="font-headline text-4xl text-[#17351a] sm:text-5xl">Daftar tanaman untuk membantu memahami kebutuhan budidaya sejak awal.</h1>
        <p class="mt-5 max-w-3xl text-base text-gm-muted sm:text-lg">
          Setiap profil tanaman membantu pengguna mengenali karakter pertumbuhan, kategori, dan dasar pengambilan keputusan perawatan yang lebih tepat.
        </p>

        <div class="mt-8 flex flex-wrap gap-3">
          <button
            v-for="category in categories"
            :key="category"
            class="gm-soft-button rounded-full px-4 py-2 text-sm font-semibold transition-colors"
            :class="selectedCategory === category ? 'bg-gm-primary text-white' : 'bg-white text-gm-text'"
            @click="selectedCategory = category"
          >
            {{ category === 'all' ? 'SEMUA' : formatCategoryLabel(category) }}
          </button>
        </div>
      </RevealBlock>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex flex-wrap justify-center gap-4 lg:gap-6">
          <RevealBlock
            v-for="(preset, index) in filtered"
            :key="preset._id"
            as="div"
            :delay="Math.min(index * 60, 240)"
            origin="up"
            class="gm-card-lift group w-[calc(50%-0.5rem)] text-center lg:w-[calc(25%-1.125rem)]"
          >
            <div class="mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
              <img v-if="preset.image" :src="toOptimizedImageUrl(preset.image, { width: 720, height: 720, quality: 72 }) || undefined" :alt="preset.name" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" decoding="async" width="720" height="720" />
              <div v-else class="flex h-full items-center justify-center text-gm-primary">
                <span class="material-symbols-outlined gm-visual-icon">yard</span>
              </div>
            </div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-gm-muted">{{ formatCategoryLabel(preset.category) }}</div>
            <h3 class="mt-1 text-sm font-medium text-gm-text">{{ preset.name }}</h3>
            <p class="mt-1 text-sm text-gray-600">{{ preset.species }}</p>
          </RevealBlock>
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
