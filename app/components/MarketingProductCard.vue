<script setup lang="ts">
import { computed } from 'vue'
import { getImageUrl } from '@/lib/images'

const props = defineProps<{
  product: {
    _id: string
    title: string
    imageUrl?: string | null
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
const cardImage = computed(() => getImageUrl(props.product.imageUrl, 800))

const cardComponent = computed(() => {
  if (isExternal.value) return 'a'
  if (isCommunity.value) return 'button'
  return 'NuxtLink'
})

const cardAttrs = computed(() => {
  if (isExternal.value) return { href: target.value, target: '_blank', rel: 'noreferrer' }
  if (isCommunity.value) return { type: 'button' }
  return { to: target.value }
})

function openCommunityListing() {
  return navigateTo('/login')
}
</script>

<template>
  <component
    :is="cardComponent"
    v-bind="cardAttrs"
    :class="['gm-card-lift group block cursor-pointer', { 'w-full text-left': isCommunity }]"
    @click="isCommunity ? openCommunityListing() : undefined"
  >
    <div class="relative mb-3 aspect-square overflow-hidden rounded-xl bg-[#f5f6f2]">
      <span
        v-if="product.statusLabel && product.statusLabel !== 'Active'"
        class="absolute top-3 left-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-gm-text backdrop-blur-sm"
      >
        {{ product.statusLabel }}
      </span>
      <img
        v-if="product.imageUrl"
        :src="cardImage || undefined"
        :alt="product.title"
        class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
        width="800"
        height="800"
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
  </component>
</template>
