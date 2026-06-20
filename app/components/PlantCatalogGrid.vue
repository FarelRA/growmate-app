<script setup lang="ts">
import type { PlantPreset } from '@/lib/plants'
import type { PlantCategory } from '@/composables/usePlantSearch'
import { lifecycleStageOptions } from '@/lib/plants'
import { getImageUrl } from '@/lib/images'

defineProps<{
  presets: PlantPreset[]
  filteredPresets: PlantPreset[]
  selectedPresetKey: string
  categoryFilter: PlantCategory
  librarySearch: string
}>()

const emit = defineEmits<{
  'update:selectedPresetKey': [value: string]
  'update:categoryFilter': [value: PlantCategory]
  'update:librarySearch': [value: string]
}>()

const categories: PlantCategory[] = [
  'all',
  'herb',
  'leafy',
  'fruiting',
  'houseplant',
  'flower',
  'microgreen',
]

function stageLabel(value: string) {
  return lifecycleStageOptions.find((option) => option.value === value)?.label ?? value
}
</script>

<template>
  <div class="space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_20px_80px_rgba(16,24,40,0.06)]">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h2 class="font-headline text-2xl font-bold text-gm-text">Pustaka tanaman</h2>
        <p class="mt-2 text-sm text-gm-muted">
          Pilih profil tanaman yang paling mendekati kondisi budidaya Anda, lalu sesuaikan jika diperlukan sebelum disimpan.
        </p>
      </div>
      <input
        :value="librarySearch"
        type="text"
        class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary lg:max-w-xs"
        placeholder="Cari basil, tomat, monstera..."
        @input="emit('update:librarySearch', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <div class="flex flex-wrap gap-3">
      <button
        v-for="category in categories"
        :key="category"
        type="button"
        class="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]"
        :class="
          categoryFilter === category
            ? 'bg-gm-primary text-white'
            : 'bg-[#f3f3f3] text-gm-muted'
        "
        @click="emit('update:categoryFilter', category)"
      >
        {{ category === 'all' ? 'Semua' : category }}
      </button>
    </div>

    <div v-if="filteredPresets.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <button
        v-for="preset in filteredPresets"
        :key="preset.key"
        type="button"
        class="overflow-hidden rounded-[1.5rem] border text-left transition-all"
        :class="
          selectedPresetKey === preset.key
            ? 'border-gm-primary bg-gm-primary/5 shadow-lg shadow-gm-primary/10'
            : 'border-[#e8e8e8] bg-white hover:border-gm-primary/40'
        "
        @click="emit('update:selectedPresetKey', preset.key)"
      >
        <img v-if="preset.imageUrl" :src="getImageUrl(preset.imageUrl, 400) || undefined" :alt="preset.name" class="h-36 w-full object-cover" />
        <div class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="font-bold text-gm-text">{{ preset.name }}</h3>
              <p class="text-xs text-gm-muted">{{ preset.species }}</p>
            </div>
            <span
              class="rounded-full bg-[#f3f3f3] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-muted"
            >
              {{
                preset.difficulty === 'easy'
                  ? 'mudah'
                  : preset.difficulty === 'medium'
                    ? 'menengah'
                    : 'lanjutan'
              }}
            </span>
          </div>
          <p class="text-sm leading-relaxed text-gm-muted">{{ preset.description }}</p>
          <div class="grid grid-cols-2 gap-2 text-[11px] text-gm-muted">
            <div class="rounded-xl bg-[#f7f7f7] px-3 py-2">
              Air {{ preset.wateringThreshold }}%
            </div>
            <div class="rounded-xl bg-[#f7f7f7] px-3 py-2">
              Cahaya {{ preset.lightingThreshold }}%
            </div>
            <div class="col-span-2 rounded-xl bg-[#f7f7f7] px-3 py-2">
              Mulai di {{ stageLabel(preset.growthStage) }}
            </div>
          </div>
        </div>
      </button>
    </div>
    <div
      v-else
      class="rounded-[1.5rem] border border-dashed border-[#d8d8d8] p-6 text-sm text-gm-muted"
    >
      Tidak ada preset tanaman yang cocok dengan pencarian ini.
    </div>
  </div>
</template>
