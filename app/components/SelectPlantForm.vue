<script setup lang="ts">
import { lifecycleStageOptions } from '@/utils/plant-presets'
import type { PlantStageValue as PlantLifecycleStage } from '~~/convex/types'

const plantName = defineModel<string>('plantName', { required: true })
const plantSpecies = defineModel<string>('plantSpecies', { required: true })
const growthStage = defineModel<PlantLifecycleStage>('growthStage', { required: true })
const location = defineModel<string>('location', { required: true })
const wateringThreshold = defineModel<number>('wateringThreshold', { required: true })
const lightingThreshold = defineModel<number>('lightingThreshold', { required: true })

defineProps<{
  imagePreview: string | null
}>()

defineEmits<{
  (event: 'image-change', originalEvent: Event): void
}>()
</script>

<template>
  <div>
    <h2 class="font-headline text-2xl font-bold text-gm-text">Profil tanaman</h2>
    <p class="mt-2 text-sm text-gm-muted">
      Semua bagian profil dapat disesuaikan agar saran pemantauan dan perawatan lebih relevan untuk tanaman yang sedang dibudidayakan.
    </p>
  </div>

  <div class="grid gap-5 md:grid-cols-2">
    <div>
      <label class="mb-2 block text-sm font-semibold text-gm-text">Nama tanaman</label>
      <input
        v-model="plantName"
        type="text"
        class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary"
        placeholder="Basil di balkon saya"
      />
    </div>
    <div>
      <label class="mb-2 block text-sm font-semibold text-gm-text">Species</label>
      <input
        v-model="plantSpecies"
        type="text"
        class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary"
        placeholder="Ocimum basilicum"
      />
    </div>
    <div>
      <label class="mb-2 block text-sm font-semibold text-gm-text"
        >Tahap siklus hidup awal</label
      >
      <select
        v-model="growthStage"
        class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary"
      >
        <option
          v-for="stage in lifecycleStageOptions"
          :key="stage.value"
          :value="stage.value"
        >
          {{ stage.label }}
        </option>
      </select>
    </div>
    <div>
      <label class="mb-2 block text-sm font-semibold text-gm-text">Lokasi</label>
      <input
        v-model="location"
        type="text"
        class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary"
        placeholder="Rak dapur"
      />
    </div>
    <div>
      <label class="mb-2 block text-sm font-semibold text-gm-text"
        >Ambang penyiraman (%)</label
      >
      <input
        v-model="wateringThreshold"
        type="number"
        min="0"
        max="100"
        class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary"
      />
    </div>
    <div>
      <label class="mb-2 block text-sm font-semibold text-gm-text"
        >Ambang pencahayaan (%)</label
      >
      <input
        v-model="lightingThreshold"
        type="number"
        min="0"
        max="100"
        class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary"
      />
    </div>
  </div>

  <div>
    <label class="mb-2 block text-sm font-semibold text-gm-text">Gambar tanaman</label>
    <input
      type="file"
      accept="image/*"
      class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary"
      @change="$emit('image-change', $event)"
    />
  </div>

  <div v-if="imagePreview" class="overflow-hidden rounded-[1.5rem] bg-[#f3f3f3]">
    <img
      :src="imagePreview"
      :alt="plantName || 'Pratinjau tanaman'"
      class="h-56 w-full object-cover"
    />
  </div>
</template>
