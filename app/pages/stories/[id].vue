<script setup lang="ts">
import { computed } from 'vue'
import { api } from '@/lib/api'
import { toOptimizedImageUrl } from '@/lib/images'
import { createBreadcrumbSchema, toAbsoluteUrl, toMetaDescription } from '@/lib/seo'

definePageMeta({ public: true })

const route = useRoute()
const storyId = computed(() => String(route.params.id || ''))
const { data } = await usePublicConvexQuery('public-story-detail', api.growmate.community, {})

const story = computed(() => (data.value?.posts ?? []).find((item) => item._id === storyId.value) ?? null)
const storyImage = computed(() => toOptimizedImageUrl(story.value?.image, { width: 1440, height: 960, quality: 74 }))

usePublicSeo({
  title: computed(() => (story.value ? `${story.value.title} | Cerita Pengguna GrowMate` : 'Cerita GrowMate')),
  description: computed(
    () =>
      toMetaDescription(
        story.value?.body ||
          'Baca cerita pengguna GrowMate tentang pengalaman budidaya, pembelajaran, dan perkembangan tanaman mereka.',
      ),
  ),
  path: computed(() => `/stories/${storyId.value}`),
  image: computed(() => story.value?.image),
  type: 'article',
  schema: computed(() => {
    if (!story.value) {
      return createBreadcrumbSchema([
        { name: 'Beranda', path: '/' },
        { name: 'Cerita Pengguna', path: '/stories' },
      ])
    }

    return [
      createBreadcrumbSchema([
        { name: 'Beranda', path: '/' },
        { name: 'Cerita Pengguna', path: '/stories' },
        { name: story.value.title, path: `/stories/${storyId.value}` },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: story.value.title,
        description: story.value.body,
        image: story.value.image ? [toAbsoluteUrl(story.value.image)] : undefined,
        author: {
          '@type': 'Person',
          name: story.value.user?.name || 'Pengguna GrowMate',
        },
        publisher: {
          '@type': 'Organization',
          name: 'GrowMate',
        },
        datePublished: new Date(story.value.createdAt).toISOString(),
        dateModified: new Date(story.value.updatedAt).toISOString(),
        mainEntityOfPage: toAbsoluteUrl(`/stories/${storyId.value}`),
      },
    ]
  }),
})
</script>

<template>
  <MarketingPageShell>
    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div v-if="story">
          <RevealBlock as="div">
            <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Cerita GrowMate</p>
            <h1 class="font-headline text-4xl text-gm-text sm:text-5xl">{{ story.title }}</h1>
            <div class="mt-4 text-sm text-gm-muted">
              {{ story.timestamp }}
              <span v-if="story.user?.name"> · {{ story.user.name }}</span>
            </div>
          </RevealBlock>

          <RevealBlock as="div" origin="scale" :delay="100" class="gm-card-lift mt-8 overflow-hidden rounded-[2rem] bg-[#f5f6f2]">
            <img v-if="story.image" :src="storyImage || undefined" :alt="story.title" class="h-full max-h-[32rem] w-full object-cover" fetchpriority="high" decoding="async" width="1440" height="960" />
            <div v-else class="flex h-80 items-center justify-center text-gm-primary">
              <span class="material-symbols-outlined gm-visual-icon">article</span>
            </div>
          </RevealBlock>

          <RevealBlock as="div" :delay="160" class="gm-card-lift mt-8 rounded-[2rem] bg-[#f8faf7] p-6 sm:p-8">
            <p class="text-base leading-8 text-gm-muted">{{ story.body }}</p>
          </RevealBlock>

          <div class="mt-8 grid gap-4 sm:grid-cols-2">
            <RevealBlock as="div" :delay="220" origin="right" class="gm-card-lift rounded-[1.5rem] bg-[#f5f6f2] p-5">
              <div class="text-xs font-semibold uppercase tracking-[0.22em] text-gm-muted">Interaksi</div>
              <div class="mt-3 text-sm text-gm-text">{{ story.likeCount }} suka · {{ story.commentCount }} komentar</div>
            </RevealBlock>
            <RevealBlock as="div" :delay="280" origin="left" class="gm-card-lift rounded-[1.5rem] bg-[#17351a] p-5 text-white">
              <div class="text-xs font-semibold uppercase tracking-[0.22em] text-white/70">Gabung ke GrowMate</div>
              <p class="mt-3 text-sm text-white/80">Buat akun untuk memberi reaksi, berkomentar, dan membagikan perkembangan budidaya Anda sendiri di komunitas GrowMate.</p>
              <NuxtLink to="/register" class="gm-soft-button mt-4 inline-block rounded-full bg-white px-5 py-2.5 text-sm font-bold text-[#17351a]">Mulai sekarang</NuxtLink>
            </RevealBlock>
          </div>
        </div>

        <div v-else class="rounded-[2rem] bg-[#f5f6f2] p-10 text-center text-sm text-gm-muted">
          Cerita tidak ditemukan.
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
