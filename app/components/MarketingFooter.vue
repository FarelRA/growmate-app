<script setup lang="ts">
import { ref } from 'vue'

const openSection = ref<string | null>(null)

const sections = [
  {
    key: 'shop',
    title: 'Jelajahi GrowMate',
    links: [
      { label: 'Beranda', to: '/' },
      { label: 'Produk', to: '/products' },
      { label: 'Marketplace', to: '/marketplace' },
      { label: 'Pustaka Tanaman', to: '/plant-library' },
      { label: 'Tentang GrowMate', to: '/about' },
    ],
  },
  {
    key: 'growmate',
    title: 'GrowMate',
    links: [
      { label: 'Blog', to: '/blog' },
      { label: 'Cerita Pengguna', to: '/stories' },
      { label: 'Pusat Dukungan', to: '/support' },
      { label: 'Masuk', to: '/login' },
      { label: 'Daftar', to: '/register' },
    ],
  },
  {
    key: 'product',
    title: 'Ruang Kerja',
    links: [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'Marketplace Pengguna', to: '/workspace-marketplace' },
      { label: 'Komunitas', to: '/community' },
      { label: 'Asisten', to: '/assistant' },
    ],
  },
  {
    key: 'support',
    title: 'Langkah Awal',
    links: [
      { label: 'Klaim perangkat', to: '/claim-device' },
      { label: 'Pilih tanaman', to: '/select-plant' },
      { label: 'Lengkapi profil', to: '/complete-profile' },
    ],
  },
  {
    key: 'external',
    title: 'Pelajari Lebih Lanjut',
    links: [
      { label: 'Jelajah marketplace', to: '/marketplace' },
      { label: 'Kisah budidaya pengguna', to: '/stories' },
      { label: 'Artikel GrowMate', to: '/blog' },
      { label: 'Panduan dan dukungan', to: '/support' },
    ],
  },
]

const socials = [
  { label: 'Instagram', href: 'https://www.instagram.com/grow.mateai' },
  { label: 'WhatsApp', href: 'https://wa.me/6285157813352' },
]

function toggleSection(key: string) {
  openSection.value = openSection.value === key ? null : key
}
</script>

<template>
  <RevealBlock as="footer" class="bg-[#243224] text-white">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
      <div class="hidden gap-8 lg:grid lg:grid-cols-6">
        <div v-for="section in sections" :key="section.key">
          <h4 class="mb-4 text-sm font-semibold">{{ section.title }}</h4>
          <ul class="space-y-2.5">
            <li v-for="link in section.links" :key="link.to">
              <NuxtLink class="text-xs text-white/70 transition-colors duration-200 hover:translate-x-1 hover:text-white" :to="link.to">
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>
        </div>

        <div>
          <h4 class="mb-4 text-sm font-semibold">Ikuti GrowMate</h4>
          <div class="flex flex-col items-start gap-2">
            <a
              v-for="social in socials"
              :key="social.label"
              :href="social.href"
              class="text-xs text-white/70 transition-colors duration-200 hover:translate-x-1 hover:text-white"
              target="_blank"
              rel="noreferrer"
            >
              {{ social.label }}
            </a>
          </div>
        </div>
      </div>

      <div class="space-y-4 lg:hidden">
        <div v-for="section in sections" :key="section.key" class="border-b border-white/15 pb-4">
          <button class="flex w-full items-center justify-between text-left" @click="toggleSection(section.key)">
            <span class="text-sm font-semibold">{{ section.title }}</span>
            <span
              class="material-symbols-outlined text-[18px] transition-transform"
              :class="openSection === section.key ? 'rotate-45' : ''"
            >
              add
            </span>
          </button>
          <div v-if="openSection === section.key" class="mt-3 space-y-2.5">
            <NuxtLink
              v-for="link in section.links"
              :key="link.to"
              class="block text-xs text-white/70"
              :to="link.to"
            >
              {{ link.label }}
            </NuxtLink>
          </div>
        </div>

        <div class="border-b border-white/15 pb-4">
          <button class="flex w-full items-center justify-between text-left" @click="toggleSection('socials')">
            <span class="text-sm font-semibold">Ikuti GrowMate</span>
            <span
              class="material-symbols-outlined text-[18px] transition-transform"
              :class="openSection === 'socials' ? 'rotate-45' : ''"
            >
              add
            </span>
          </button>
          <div v-if="openSection === 'socials'" class="mt-3 flex flex-col items-start gap-2">
            <a
              v-for="social in socials"
              :key="social.label"
              :href="social.href"
              class="text-xs text-white/70"
              target="_blank"
              rel="noreferrer"
            >
              {{ social.label }}
            </a>
          </div>
        </div>
      </div>

      <div class="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/15 pt-8 lg:flex-row">
        <p class="text-xs text-white/55">© GrowMate 2026. Seluruh hak cipta dilindungi.</p>
        <div class="flex items-center gap-4">
          <NuxtLink class="text-xs text-white/55 transition-colors duration-200 hover:text-white" to="/support">Dukungan</NuxtLink>
          <NuxtLink class="text-xs text-white/55 transition-colors duration-200 hover:text-white" to="/login">Masuk</NuxtLink>
          <NuxtLink class="text-xs text-white/55 transition-colors duration-200 hover:text-white" to="/register">Daftar</NuxtLink>
        </div>
      </div>
    </div>
  </RevealBlock>
</template>
