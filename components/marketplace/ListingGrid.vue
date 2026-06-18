<script setup lang="ts">
defineProps<{
  featured: { _id: string; image?: string | null; title: string; description: string; priceLabel: string; shopeeUrl: string } | null
  filteredOfficial: { _id: string; image?: string | null; title: string; description: string; priceLabel: string; shopeeUrl: string }[]
  filteredCommunity: { _id: string; image?: string | null; title: string; description: string; priceLabel: string; statusLabel: string; quantityAvailable: number; locationLabel?: string | null; sellerName: string; contactThreadId: string | null; status: string }[]
  searchQuery: string
  selectedCategory: string
  hasWorkingImage: (id: string, image?: string | null) => boolean
}>()

defineEmits<{
  openExternal: [url: string]
  handleImageError: [id: string]
  'update:searchQuery': [value: string]
  'update:selectedCategory': [value: 'all' | 'official' | 'community']
  openInquiry: [listing: object]
}>()
</script>

<template>
  <section class="relative overflow-hidden rounded-[2rem] bg-[#f3f3f3] p-5 sm:p-8 md:p-10">
    <div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <div class="space-y-6">
        <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Marketplace</p>
        <h1 class="font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl md:text-5xl">
          Produk resmi GrowMate dan hasil budidaya komunitas.
        </h1>
        <p class="max-w-2xl text-sm leading-relaxed text-gm-muted">
          Halaman ini membantu pengguna melihat produk resmi GrowMate sekaligus mengelola jual beli hasil budidaya komunitas melalui percakapan langsung antara pembeli dan penjual.
        </p>
      </div>
      <div
        v-if="featured"
        class="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
      >
        <img
          v-if="hasWorkingImage(featured._id, featured.image)"
          :src="featured.image"
          :alt="featured.title"
          class="h-72 w-full object-cover"
          @error="$emit('handleImageError', featured._id)"
        />
        <div v-else class="flex h-72 w-full items-center justify-center bg-[#eef5ea] text-gm-primary">
          <span class="material-symbols-outlined gm-visual-icon">devices</span>
        </div>
        <div class="space-y-3 p-6">
          <div class="flex items-center justify-between gap-4">
            <span class="rounded-full bg-[#ee4d2d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Shopee</span>
            <span class="text-sm font-bold text-gm-primary">{{ featured.priceLabel }}</span>
          </div>
          <h2 class="font-headline text-2xl font-bold text-gm-text">{{ featured.title }}</h2>
          <p class="text-sm text-gm-muted">{{ featured.description }}</p>
          <button @click="$emit('openExternal', featured.shopeeUrl)" class="w-full rounded-full bg-[#ee4d2d] px-5 py-3 text-sm font-bold text-white">
            Beli via Shopee
          </button>
        </div>
      </div>
    </div>
  </section>

  <section class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
    <div class="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
      <button
        class="rounded-full px-5 py-2 text-sm font-semibold"
        :class="selectedCategory === 'all' ? 'bg-gm-primary text-white' : 'bg-[#e8e8e8] text-gm-muted'"
        @click="$emit('update:selectedCategory', 'all')"
      >Semua</button>
      <button
        class="rounded-full px-5 py-2 text-sm font-semibold"
        :class="selectedCategory === 'official' ? 'bg-gm-primary text-white' : 'bg-[#e8e8e8] text-gm-muted'"
        @click="$emit('update:selectedCategory', 'official')"
      >Resmi</button>
      <button
        class="rounded-full px-5 py-2 text-sm font-semibold"
        :class="selectedCategory === 'community' ? 'bg-gm-primary text-white' : 'bg-[#e8e8e8] text-gm-muted'"
        @click="$emit('update:selectedCategory', 'community')"
      >Komunitas</button>
    </div>
    <label class="w-full lg:max-w-sm">
      <span class="sr-only">Cari listing</span>
      <input
        :value="searchQuery"
        @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
        class="w-full rounded-full bg-[#e8e8e8] px-5 py-3 text-sm outline-none"
        placeholder="Cari listing, penjual, atau kategori..."
      />
    </label>
  </section>

  <section v-if="filteredOfficial.length" class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="font-headline text-2xl font-bold text-gm-text">Produk Resmi GrowMate</h2>
        <p class="text-sm text-gm-muted">Produk ini dijual di Shopee, bukan di dalam GrowMate.</p>
      </div>
    </div>
    <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="item in filteredOfficial"
        :key="item._id"
        class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
      >
        <img
          v-if="hasWorkingImage(item._id, item.image)"
          :src="item.image"
          :alt="item.title"
          class="h-52 w-full object-cover"
          @error="$emit('handleImageError', item._id)"
        />
        <div v-else class="flex h-52 w-full items-center justify-center bg-[#eef5ea] text-gm-primary">
          <span class="material-symbols-outlined gm-visual-icon">devices</span>
        </div>
        <div class="space-y-3 p-6">
          <div class="flex items-center justify-between gap-4">
            <span class="rounded-full bg-[#fff0ec] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ee4d2d]">Shopee</span>
            <span class="font-bold text-gm-primary">{{ item.priceLabel }}</span>
          </div>
          <h3 class="font-headline text-xl font-bold text-gm-text">{{ item.title }}</h3>
          <p class="text-sm text-gm-muted">{{ item.description }}</p>
          <button @click="$emit('openExternal', item.shopeeUrl)" class="w-full rounded-full bg-[#ee4d2d] px-5 py-3 text-sm font-bold text-white">Beli via Shopee</button>
        </div>
      </article>
    </div>
  </section>

  <section class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="font-headline text-2xl font-bold text-gm-text">Penawaran Komunitas</h2>
        <p class="text-sm text-gm-muted">Pembeli menghubungi penjual langsung. Pengambilan, pengiriman, dan pembayaran dilakukan di luar platform.</p>
      </div>
    </div>
    <div v-if="filteredCommunity.length" class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
      <article
        v-for="item in filteredCommunity"
        :key="item._id"
        class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
      >
        <img
          v-if="hasWorkingImage(item._id, item.image)"
          :src="item.image"
          :alt="item.title"
          class="h-48 w-full object-cover"
          @error="$emit('handleImageError', item._id)"
        />
        <div v-else class="flex h-48 w-full items-center justify-center bg-[#eef5ea] text-gm-primary">
          <span class="material-symbols-outlined gm-visual-icon">inventory_2</span>
        </div>
        <div class="space-y-3 p-5">
          <div class="flex items-center justify-between gap-3">
            <h3 class="font-headline text-lg font-bold text-gm-text">{{ item.title }}</h3>
            <span class="text-sm font-bold text-gm-primary">{{ item.priceLabel }}</span>
          </div>
          <p class="text-sm text-gm-muted">{{ item.description }}</p>
          <div class="flex flex-wrap gap-2 text-[11px] text-gm-muted">
            <span class="rounded-full bg-[#f3f3f3] px-3 py-1">{{ item.statusLabel }}</span>
            <span class="rounded-full bg-[#f3f3f3] px-3 py-1">{{ item.quantityAvailable }} tersedia</span>
            <span v-if="item.locationLabel" class="rounded-full bg-[#f3f3f3] px-3 py-1">{{ item.locationLabel }}</span>
          </div>
          <div class="flex items-center gap-2 text-sm text-gm-muted">
            <span class="material-symbols-outlined text-sm">person</span>
            {{ item.sellerName }}
          </div>
          <button
            @click="$emit('openInquiry', item)"
            class="w-full rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white"
            :disabled="item.status !== 'active'"
          >
            {{ item.contactThreadId ? 'Buka Percakapan' : 'Hubungi Penjual' }}
          </button>
        </div>
      </article>
    </div>
    <div v-else class="rounded-[2rem] bg-[#f3f3f3] p-8 text-center text-sm text-gm-muted">Tidak ada listing komunitas yang cocok dengan pencarian ini saat ini.</div>
  </section>
</template>
