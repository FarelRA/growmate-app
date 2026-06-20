<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/images'
import { createBreadcrumbSchema, createOrganizationSchema, createWebSiteSchema } from '@/lib/seo'

definePageMeta({
  public: true,
})

usePublicSeo({
  title: 'GrowMate | Solusi Pertanian Cerdas Berkelanjutan',
  description:
    'GrowMate adalah solusi pertanian cerdas berbasis IoT dan AI yang membantu pengguna merawat tanaman, memantau lahan, dan mendukung ketahanan pangan berkelanjutan.',
  path: '/',
  schema: [
    createWebSiteSchema(),
    createOrganizationSchema(),
    createBreadcrumbSchema([{ name: 'Beranda', path: '/' }]),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'GrowMate | Solusi Pertanian Cerdas Berkelanjutan',
      url: 'https://growmate.bond/',
      description:
        'GrowMate adalah solusi pertanian cerdas berbasis IoT dan AI yang membantu pengguna merawat tanaman, memantau lahan, dan mendukung ketahanan pangan berkelanjutan.',
      inLanguage: 'id-ID',
    },
  ],
})

const { data: marketplace } = await usePublicConvexQuery<Record<string, unknown>, MarketplaceData>('public-marketplace-home', api.marketplace.marketplace, {})
const { data: community } = await usePublicConvexQuery<Record<string, unknown>, CommunityData>('public-community-home', api.community.community, {})
const { data: plantLibrary } = await usePublicConvexQuery<Record<string, unknown>, PlantPreset[]>('public-plant-library-home', api.plants.plantLibrary, {})
const { data: blogPosts } = await usePublicConvexQuery<Record<string, unknown>, BlogPost[]>('public-blog-home', api.blog.publicBlog, {})

interface MarketplaceProduct {
  _id: string
  title: string
  imageUrl: string | null
  featured: boolean
  description: string
  price: number
}
interface MarketplaceData {
  official: MarketplaceProduct[]
  community: MarketplaceProduct[]
  featured: MarketplaceProduct | null
}
interface CommunityStory {
  _id: string
  title: string
  body: string
  imageUrl: string | null
  user: { name?: string } | null
}
interface CommunityData {
  posts: CommunityStory[]
}
interface PlantPreset {
  _id: string
  name: string
  category: string
  imageUrl: string | null
}
interface BlogPost {
  _id: string
  title: string
  excerpt: string
  body: string
  imageUrl: string | null
  relativeTime: string
}

const carouselPosition = ref(0)

const officialProducts = computed(() => marketplace.value?.official ?? [])
const communityProducts = computed(() => marketplace.value?.community ?? [])
const featuredProduct = computed(() => marketplace.value?.featured ?? officialProducts.value[0] ?? null)
const stories = computed(() => community.value?.posts ?? [])
const presets = computed(() => plantLibrary.value ?? [])

const saleCards = computed(() => communityProducts.value.slice(0, 4))
const gardenCards = computed(() => officialProducts.value.slice(0, 4))
const podCards = computed(() => presets.value.slice(0, 4))
const blogCards = computed(() => blogPosts.value ?? [])
const carouselStories = computed(() => stories.value.slice(0, 5))

const heroImages = computed(() => {
  const pool = [
    featuredProduct.value?.imageUrl,
    officialProducts.value[1]?.imageUrl,
    communityProducts.value[0]?.imageUrl,
    stories.value[0]?.imageUrl,
    presets.value[0]?.imageUrl,
    presets.value[1]?.imageUrl,
  ].filter(Boolean)

  return Array.from({ length: 4 }, (_, index) => pool[index] ?? null)
})

const marqueeWords = ['GrowMate Pods', 'Marketplace Panen', 'Pustaka Tanaman', 'Cerita Pengguna']
const marqueeTopItems = computed(() =>
  Array.from({ length: 3 }, (_, loop) =>
    marqueeWords.map((word, index) => ({ key: `${loop}-${index}`, word })),
  ).flat(),
)
const marqueeBottomItems = computed(() =>
  Array.from({ length: 3 }, (_, loop) =>
    [...marqueeWords].reverse().map((word, index) => ({ key: `bottom-${loop}-${index}`, word })),
  ).flat(),
)

function scrollCarousel(direction: number) {
  const max = Math.max(carouselStories.value.length - 1, 0)
  carouselPosition.value = Math.min(max, Math.max(0, carouselPosition.value + direction))
}

function storyExcerpt(body: string) {
  return body.length > 140 ? `${body.slice(0, 137).trimEnd()}...` : body
}

function blogExcerpt(excerpt: string, body: string) {
  const source = excerpt || body
  return source.length > 140 ? `${source.slice(0, 137).trimEnd()}...` : source
}
</script>

