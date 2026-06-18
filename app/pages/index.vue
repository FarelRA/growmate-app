<script setup lang="ts">
import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import { toOptimizedImageUrl } from '@/lib/images'
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

const { data: marketplace } = await usePublicConvexQuery('public-marketplace-home', api.marketplace.marketplace, {})
const { data: community } = await usePublicConvexQuery('public-community-home', api.community.community, {})
const { data: plantLibrary } = await usePublicConvexQuery('public-plant-library-home', api.plants.plantLibrary, {})
const { data: blogPosts } = await usePublicConvexQuery('public-blog-home', api.blog.publicBlog, {})

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
    featuredProduct.value?.image,
    officialProducts.value[1]?.image,
    communityProducts.value[0]?.image,
    stories.value[0]?.image,
    presets.value[0]?.image,
    presets.value[1]?.image,
  ].filter(Boolean)

  return Array.from({ length: 4 }, (_, index) => pool[index] ?? null)
})
const heroImagePrimary = computed(() => toOptimizedImageUrl(heroImages.value[0], { width: 900, height: 700, quality: 74 }))
const heroImageSecondary = computed(() => toOptimizedImageUrl(heroImages.value[1], { width: 700, height: 700, quality: 72 }))
const heroImageCommunity = computed(() => toOptimizedImageUrl(heroImages.value[2], { width: 700, height: 700, quality: 72 }))
const heroImageLibrary = computed(() => toOptimizedImageUrl(heroImages.value[3], { width: 900, height: 700, quality: 72 }))

