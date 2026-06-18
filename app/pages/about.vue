<script setup lang="ts">
import { createBreadcrumbSchema, createBusinessSchema, createOrganizationSchema } from '@/lib/seo'

definePageMeta({ public: true })

usePublicSeo({
  title: 'Tentang GrowMate | Solusi Pertanian Cerdas Berkelanjutan',
  description:
    'Pelajari GrowMate sebagai solusi pertanian cerdas yang memadukan IoT, otomatisasi, komunitas, marketplace, dan asisten AI untuk budidaya modern.',
  path: '/about',
  schema: [
    createOrganizationSchema(),
    createBusinessSchema(),
    createBreadcrumbSchema([
      { name: 'Beranda', path: '/' },
      { name: 'Tentang', path: '/about' },
    ]),
    {
      '@context': 'https://schema.org',
      '@type': 'AboutPage',
      name: 'Tentang GrowMate',
      url: 'https://growmate.bond/about',
      description:
        'Pelajari GrowMate sebagai solusi pertanian cerdas yang memadukan IoT, otomatisasi, komunitas, marketplace, dan asisten AI untuk budidaya modern.',
      inLanguage: 'id-ID',
    },
  ],
})

const pillars = [
  'GrowMate membantu pengguna memantau kondisi tanaman dan menjalankan perawatan dengan bantuan sensor serta otomatisasi.',
  'GrowMate menyediakan halaman publik untuk produk, marketplace hasil panen, dan pustaka tanaman agar pengguna dapat belajar sebelum mulai.',
  'GrowMate menyediakan ruang kerja privat untuk dukungan, percakapan marketplace, asisten budidaya, dan pengelolaan operasional harian.',
]
</script>

<template>
  <MarketingPageShell>
    <section class="bg-[linear-gradient(135deg,#f6fbf2_0%,#edf7e8_50%,#dfeeda_100%)]">
      <RevealBlock as="div" class="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
        <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Tentang</p>
        <h1 class="font-headline text-4xl text-[#17351a] sm:text-5xl">GrowMate hadir sebagai solusi pertanian cerdas untuk mendukung ketahanan pangan yang berkelanjutan.</h1>
        <p class="mt-5 max-w-3xl text-base text-gm-muted sm:text-lg">
          GrowMate memadukan perangkat IoT, otomatisasi, data lapangan, komunitas, marketplace, dan asisten AI agar kegiatan budidaya menjadi lebih efisien, mudah dipantau, dan lebih relevan untuk generasi muda maupun pelaku pertanian modern.
        </p>
      </RevealBlock>
    </section>

    <section class="bg-white py-16 lg:py-20">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div class="grid gap-6 md:grid-cols-3">
          <RevealBlock v-for="(pillar, index) in pillars" :key="pillar" as="article" :delay="index * 90" origin="up" class="gm-card-lift rounded-[2rem] bg-[#f5f6f2] p-6 sm:p-8">
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-gm-primary">
              <span class="material-symbols-outlined text-4xl">eco</span>
            </div>
            <p class="text-sm leading-relaxed text-gm-muted">{{ pillar }}</p>
          </RevealBlock>
        </div>
      </div>
    </section>

    <section class="bg-[#f5f6f2] py-16 lg:py-20">
      <div class="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <RevealBlock as="div" class="mb-8">
          <p class="mb-3 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">Legalitas</p>
          <h2 class="font-headline text-3xl text-gm-text sm:text-4xl">Identitas legal GrowMate</h2>
          <p class="mt-4 max-w-3xl text-sm leading-relaxed text-gm-muted sm:text-base">
            Informasi berikut merangkum legalitas usaha dan pencatatan hak cipta GrowMate sebagai bagian dari pengembangan solusi pertanian cerdas yang terstruktur dan dapat dipertanggungjawabkan.
          </p>
        </RevealBlock>

        <div class="grid gap-6 md:grid-cols-2">
          <RevealBlock as="article" origin="up" class="gm-card-lift rounded-[2rem] bg-white p-6 sm:p-8">
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f6f2] text-gm-primary">
              <span class="material-symbols-outlined text-4xl">badge</span>
            </div>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-gm-muted">Nomor Induk Berusaha</p>
            <p class="mt-3 font-headline text-2xl text-gm-text sm:text-3xl">1902260052173</p>
          </RevealBlock>

          <RevealBlock as="article" :delay="100" origin="up" class="gm-card-lift rounded-[2rem] bg-white p-6 sm:p-8">
            <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#f5f6f2] text-gm-primary">
              <span class="material-symbols-outlined text-4xl">copyright</span>
            </div>
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-gm-muted">Hak Cipta</p>
            <p class="mt-3 font-headline text-2xl text-gm-text sm:text-3xl">EC002026055570</p>
          </RevealBlock>
        </div>
      </div>
    </section>
  </MarketingPageShell>
</template>
