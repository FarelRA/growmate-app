<script setup lang="ts">
import { computed } from 'vue'
import { getImageUrl } from '@/lib/images'

const props = defineProps<{
  images: (string | null | undefined)[]
}>()

const primaryImageSrc = computed(() =>
  props.images[0] ? getImageUrl(props.images[0], 800) : null,
)
const secondaryImageSrc = computed(() =>
  props.images[1] ? getImageUrl(props.images[1], 800) : null,
)
const communityImageSrc = computed(() =>
  props.images[2] ? getImageUrl(props.images[2], 800) : null,
)
const libraryImageSrc = computed(() =>
  props.images[3] ? getImageUrl(props.images[3], 800) : null,
)
</script>

<template>
  <section
    class="relative overflow-hidden bg-[linear-gradient(135deg,#f6fbf2_0%,#edf7e8_50%,#dfeeda_100%)]"
  >
    <div class="mx-auto max-w-7xl px-4 pt-6 pb-12 sm:px-6 lg:px-8 lg:pt-10 lg:pb-20">
      <div class="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <RevealBlock as="div" class="order-2 text-center lg:order-1 lg:text-left">
          <p class="mb-4 text-xs font-semibold tracking-[0.28em] text-gm-primary uppercase">
            Platform Terpadu GrowMate
          </p>
          <h1 class="font-headline text-4xl leading-tight text-[#17351a] sm:text-5xl lg:text-6xl">
            Petani makmur,<br />
            tanpa lumpur.
          </h1>
          <p class="mx-auto mt-6 mb-8 max-w-md text-gray-700 lg:mx-0">
            GrowMate adalah produk smart farming berteknologi tinggi yang memadukan Internet of
            Things dan asisten Artificial Intelligence untuk membantu perawatan tanaman yang
            praktis, efisien, dan mendukung ketahanan pangan berkelanjutan.
          </p>
          <div class="flex flex-wrap justify-center gap-3 lg:justify-start">
            <NuxtLink
              to="/products"
              class="gm-soft-button inline-block rounded-full bg-[#17351a] px-8 py-3.5 text-sm font-medium text-white transition-colors hover:bg-gm-primary"
            >
              Jelajahi Produk
            </NuxtLink>
            <NuxtLink
              to="/register"
              class="gm-soft-button inline-block rounded-full border border-[#17351a]/15 bg-white px-8 py-3.5 text-sm font-medium text-[#17351a] transition-colors hover:bg-[#f5f7f2]"
            >
              Mulai dengan GrowMate
            </NuxtLink>
          </div>
        </RevealBlock>

        <RevealBlock as="div" origin="left" :delay="120" class="order-1 lg:order-2">
          <div class="grid grid-cols-2 gap-3 lg:gap-4">
            <div class="space-y-3 lg:space-y-4">
              <div class="aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
                <img
                  v-if="images[0]"
                  :src="primaryImageSrc || undefined"
                  alt="Produk unggulan GrowMate"
                  class="h-full w-full object-cover"
                  fetchpriority="high"
                  decoding="async"
                  width="800"
                  height="700"
                />
                <div
                  v-else
                  class="flex h-full items-center justify-center bg-[#ebf4e7] text-gm-primary"
                >
                  <span class="material-symbols-outlined gm-visual-icon">devices</span>
                </div>
              </div>
              <div class="aspect-square overflow-hidden rounded-2xl shadow-lg">
                <img
                  v-if="images[1]"
                  :src="secondaryImageSrc || undefined"
                  alt="Produk GrowMate"
                  class="h-full w-full object-cover"
                  loading="eager"
                  decoding="async"
                  width="800"
                  height="700"
                />
                <div
                  v-else
                  class="flex h-full items-center justify-center bg-[#f6efe8] text-gm-secondary"
                >
                  <span class="material-symbols-outlined gm-visual-icon">shopping_basket</span>
                </div>
              </div>
            </div>
            <div class="space-y-3 pt-6 lg:space-y-4 lg:pt-10">
              <div class="aspect-square overflow-hidden rounded-2xl shadow-lg">
                <img
                  v-if="images[2]"
                  :src="communityImageSrc || undefined"
                  alt="Marketplace komunitas GrowMate"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width="800"
                  height="700"
                />
                <div
                  v-else
                  class="flex h-full items-center justify-center bg-[#e9f2ef] text-gm-primary"
                >
                  <span class="material-symbols-outlined gm-visual-icon">groups</span>
                </div>
              </div>
              <div class="aspect-[4/3] overflow-hidden rounded-2xl shadow-lg">
                <img
                  v-if="images[3]"
                  :src="libraryImageSrc || undefined"
                  alt="Pustaka tanaman GrowMate"
                  class="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width="800"
                  height="700"
                />
                <div
                  v-else
                  class="flex h-full items-center justify-center bg-[#eef4e8] text-gm-primary"
                >
                  <span class="material-symbols-outlined gm-visual-icon">potted_plant</span>
                </div>
              </div>
            </div>
          </div>
        </RevealBlock>
      </div>
    </div>
  </section>
</template>
