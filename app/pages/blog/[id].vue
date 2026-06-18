<script setup lang="ts">
import { computed } from 'vue'
import { api } from '@/lib/api'
import { toOptimizedImageUrl } from '@/lib/images'
import { renderMarkdown } from '@/lib/markdown'
import { createBreadcrumbSchema, toAbsoluteUrl, toMetaDescription } from '@/lib/seo'

definePageMeta({ public: true })

const route = useRoute()
const postId = computed(() => String(route.params.id || ''))
const { data } = await usePublicConvexQuery('public-blog-detail', api.blog.publicBlog, {})

const post = computed(() => (data.value ?? []).find((item) => item._id === postId.value) ?? null)
const renderedBody = computed(() => renderMarkdown(post.value?.body ?? ''))
const heroImage = computed(() => toOptimizedImageUrl(post.value?.image, { width: 1440, height: 960, quality: 74 }))

usePublicSeo({
  title: computed(() => (post.value ? `${post.value.title} | Blog GrowMate` : 'Blog GrowMate')),
  description: computed(
    () =>
      toMetaDescription(
        post.value?.excerpt ||
          post.value?.body ||
          'Baca artikel GrowMate tentang pertanian cerdas, IoT, dan budidaya yang lebih terarah.',
      ),
  ),
  path: computed(() => `/blog/${postId.value}`),
  image: computed(() => post.value?.image),
  type: 'article',
  schema: computed(() => {
    if (!post.value) {
      return createBreadcrumbSchema([
        { name: 'Beranda', path: '/' },
        { name: 'Blog', path: '/blog' },
      ])
    }

    return [
      createBreadcrumbSchema([
        { name: 'Beranda', path: '/' },
        { name: 'Blog', path: '/blog' },
        { name: post.value.title, path: `/blog/${postId.value}` },
      ]),
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.value.title,
        description: post.value.excerpt || post.value.body,
        image: post.value.image ? [toAbsoluteUrl(post.value.image)] : undefined,
        author: {
          '@type': 'Person',
          name: post.value.authorName,
        },
        publisher: {
          '@type': 'Organization',
          name: 'GrowMate',
          logo: {
            '@type': 'ImageObject',
            url: toAbsoluteUrl('/growmate-icon.png'),
          },
        },
        datePublished: new Date(post.value.createdAt).toISOString(),
        dateModified: new Date(post.value.updatedAt).toISOString(),
        mainEntityOfPage: toAbsoluteUrl(`/blog/${postId.value}`),
      },
    ]
  }),
})
</script>

<template>
  <MarketingPageShell>
    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div v-if="post">
          <RevealBlock as="div">
            <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Blog GrowMate</p>
            <h1 class="font-headline text-4xl text-gm-text sm:text-5xl">{{ post.title }}</h1>
            <div class="mt-4 text-sm text-gm-muted">{{ post.relativeTime }} · {{ post.authorName }}</div>
          </RevealBlock>

          <RevealBlock as="div" origin="scale" :delay="100" class="gm-card-lift mt-8 overflow-hidden rounded-[2rem] bg-[#eef4e8]">
            <img v-if="post.image" :src="heroImage || undefined" :alt="post.title" class="h-full max-h-[32rem] w-full object-cover" fetchpriority="high" decoding="async" width="1440" height="960" />
            <div v-else class="flex h-80 items-center justify-center text-gm-primary">
              <span class="material-symbols-outlined gm-visual-icon">edit_square</span>
            </div>
          </RevealBlock>

          <RevealBlock as="div" :delay="160" class="gm-card-lift mt-8 rounded-[2rem] bg-[#f8faf7] p-6 sm:p-8">
            <div class="gm-article text-gm-muted" v-html="renderedBody" />
          </RevealBlock>
        </div>

        <div v-else class="rounded-[2rem] bg-[#f5f6f2] p-10 text-center text-sm text-gm-muted">
          Artikel blog tidak ditemukan.
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
