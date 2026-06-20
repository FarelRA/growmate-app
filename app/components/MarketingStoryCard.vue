<script setup lang="ts">
import { computed } from 'vue'
import { getImageUrl } from '@/lib/images'

const props = defineProps<{
  story: {
    _id: string
    title: string
    body: string
    imageUrl?: string | null
    timestamp?: string
    user?: { name?: string | null } | null
  }
}>()

const storyImage = computed(() => getImageUrl(props.story.imageUrl, 800))

function excerpt(value: string) {
  return value.length > 148 ? `${value.slice(0, 145).trimEnd()}...` : value
}
</script>

<template>
  <RevealBlock as="article" class="gm-card-lift group">
    <NuxtLink :to="`/stories/${story._id}`" class="block">
      <div class="mb-4 aspect-[4/3] overflow-hidden rounded-xl bg-[#f5f6f2]">
        <img
          v-if="story.imageUrl"
          :src="storyImage || undefined"
          :alt="story.title"
          class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
          decoding="async"
          width="800"
          height="600"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_top,#d8ead1,transparent_38%),linear-gradient(135deg,#f4f8f0,#faf2eb)]"
        >
          <span class="material-symbols-outlined text-5xl text-gm-primary/70">article</span>
        </div>
      </div>
      <p class="mb-2 text-xs text-gray-500">{{ story.timestamp || 'Cerita terbaru dari komunitas GrowMate' }}</p>
      <h3 class="mb-2 text-base leading-snug font-semibold text-gray-900">{{ story.title }}</h3>
      <p class="mb-3 text-sm text-gray-600">{{ excerpt(story.body) }}</p>
      <span class="inline-flex items-center text-sm font-medium text-gm-primary hover:text-[#0b7d29]">
        Baca selengkapnya
        <span class="gm-interactive-icon material-symbols-outlined ml-1 text-[16px]">arrow_forward</span>
      </span>
    </NuxtLink>
  </RevealBlock>
</template>
