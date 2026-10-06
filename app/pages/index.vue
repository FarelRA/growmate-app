<script setup lang="ts">
import { computed } from 'vue'
import { api } from '~~/convex/_generated/api'
import { createBreadcrumbSchema, createOrganizationSchema, createWebSiteSchema } from '~~/shared/utils/seo'

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

// Concurrent: sequential top-level awaits would stack each SSR timeout
// (4 x 8s) when the backend is unreachable; Promise.all bounds it to one.
const [marketplaceAsync, communityAsync, plantLibraryAsync, blogPostsAsync] = await Promise.all([
  usePublicConvexQuery<Record<string, unknown>, MarketplaceData>('public-marketplace-home', api.marketplace.marketplace, {}),
  usePublicConvexQuery<Record<string, unknown>, CommunityData>('public-community-home', api.community.community, {}),
  usePublicConvexQuery<Record<string, unknown>, PlantPreset[]>('public-plant-library-home', api.plants.plantLibrary, {}),
  usePublicConvexQuery<Record<string, unknown>, BlogPost[]>('public-blog-home', api.blog.publicBlog, {}),
])
const marketplace = marketplaceAsync.data
const community = communityAsync.data
const plantLibrary = plantLibraryAsync.data
const blogPosts = blogPostsAsync.data

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
</script>

<template>
  <MarketingPageShell>
    <MarketingHero :images="heroImages" />

    <HomeSections
      :garden-cards="gardenCards"
      :sale-cards="saleCards"
      :pod-cards="podCards"
      :blog-cards="blogCards"
      :carousel-stories="carouselStories"
      :marquee-top-items="marqueeTopItems"
      :marquee-bottom-items="marqueeBottomItems"
    />
  </MarketingPageShell>
</template>
