<script setup lang="ts">
import { computed } from 'vue'
import { api } from '@/lib/api'
import { getImageUrl } from '@/lib/images'
import { createBreadcrumbSchema } from '@/lib/seo'

interface BlogPost {
  _id: string
  title: string
  excerpt: string
  body: string
  imageUrl: string | null
  authorName: string
  relativeTime: string
}

definePageMeta({ public: true })

usePublicSeo({
  title: 'Blog GrowMate | Artikel Edukasi dan Wawasan Budidaya',
  description:
    'Baca artikel GrowMate tentang smart farming, pemantauan tanaman, pembaruan produk, dan wawasan budidaya untuk pengguna pertanian modern.',
  path: '/blog',
  schema: [
    createBreadcrumbSchema([
      { name: 'Beranda', path: '/' },
      { name: 'Blog', path: '/blog' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Blog GrowMate',
      url: 'https://growmate.bond/blog',
      description:
        'Baca artikel GrowMate tentang smart farming, pemantauan tanaman, pembaruan produk, dan wawasan budidaya untuk pengguna pertanian modern.',
      inLanguage: 'id-ID',
    },
  ],
})

const { data } = await usePublicConvexQuery<Record<string, unknown>, BlogPost[]>('public-blog-index', api.blog.publicBlog, {})
const posts = computed(() => data.value ?? [])

function excerpt(post: { excerpt: string; body: string }) {
  const source = post.excerpt || post.body
  return source.length > 180 ? `${source.slice(0, 177).trimEnd()}...` : source
}
</script>

<template>
  <MarketingPageShell>
    <section class="bg-[#f5f6f2]">
      <RevealBlock as="div" class="mx-auto max-w-7xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Blog GrowMate</p>
        <h1 class="font-headline text-4xl text-gm-text sm:text-5xl">Artikel untuk membantu pengguna memahami budidaya cerdas dengan lebih sederhana.</h1>
        <p class="mt-5 max-w-3xl text-base text-gm-muted sm:text-lg">
          Blog ini memuat pembahasan seputar penggunaan GrowMate, perkembangan produk, dan wawasan budidaya yang relevan dengan kebutuhan pengguna.
        </p>
      </RevealBlock>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div v-if="posts.length" class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <RevealBlock v-for="(post, index) in posts" :key="post._id" as="article" :delay="Math.min(index * 80, 240)" origin="up" class="gm-card-lift group rounded-[2rem] bg-[#f7f8f5] p-4 sm:p-5">
            <NuxtLink :to="`/blog/${post._id}`" class="block">
              <div class="mb-5 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#eef4e8]">
                <img v-if="post.imageUrl" :src="getImageUrl(post.imageUrl, 800) || undefined" :alt="post.title" class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" decoding="async" width="800" height="600" />
                <div v-else class="flex h-full items-center justify-center text-gm-primary">
                  <span class="material-symbols-outlined gm-visual-icon">edit_square</span>
                </div>
              </div>
              <div class="text-xs text-gm-muted">{{ post.relativeTime }} · {{ post.authorName }}</div>
              <h2 class="mt-3 font-headline text-2xl text-gm-text">{{ post.title }}</h2>
              <p class="mt-3 text-sm leading-relaxed text-gm-muted">{{ excerpt(post) }}</p>
              <span class="mt-4 inline-flex items-center text-sm font-semibold text-gm-primary">
                Baca artikel
                <span class="gm-interactive-icon material-symbols-outlined ml-1 text-[16px]">arrow_forward</span>
              </span>
            </NuxtLink>
          </RevealBlock>
        </div>

        <div v-else class="rounded-[2rem] bg-[#f5f6f2] p-10 text-center text-sm text-gm-muted">
          Belum ada artikel blog yang dipublikasikan.
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
