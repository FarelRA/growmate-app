<script setup lang="ts">
import { createBreadcrumbSchema } from '@/lib/seo'

definePageMeta({ public: true })

usePublicSeo({
  title: 'Dukungan GrowMate | Panduan Memulai dan Bantuan Pengguna',
  description:
    'Temukan panduan memulai GrowMate, alur klaim perangkat, pemilihan tanaman, dan informasi dukungan untuk menggunakan platform secara lebih terarah.',
  path: '/support',
  schema: [
    createBreadcrumbSchema([
      { name: 'Beranda', path: '/' },
      { name: 'Dukungan', path: '/support' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'Bagaimana cara memulai dengan GrowMate?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Buat akun, lengkapi profil, klaim perangkat jika sudah tersedia, lalu pilih tanaman agar proses pemantauan dan perawatan dapat dimulai dengan jelas.',
          },
        },
        {
          '@type': 'Question',
          name: 'Apakah saya bisa melihat produk dan cerita pengguna sebelum masuk?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Bisa. Halaman publik GrowMate menampilkan produk, marketplace, pustaka tanaman, artikel, dan cerita pengguna sebelum Anda masuk ke ruang kerja pribadi.',
          },
        },
        {
          '@type': 'Question',
          name: 'Di mana percakapan dukungan dilakukan?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Setelah masuk, Anda dapat membuka ruang dukungan di dalam aplikasi untuk melanjutkan diskusi yang berkaitan dengan perangkat, tanaman, atau perawatan.',
          },
        },
      ],
    },
  ],
})

const faqs = [
  {
    title: 'Bagaimana cara memulai dengan GrowMate?',
    body: 'Buat akun, lengkapi profil, klaim perangkat jika sudah tersedia, lalu pilih tanaman agar proses pemantauan dan perawatan dapat dimulai dengan jelas.',
  },
  {
    title: 'Apakah saya bisa melihat produk dan cerita pengguna sebelum masuk?',
    body: 'Bisa. Halaman publik GrowMate menampilkan produk, marketplace, pustaka tanaman, artikel, dan cerita pengguna sebelum Anda masuk ke ruang kerja pribadi.',
  },
  {
    title: 'Di mana percakapan dukungan dilakukan?',
    body: 'Setelah masuk, Anda dapat membuka ruang dukungan di dalam aplikasi untuk melanjutkan diskusi yang berkaitan dengan perangkat, tanaman, atau perawatan.',
  },
]
</script>

<template>
  <MarketingPageShell>
    <section class="bg-[linear-gradient(135deg,#f6fbf2_0%,#edf7e8_50%,#dfeeda_100%)]">
      <RevealBlock as="div" class="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Dukungan</p>
        <h1 class="font-headline text-4xl text-[#17351a] sm:text-5xl">Panduan untuk membantu Anda tumbuh lebih siap dan lebih terarah.</h1>
        <p class="mt-5 max-w-3xl text-base text-gm-muted sm:text-lg">
          Halaman ini menjelaskan langkah awal penggunaan GrowMate agar pengguna memahami alur perangkat, tanaman, dan dukungan sejak awal.
        </p>
      </RevealBlock>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto grid max-w-5xl gap-6 px-4 sm:px-6 lg:px-8">
        <RevealBlock v-for="(faq, index) in faqs" :key="faq.title" as="article" :delay="index * 80" origin="up" class="gm-card-lift rounded-[2rem] bg-[#f5f6f2] p-6 sm:p-8">
          <h2 class="font-headline text-2xl text-gm-text">{{ faq.title }}</h2>
          <p class="mt-3 text-sm leading-relaxed text-gm-muted">{{ faq.body }}</p>
        </RevealBlock>

        <RevealBlock as="div" :delay="180" origin="up" class="gm-card-lift rounded-[2rem] bg-[#17351a] p-8 text-white">
          <h2 class="font-headline text-3xl">Butuh ruang kerja lengkap?</h2>
          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
            Masuk untuk membuka ruang dukungan, melihat pembacaan perangkat, mengatur otomasi, berbagi di komunitas, dan menggunakan asisten GrowMate secara penuh.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <NuxtLink to="/login" class="gm-soft-button rounded-full bg-white px-6 py-3 text-sm font-bold text-[#17351a]">Masuk</NuxtLink>
            <NuxtLink to="/register" class="gm-soft-button rounded-full border border-white/20 px-6 py-3 text-sm font-bold text-white">Buat akun</NuxtLink>
          </div>
        </RevealBlock>
      </div>
    </section>
  </MarketingPageShell>
</template>