const proofCards = [
  {
    title: 'Pendampingan yang mudah dipahami',
    detail: 'Pengguna dibantu memahami apa yang perlu dilakukan sejak awal tanam hingga masa panen tanpa harus menebak kondisi tanaman.',
    icon: 'verified',
  },
  {
    title: 'Budidaya lebih konsisten',
    detail: 'Pemantauan kondisi dan alur perawatan membantu menjaga tanaman tetap produktif serta mengurangi risiko perawatan yang terlewat.',
    icon: 'routine',
  },
  {
    title: 'Komunitas dan pasar dalam satu tempat',
    detail: 'Pengguna dapat belajar dari pengalaman sesama petani sekaligus membuka peluang distribusi hasil panen secara langsung.',
    icon: 'favorite',
  },
  {
    title: 'Lebih hemat waktu dan tenaga',
    detail: 'Pemantauan, penyiraman, dan keputusan harian menjadi lebih praktis karena dibantu data lapangan dan otomatisasi.',
    icon: 'eco',
  },
]

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
    <section class="relative overflow-hidden bg-[linear-gradient(135deg,#f6fbf2_0%,#edf7e8_50%,#dfeeda_100%)]">
      <div class="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <div class="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <RevealBlock as="div" class="order-2 text-center lg:order-1 lg:text-left">
            <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">
              Platform Terpadu GrowMate
            </p>
            <h1 class="font-headline text-4xl leading-tight text-[#17351a] sm:text-5xl lg:text-6xl">
              Petani makmur,<br />
              tanpa lumpur.
            </h1>
            <p class="mx-auto mt-6 mb-8 max-w-md text-gray-700 lg:mx-0">
              GrowMate adalah produk smart farming berteknologi tinggi yang memadukan Internet of Things dan asisten Artificial Intelligence untuk membantu perawatan tanaman yang praktis, efisien, dan mendukung ketahanan pangan berkelanjutan.
            </p>
            <div class="flex flex-wrap justify-center gap-3 lg:justify-start">
              <NuxtLink
                to="/products"
                class="gm-soft-button inline-block rounded-full bg-[#17351a] px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gm-primary"
              >
                Jelajahi Produk
              </NuxtLink>
              <NuxtLink
                to="/register"
                class="gm-soft-button inline-block rounded-full border border-[#17351a]/15 bg-white px-8 py-3.5 text-sm font-medium text-[#17351a] transition-colors hover:bg-[#f5f7f2]"
              >
                Mulai dengan GrowMate
              </NuxtLink>
            </div>
          </RevealBlock>

          <RevealBlock as="div" origin="left" :delay="120" class="order-1 lg:order-2">
            <div class="grid grid-cols-2 gap-3 lg:gap-4">
              <div class="space-y-3 lg:space-y-4">
                <div class="aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
                  <img
                    v-if="heroImages[0]"
                    :src="heroImagePrimary || undefined"
                    alt="Produk unggulan GrowMate"
                    class="h-full w-full object-cover"
                    fetchpriority="high"
                    decoding="async"
                    width="900"
                    height="700"
                  />
                  <div v-else class="flex h-full items-center justify-center bg-[#ebf4e7] text-gm-primary">
                    <span class="material-symbols-outlined gm-visual-icon">devices</span>
                  </div>
                </div>
                <div class="aspect-square overflow-hidden rounded-2xl shadow-lg">
                  <img v-if="heroImages[1]" :src="heroImageSecondary || undefined" alt="Produk GrowMate" class="h-full w-full object-cover" loading="eager" decoding="async" width="700" height="700" />
                  <div v-else class="flex h-full items-center justify-center bg-[#f6efe8] text-gm-secondary">
                    <span class="material-symbols-outlined gm-visual-icon">shopping_basket</span>
                  </div>
                </div>
              </div>
              <div class="space-y-3 pt-6 lg:space-y-4 lg:pt-10">
                <div class="aspect-square overflow-hidden rounded-2xl shadow-lg">
                  <img v-if="heroImages[2]" :src="heroImageCommunity || undefined" alt="Marketplace komunitas GrowMate" class="h-full w-full object-cover" loading="lazy" decoding="async" width="700" height="700" />
                  <div v-else class="flex h-full items-center justify-center bg-[#e9f2ef] text-gm-primary">
                    <span class="material-symbols-outlined gm-visual-icon">groups</span>
                  </div>
                </div>
                <div class="aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
                  <img v-if="heroImages[3]" :src="heroImageLibrary || undefined" alt="Pustaka tanaman GrowMate" class="h-full w-full object-cover" loading="lazy" decoding="async" width="900" height="700" />
                  <div v-else class="flex h-full items-center justify-center bg-[#eef4e8] text-gm-primary">
                    <span class="material-symbols-outlined gm-visual-icon">potted_plant</span>
                  </div>
                </div>
              </div>
            </div>
          </RevealBlock>
        </div>
      </div>
    </section>

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
                v-if="preset.image"
                :src="preset.image"
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
                <img v-if="post.image" :src="toOptimizedImageUrl(post.image, { width: 960, height: 720, quality: 72 }) || undefined" :alt="post.title" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" decoding="async" width="960" height="720" />
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

    <section class="bg-[#f4efe6] py-16 lg:py-24">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="h2" class="mb-16 text-center font-headline text-3xl text-gray-900 lg:text-4xl">Mengapa GrowMate Relevan untuk Pengguna</RevealBlock>

        <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <RevealBlock v-for="(card, index) in proofCards" :key="card.title" as="div" :delay="index * 90" origin="up" class="gm-card-lift text-center">
            <div class="mx-auto mb-4 flex h-20 w-20 items-center justify-center text-gray-800">
              <span class="material-symbols-outlined gm-proof-icon">{{ card.icon }}</span>
            </div>
            <h3 class="mb-2 text-base font-semibold text-gray-900">{{ card.title }}</h3>
            <p class="text-sm text-gray-600">{{ card.detail }}</p>
          </RevealBlock>
        </div>

      </div>
    </section>

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
                <img v-if="story.image" :src="toOptimizedImageUrl(story.image, { width: 720, height: 720, quality: 72 }) || undefined" :alt="story.title" class="h-full w-full object-cover transition duration-300 hover:scale-105" loading="lazy" decoding="async" width="720" height="720" />
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
                  <img v-if="story.image" :src="toOptimizedImageUrl(story.image, { width: 720, height: 720, quality: 72 }) || undefined" :alt="story.title" class="h-full w-full object-cover transition duration-300 hover:scale-105" loading="lazy" decoding="async" width="720" height="720" />
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
