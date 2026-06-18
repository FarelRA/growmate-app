<script setup lang="ts">
import { computed } from 'vue'
import { api } from '@/lib/api'
import { createBreadcrumbSchema } from '@/lib/seo'

definePageMeta({ public: true })

usePublicSeo({
  title: 'Cerita Pengguna GrowMate | Pengalaman Budidaya dari Komunitas',
  description:
    'Temukan pengalaman nyata, pembelajaran, dan perkembangan budidaya yang dibagikan oleh komunitas pengguna GrowMate.',
  path: '/stories',
  schema: [
    createBreadcrumbSchema([
      { name: 'Beranda', path: '/' },
      { name: 'Cerita Pengguna', path: '/stories' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Cerita Pengguna GrowMate',
      url: 'https://growmate.bond/stories',
      description:
        'Temukan pengalaman nyata, pembelajaran, dan perkembangan budidaya yang dibagikan oleh komunitas pengguna GrowMate.',
      inLanguage: 'id-ID',
    },
  ],
})

const { data } = await usePublicConvexQuery('public-stories-index', api.community.community, {})
const stories = computed(() => data.value?.posts ?? [])
</script>

<template>
  <MarketingPageShell>
    <section class="bg-[#f5f6f2]">
      <RevealBlock as="div" class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Cerita Pengguna</p>
        <h1 class="font-headline text-4xl text-gm-text sm:text-5xl">Pengalaman nyata dari komunitas GrowMate.</h1>
        <p class="mt-5 max-w-3xl text-base text-gm-muted sm:text-lg">
          Halaman ini menampilkan cerita dan pembaruan dari pengguna yang sedang menjalankan proses budidaya mereka bersama GrowMate.
        </p>
      </RevealBlock>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <MarketingStoryCard v-for="story in stories" :key="story._id" :story="story" />
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