<template>
  <MarketingPageShell>
    <MarketingHero :images="heroImages" />

    <section class="bg-[#f5f6f2] py-16 lg:py-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-12 text-center">
          <h2 class="font-headline text-3xl text-gray-900 lg:text-4xl">Produk GrowMate</h2>
          <p class="mx-auto mt-4 max-w-2xl text-gray-600">
            GrowMate menghadirkan solusi untuk budidaya skala kecil maupun besar agar pemantauan, perawatan, dan pengambilan keputusan menjadi lebih terarah.
          </p>
        </RevealBlock>

        <div class="flex flex-wrap justify-center gap-4 lg:gap-6">
          <RevealBlock v-for="(product, index) in gardenCards" :key="product._id" as="div" :delay="index * 70" origin="up" class="w-[calc(50%-0.5rem)] lg:w-[calc(25%-1.125rem)]">
            <MarketingProductCard :product="product" compact centered />
          </RevealBlock>
        </div>

        <div class="mt-10 text-center">
          <NuxtLink
            to="/products"
            class="gm-soft-button inline-block rounded-full bg-gray-800 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Lihat Semua Produk
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="bg-white py-16 lg:py-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-12 text-center">
          <h2 class="font-headline text-3xl text-gray-900 lg:text-4xl">Hasil Panen dan Produk Pengguna</h2>
          <p class="mt-4 text-gray-600">Marketplace ini membantu pengguna mendistribusikan hasil panen, bibit, dan kebutuhan budidaya lain secara lebih langsung.</p>
        </RevealBlock>

        <div class="flex flex-wrap justify-center gap-4 lg:gap-6">
          <RevealBlock v-for="(product, index) in saleCards" :key="product._id" as="div" :delay="index * 70" origin="up" class="w-[calc(50%-0.5rem)] lg:w-[calc(25%-1.125rem)]">
            <MarketingProductCard :product="product" compact centered />
          </RevealBlock>
        </div>

        <div class="mt-10 text-center">
          <NuxtLink
            to="/marketplace"
            class="gm-soft-button inline-block rounded-full bg-gray-800 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Buka Marketplace
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="bg-white py-16 lg:py-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-12 text-center">
          <h2 class="font-headline text-3xl text-gray-900 lg:text-4xl">Pustaka Tanaman</h2>
          <p class="mx-auto mt-4 max-w-2xl text-gray-600">
            Pelajari profil tanaman, tahap pertumbuhan, dan kebutuhan budidaya agar pengguna dapat mengambil keputusan perawatan dengan lebih percaya diri.
          </p>
        </RevealBlock>

        <div class="mb-10 grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          <RevealBlock
            v-for="(preset, index) in podCards"
            :key="preset._id"
            as="NuxtLink"
            :to="'/plant-library'"
            :delay="index * 60"
            origin="up"
            class="gm-card-lift group block cursor-pointer"
          >
            <div class="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
              <img
                v-if="preset.imageUrl"
                :src="getImageUrl(preset.imageUrl, 400) || undefined"
                :alt="preset.name"
                class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <div v-else class="flex h-full items-center justify-center text-gm-primary">
                <span class="material-symbols-outlined gm-visual-icon">yard</span>
              </div>
            </div>
            <h3 class="mb-1 text-sm font-medium text-gray-900">{{ preset.name }}</h3>
            <p class="text-sm text-gray-600">{{ preset.category }} preset</p>
          </RevealBlock>
        </div>

        <div class="text-center">
          <NuxtLink
            to="/plant-library"
            class="gm-soft-button inline-block rounded-full bg-gray-800 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Jelajahi Pustaka Tanaman
          </NuxtLink>
        </div>
      </div>
    </section>

    <section class="bg-[#f5f6f2] py-16 lg:py-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-12 text-center">
          <h2 class="font-headline text-3xl text-gray-900 lg:text-4xl">Tumbuh Lebih Cerdas, Bekerja Lebih Ringan</h2>
          <p class="mx-auto mt-4 max-w-2xl text-gray-600">
            Artikel ini menjelaskan wawasan, pembaruan, dan panduan praktis agar pengguna memahami manfaat GrowMate dalam budidaya sehari-hari.
          </p>
        </RevealBlock>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <RevealBlock v-for="(post, index) in blogCards.slice(0, 4)" :key="post._id" as="article" :delay="index * 70" origin="up" class="gm-card-lift group">
            <NuxtLink :to="`/blog/${post._id}`" class="block">
              <div class="mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-[#eef4e8]">
                <img v-if="post.imageUrl" :src="getImageUrl(post.imageUrl, 800) || undefined" :alt="post.title" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" decoding="async" width="800" height="600" />
                <div v-else class="flex h-full w-full items-center justify-center text-gm-primary">
                  <span class="material-symbols-outlined gm-visual-icon">edit_square</span>
                </div>
              </div>
              <p class="mb-2 text-xs text-gray-500">{{ post.relativeTime }}</p>
              <h3 class="mb-2 text-base leading-snug font-semibold text-gray-900">{{ post.title }}</h3>
              <p class="mb-3 text-sm text-gray-600">{{ blogExcerpt(post.excerpt, post.body) }}</p>
              <span class="inline-flex items-center text-sm font-medium text-gm-primary">
                Baca artikel
                <span class="gm-interactive-icon material-symbols-outlined ml-1 text-[16px]">arrow_forward</span>
              </span>
            </NuxtLink>
          </RevealBlock>
        </div>

        <div class="mt-10 text-center">
          <NuxtLink
            to="/blog"
            class="gm-soft-button inline-block rounded-full bg-gray-800 px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            Buka Blog GrowMate
          </NuxtLink>
        </div>

      </div>
    </section>

    <MarketingFeatures />

    <section class="overflow-hidden bg-white py-16 lg:py-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-12 text-center">
          <h2 class="mb-4 font-headline text-3xl text-gray-900 lg:text-4xl">Cerita dari Pengguna GrowMate</h2>
          <p class="text-gray-600">Lihat bagaimana pengguna membagikan perkembangan budidaya, hasil panen, dan pelajaran dari proses merawat tanaman.</p>
        </RevealBlock>

        <div class="lg:hidden">
          <div class="flex flex-wrap justify-center gap-4">
            <div
              v-for="story in carouselStories.slice(0, 4)"
              :key="story._id"
              class="w-[calc(50%-0.5rem)]"
            >
              <div class="gm-card-lift mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
                <img v-if="story.imageUrl" :src="getImageUrl(story.imageUrl, 800) || undefined" :alt="story.title" class="h-full w-full object-cover transition duration-300 hover:scale-105" loading="lazy" decoding="async" width="800" height="800" />
                <div v-else class="flex h-full items-center justify-center text-gm-primary">
                  <span class="material-symbols-outlined gm-visual-icon">forum</span>
                </div>
              </div>
              <p class="text-sm leading-relaxed text-gray-600">"{{ storyExcerpt(story.body) }}"</p>
              <p class="mt-2 text-sm font-medium text-gray-900">{{ story.user?.name || 'Pengguna GrowMate' }}</p>
            </div>
          </div>
        </div>

        <div class="relative hidden lg:block">
          <div class="overflow-hidden">
            <div
              class="flex gap-6 transition-transform duration-500"
              :class="carouselStories.length <= 3 ? 'justify-center' : ''"
              :style="`transform: translateX(-${carouselPosition * 33.333}%);`"
            >
              <div
                v-for="story in carouselStories"
                :key="story._id"
                class="w-[calc(33.333%-1rem)] flex-shrink-0"
                :class="carouselStories.length <= 3 ? 'max-w-80' : ''"
              >
                <div class="gm-card-lift mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
                  <img v-if="story.imageUrl" :src="getImageUrl(story.imageUrl, 800) || undefined" :alt="story.title" class="h-full w-full object-cover transition duration-300 hover:scale-105" loading="lazy" decoding="async" width="800" height="800" />
                  <div v-else class="flex h-full items-center justify-center text-gm-primary">
                    <span class="material-symbols-outlined gm-visual-icon">forum</span>
                  </div>
                </div>
                <p class="text-sm leading-relaxed text-gray-600">"{{ storyExcerpt(story.body) }}"</p>
                <p class="mt-2 text-sm font-medium text-gray-900">{{ story.user?.name || 'Pengguna GrowMate' }}</p>
              </div>
            </div>

            <button
              v-if="carouselStories.length > 3"
              class="absolute top-1/3 left-0 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-lg transition-colors hover:bg-white"
              type="button"
              @click="scrollCarousel(-1)"
            >
              <span class="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              v-if="carouselStories.length > 3"
              class="absolute top-1/3 right-0 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow-lg transition-colors hover:bg-white"
              type="button"
              @click="scrollCarousel(1)"
            >
              <span class="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="overflow-hidden border-t border-b border-gray-100 bg-white py-8">
      <div class="space-y-3">
        <div class="overflow-hidden whitespace-nowrap">
          <div class="gm-marquee-track gm-marquee-track-forward">
            <span
              v-for="item in marqueeTopItems"
              :key="item.key"
              class="mx-4 inline-block font-headline text-3xl lg:text-5xl"
              :class="item.word.includes('GrowMate') || item.word.includes('Plant') ? 'font-semibold text-gray-900' : 'text-gray-300'"
            >
              {{ item.word }}
            </span>
          </div>
        </div>

        <div class="overflow-hidden whitespace-nowrap">
          <div class="gm-marquee-track gm-marquee-track-reverse">
            <span
              v-for="item in marqueeBottomItems"
              :key="item.key"
              class="mx-4 inline-block font-headline text-3xl lg:text-5xl"
              :class="item.word.includes('GrowMate') || item.word.includes('Plant') ? 'font-semibold text-gray-900' : 'text-gray-300'"
            >
              {{ item.word }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>

<style scoped>
.gm-marquee-track {
  display: inline-block;
  min-width: max-content;
}

.gm-marquee-track-forward {
  animation: marquee-forward 34s linear infinite;
}

.gm-marquee-track-reverse {
  animation: marquee-reverse 42s linear infinite;
}

@keyframes marquee-forward {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(-33.333%);
  }
}

@keyframes marquee-reverse {
  0% {
    transform: translateX(-33.333%);
  }

  100% {
    transform: translateX(0);
  }
}
</style>
