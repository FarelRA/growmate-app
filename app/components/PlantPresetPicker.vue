<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { usePlantSearch } from '@/composables/usePlantSearch'
import type { PlantPreset } from '@/utils/plant-presets'

const props = defineProps<{
  presets: PlantPreset[]
}>()

const emit = defineEmits<{
  select: [preset: PlantPreset]
}>()

const presetsRef = computed(() => props.presets)

const {
  selectedPresetKey,
  librarySearch,
  categoryFilter,
  filteredPresets,
  selectedPreset,
} = usePlantSearch(presetsRef)

watch(selectedPreset, (preset) => {
  if (preset) emit('select', preset)
})

onMounted(() => {
  if (selectedPreset.value) emit('select', selectedPreset.value)
})
</script>

<template>
  <PlantCatalogGrid
    :presets="presets"
    :filtered-presets="filteredPresets"
    :selected-preset-key="selectedPresetKey"
    :category-filter="categoryFilter"
    :library-search="librarySearch"
    @update:selected-preset-key="selectedPresetKey = $event"
    @update:category-filter="categoryFilter = $event"
    @update:library-search="librarySearch = $event"
  />
</template>
