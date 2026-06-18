<script setup lang="ts">
import { computed, ref } from 'vue'
import { growmateTerms } from '@/lib/glossary'

const route = useRoute()

const mobileMenuOpen = ref(false)
const searchOpen = ref(false)
const searchQuery = ref('')

const navigation = [
  { label: growmateTerms.publicNav.products, to: '/products' },
  { label: growmateTerms.publicNav.marketplace, to: '/marketplace' },
  { label: growmateTerms.publicNav.plantLibrary, to: '/plant-library' },
  { label: growmateTerms.publicNav.support, to: '/support' },
  { label: growmateTerms.publicNav.about, to: '/about' },
]

const quickLinks = [
  { label: 'Produk', to: '/products', detail: 'Perangkat resmi GrowMate untuk budidaya cerdas' },
  { label: 'Marketplace', to: '/marketplace', detail: 'Hasil panen dan produk dari sesama pengguna GrowMate' },
  { label: 'Pustaka Tanaman', to: '/plant-library', detail: 'Daftar tanaman, profil tumbuh, dan panduan budidaya' },
  { label: 'Dukungan', to: '/support', detail: 'Panduan mulai, alur penggunaan, dan bantuan umum' },
  { label: 'Tentang', to: '/about', detail: 'Ringkasan solusi GrowMate untuk pertanian berkelanjutan' },
  { label: 'Blog', to: '/blog', detail: 'Artikel edukasi dan pembaruan resmi GrowMate' },
  { label: 'Cerita Pengguna', to: '/stories', detail: 'Pengalaman budidaya dari komunitas GrowMate' },
  { label: 'Daftar', to: '/register', detail: 'Buat akun untuk mulai memantau tanaman Anda' },
  { label: 'Masuk', to: '/login', detail: 'Buka ruang kerja GrowMate Anda' },
]

const filteredLinks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return [...navigation, ...quickLinks]

  return [...navigation, ...quickLinks].filter((item) =>
    `${item.label} ${item.detail ?? ''}`.toLowerCase().includes(query),
  )
})

function isActive(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}

function closeMenus() {
  mobileMenuOpen.value = false
  searchOpen.value = false
}
</script>

<template>
  <header class="sticky top-0 z-50 border-b border-[#edf0ea] bg-white/95 backdrop-blur-sm">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="flex h-16 items-center justify-between lg:h-20">
        <button
          class="-ml-2 rounded-full p-2 text-gm-muted lg:hidden"
          type="button"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <span class="material-symbols-outlined text-[22px]">
            {{ mobileMenuOpen ? 'close' : 'menu' }}
          </span>
        </button>

        <NuxtLink class="group flex items-center" to="/" @click="closeMenus">
          <img
            src="/growmate-logo.svg"
            alt="GrowMate"
            width="180"
            height="44"
            class="h-9 w-auto transition-transform duration-300 group-hover:-translate-y-0.5 sm:h-10 lg:h-11"
          />
        </NuxtLink>

        <nav class="hidden items-center gap-8 lg:flex">
          <NuxtLink
            v-for="item in navigation"
            :key="item.to"
            :to="item.to"
            class="text-sm font-medium transition-colors duration-200"
            :class="isActive(item.to) ? 'text-gm-text' : 'text-gray-600 hover:text-gm-text'"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>

        <div class="flex items-center gap-3 lg:gap-5">
          <button class="text-gray-700 transition-colors duration-200 hover:-translate-y-0.5 hover:text-gm-text" @click="searchOpen = true">
            <span class="material-symbols-outlined text-[22px]">search</span>
          </button>
          <NuxtLink class="hidden text-gray-700 transition-colors duration-200 hover:-translate-y-0.5 hover:text-gm-text sm:block" to="/login">
            <span class="material-symbols-outlined text-[22px]">person</span>
          </NuxtLink>
          <NuxtLink class="text-gray-700 transition-colors duration-200 hover:-translate-y-0.5 hover:text-gm-text" to="/marketplace">
            <span class="material-symbols-outlined text-[22px]">shopping_bag</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <div v-if="mobileMenuOpen" class="border-t border-[#edf0ea] bg-white lg:hidden">
      <div class="space-y-1 px-4 pt-2 pb-6">
        <NuxtLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="block border-b border-[#f2f4ef] px-3 py-3 text-base font-medium text-gray-700"
          @click="closeMenus"
        >
          {{ item.label }}
        </NuxtLink>
      </div>
    </div>

  </header>

  <Teleport to="body">
    <div
      v-if="searchOpen"
      class="fixed inset-0 z-[60] flex items-start justify-center bg-black/35 px-4 py-8 backdrop-blur-md"
      @click="searchOpen = false"
    >
      <RevealBlock as="div" origin="down" class="w-full max-w-2xl rounded-[2rem] bg-white p-5 shadow-2xl sm:p-6" @click.stop>
        <div class="flex items-center gap-3 rounded-full bg-[#f3f5f1] px-4 py-3 transition-shadow duration-300 focus-within:shadow-[0_0_0_4px_rgba(0,110,28,0.08)]">
          <span class="material-symbols-outlined text-gm-muted">search</span>
          <input
            v-model="searchQuery"
            autofocus
            class="w-full bg-transparent text-sm outline-none"
            placeholder="Cari produk, artikel, tanaman, atau halaman"
          />
          <button class="text-gm-muted" type="button" @click="searchOpen = false">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>

        <div class="mt-4 space-y-2">
          <NuxtLink
            v-for="item in filteredLinks"
            :key="`${item.to}-${item.label}`"
            :to="item.to"
            class="gm-card-lift block rounded-2xl border border-[#edf0ea] px-4 py-3 transition hover:bg-[#f7f8f5]"
            @click="closeMenus"
          >
            <div class="text-sm font-semibold text-gm-text">{{ item.label }}</div>
            <div v-if="item.detail" class="mt-1 text-xs text-gm-muted">{{ item.detail }}</div>
          </NuxtLink>
          <div
            v-if="!filteredLinks.length"
            class="rounded-2xl bg-[#f7f8f5] px-4 py-6 text-center text-sm text-gm-muted"
          >
            Belum ada halaman yang sesuai dengan pencarian Anda.
          </div>
        </div>
      </RevealBlock>
    </div>
  </Teleport>
</template>
