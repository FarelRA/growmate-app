<script setup lang="ts">
import { computed } from 'vue'
import { toOptimizedImageUrl } from '@/lib/images'

const props = defineProps<{
  product: {
    _id: string
    title: string
    image?: string | null
    priceLabel?: string
    statusLabel?: string
    category?: string
    sellerName?: string
    type?: 'official' | 'community'
    shopeeUrl?: string | null
  }
  compact?: boolean
  centered?: boolean
}>()

const target = computed(() => {
  if (props.product.type === 'community') {
    return '/login'
  }

  return props.product.shopeeUrl || `/products/${props.product._id}`
})

const isExternal = computed(() =>
  typeof target.value === 'string' && /^https?:\/\//.test(target.value),
)

const isCommunity = computed(() => props.product.type === 'community')
const cardImage = computed(() => toOptimizedImageUrl(props.product.image, { width: 720, height: 720, quality: 72 }))

function openCommunityListing() {
  return navigateTo('/login')
}
</script>

<template>
  <a
    v-if="isExternal"
    :href="target"
    target="_blank"
    rel="noreferrer"
    class="gm-card-lift group block cursor-pointer"
  >
    <div class="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
      <span
        v-if="product.statusLabel && product.statusLabel !== 'Active'"
        class="absolute top-3 left-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gm-text backdrop-blur-sm"
      >
        {{ product.statusLabel }}
      </span>
      <img
        v-if="product.image"
        :src="cardImage || undefined"
        :alt="product.title"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
        width="720"
        height="720"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#b7d8b1,transparent_45%),linear-gradient(135deg,#eef5ea,#f7efe5)] text-center"
      >
        <div>
          <span class="material-symbols-outlined text-4xl text-gm-primary">potted_plant</span>
          <p class="mt-2 px-4 text-sm font-semibold text-gm-text">{{ product.title }}</p>
        </div>
      </div>
    </div>
    <div :class="centered ? 'text-center' : ''">
      <div v-if="product.category" class="mb-1 text-[11px] uppercase tracking-[0.18em] text-gm-muted">
        {{ product.category }}
      </div>
      <h3 class="mb-1 text-sm font-medium text-gray-900">{{ product.title }}</h3>
      <p class="text-sm text-gray-600">{{ product.priceLabel || product.sellerName || 'Lihat detail' }}</p>
    </div>
  </a>

  <button
    v-else-if="isCommunity"
    type="button"
    class="gm-card-lift group block w-full cursor-pointer text-left"
    @click="openCommunityListing"
  >
    <div class="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
      <span
        v-if="product.statusLabel && product.statusLabel !== 'Active'"
        class="absolute top-3 left-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gm-text backdrop-blur-sm"
      >
        {{ product.statusLabel }}
      </span>
      <img
        v-if="product.image"
        :src="cardImage || undefined"
        :alt="product.title"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
        width="720"
        height="720"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#b7d8b1,transparent_45%),linear-gradient(135deg,#eef5ea,#f7efe5)] text-center"
      >
        <div>
          <span class="material-symbols-outlined text-4xl text-gm-primary">potted_plant</span>
          <p class="mt-2 px-4 text-sm font-semibold text-gm-text">{{ product.title }}</p>
        </div>
      </div>
    </div>
    <div :class="centered ? 'text-center' : ''">
      <div v-if="product.category" class="mb-1 text-[11px] uppercase tracking-[0.18em] text-gm-muted">
        {{ product.category }}
      </div>
      <h3 class="mb-1 text-sm font-medium text-gray-900">{{ product.title }}</h3>
      <p class="text-sm text-gray-600">{{ product.priceLabel || product.sellerName || 'Lihat detail' }}</p>
    </div>
  </button>

  <NuxtLink v-else :to="target" class="gm-card-lift group block cursor-pointer">
    <div class="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
      <span
        v-if="product.statusLabel && product.statusLabel !== 'Active'"
        class="absolute top-3 left-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gm-text backdrop-blur-sm"
      >
        {{ product.statusLabel }}
      </span>
      <img
        v-if="product.image"
        :src="cardImage || undefined"
        :alt="product.title"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
        width="720"
        height="720"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#b7d8b1,transparent_45%),linear-gradient(135deg,#eef5ea,#f7efe5)] text-center"
      >
        <div>
          <span class="material-symbols-outlined text-4xl text-gm-primary">potted_plant</span>
          <p class="mt-2 px-4 text-sm font-semibold text-gm-text">{{ product.title }}</p>
        </div>
      </div>
    </div>
    <div :class="centered ? 'text-center' : ''">
      <div v-if="product.category" class="mb-1 text-[11px] uppercase tracking-[0.18em] text-gm-muted">
        {{ product.category }}
      </div>
      <h3 class="mb-1 text-sm font-medium text-gray-900">{{ product.title }}</h3>
      <p class="text-sm text-gray-600">{{ product.priceLabel || product.sellerName || 'Lihat detail' }}</p>
    </div>
  </NuxtLink>
</template>
