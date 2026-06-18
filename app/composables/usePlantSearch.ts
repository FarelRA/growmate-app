import { computed, ref, watch } from 'vue'
import { lifecycleStageOptions, type PlantPreset } from '@/lib/plants'

const categories = [
  'all',
  'herb',
  'leafy',
  'fruiting',
  'houseplant',
  'flower',
  'microgreen',
] as const

export type PlantCategory = (typeof categories)[number]

export function usePlantSearch(presetsRef: ReturnType<typeof computed<PlantPreset[]>>) {
  const selectedPresetKey = ref('basil')
  const librarySearch = ref('')
  const categoryFilter = ref<PlantCategory>('all')

  const filteredPresets = computed(() => {
    const search = librarySearch.value.trim().toLowerCase()
    return presetsRef.value.filter((preset) => {
      const matchesCategory =
        categoryFilter.value === 'all' || preset.category === categoryFilter.value
      const haystack = `${preset.name} ${preset.species} ${preset.description}`.toLowerCase()
      const matchesSearch = !search || haystack.includes(search)
      return matchesCategory && matchesSearch
    })
  })

  const selectedPreset = computed(
    () =>
      presetsRef.value.find((preset) => preset.key === selectedPresetKey.value) ??
      presetsRef.value[0] ??
      null,
  )

  watch(
    presetsRef,
    (items) => {
      if (!items.length) return
      if (!items.some((preset) => preset.key === selectedPresetKey.value)) {
        selectedPresetKey.value = items[0]!.key
      }
    },
    { immediate: true },
  )

  function stageLabel(value: string) {
    return lifecycleStageOptions.find((option) => option.value === value)?.label ?? value
  }

  return {
    selectedPresetKey,
    librarySearch,
    categoryFilter,
    categories,
    filteredPresets,
    selectedPreset,
    stageLabel,
  }
}
