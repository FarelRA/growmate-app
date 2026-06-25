import { ref } from 'vue'
import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Id } from '@/lib/convex-types'
import {
  defaultLifecycleProfile,
  defaultPlantSensorProfile,
  type LifecycleProfile,
  type PlantSensorProfile,
  type PlantLifecycleStage,
} from '@/lib/plants'
import { uploadImageFile } from '@/lib/uploads'
import { useImageUpload } from './useImageUpload'
import type { AdminTab } from './useAdminDevices'

export function useAdminPlantPresets(activeTab: Ref<AdminTab>) {
  const { mutate: savePlantPreset } = useConvexMutation(api.admin.adminSavePlantPreset)
  const { mutate: deletePlantPreset } = useConvexMutation(api.admin.adminDeletePlantPreset)

  const img = useImageUpload()

  const savingPlantPreset = ref(false)
  const deletingPlantPresetId = ref<string | null>(null)

  const plantPresetForm = ref({
    presetId: null as string | null,
    key: '',
    name: '',
    species: '',
    growthStage: 'seed_dormancy' as PlantLifecycleStage,
    description: '',
    location: '',
    category: 'herb' as 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen',
    difficulty: 'easy' as 'easy' | 'medium' | 'advanced',
    wateringThreshold: 34,
    lightingThreshold: 30,
    fertilizingThreshold: 35,
    fertilizerCadenceDays: 14,
    pesticideCadenceDays: 30,
    nutrientNotes: '',
    sensorProfile: { ...defaultPlantSensorProfile } as PlantSensorProfile,
    lifecycleProfile: { ...defaultLifecycleProfile } as LifecycleProfile,
  })

  function cloneSensorProfile(profile?: Partial<PlantSensorProfile> | null): PlantSensorProfile {
    return {
      soil: { ...defaultPlantSensorProfile.soil, ...profile?.soil },
      light: { ...defaultPlantSensorProfile.light, ...profile?.light },
      temperature: { ...defaultPlantSensorProfile.temperature, ...profile?.temperature },
      air: { ...defaultPlantSensorProfile.air, ...profile?.air },
      water: { ...defaultPlantSensorProfile.water, ...profile?.water },
    }
  }

  function resetPlantPresetForm() {
    plantPresetForm.value = {
      presetId: null,
      key: '',
      name: '',
      species: '',
      growthStage: 'seed_dormancy',
      description: '',
      location: '',
      category: 'herb',
      difficulty: 'easy',
      wateringThreshold: 34,
      lightingThreshold: 30,
      fertilizingThreshold: 35,
      fertilizerCadenceDays: 14,
      pesticideCadenceDays: 30,
      nutrientNotes: '',
      sensorProfile: cloneSensorProfile(),
      lifecycleProfile: { ...defaultLifecycleProfile },
    }
    img.clearImage()
  }

  function editPlantPreset(preset: {
    _id: string
    key: string
    name: string
    species: string
    growthStage: PlantLifecycleStage
    description: string
    location: string
    category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'
    difficulty: 'easy' | 'medium' | 'advanced'
    wateringThreshold: number
    lightingThreshold: number
    fertilizingThreshold?: number
    fertilizerCadenceDays?: number
    pesticideCadenceDays?: number
    nutrientNotes?: string
    sensorProfile: PlantSensorProfile
    lifecycleProfile: LifecycleProfile
    imageUrl: string | null
  }) {
    plantPresetForm.value = {
      presetId: preset._id,
      key: preset.key,
      name: preset.name,
      species: preset.species,
      growthStage: preset.growthStage,
      description: preset.description,
      location: preset.location,
      category: preset.category,
      difficulty: preset.difficulty,
      wateringThreshold: preset.wateringThreshold,
      lightingThreshold: preset.lightingThreshold,
      fertilizingThreshold: preset.fertilizingThreshold ?? 35,
      fertilizerCadenceDays: preset.fertilizerCadenceDays ?? 14,
      pesticideCadenceDays: preset.pesticideCadenceDays ?? 30,
      nutrientNotes: preset.nutrientNotes ?? '',
      sensorProfile: cloneSensorProfile(preset.sensorProfile),
      lifecycleProfile: { ...preset.lifecycleProfile },
    }
    img.clearImage()
    img.setPreview(preset.imageUrl)
    activeTab.value = 'plants'
  }

  async function handleSavePlantPreset() {
    savingPlantPreset.value = true
    try {
      const imageUrl = img.file.value ? await uploadImageFile(img.file.value) : undefined
      await savePlantPreset({
        key: plantPresetForm.value.key || undefined,
        name: plantPresetForm.value.name,
        species: plantPresetForm.value.species,
        growthStage: plantPresetForm.value.growthStage,
        description: plantPresetForm.value.description,
        location: plantPresetForm.value.location,
        category: plantPresetForm.value.category,
        difficulty: plantPresetForm.value.difficulty,
        wateringThreshold: Number(plantPresetForm.value.wateringThreshold),
        lightingThreshold: Number(plantPresetForm.value.lightingThreshold),
        fertilizingThreshold: Number(plantPresetForm.value.fertilizingThreshold),
        fertilizerCadenceDays: Number(plantPresetForm.value.fertilizerCadenceDays),
        pesticideCadenceDays: Number(plantPresetForm.value.pesticideCadenceDays),
        nutrientNotes: plantPresetForm.value.nutrientNotes || undefined,
        sensorProfile: {
          soil: { min: Number(plantPresetForm.value.sensorProfile.soil.min), max: Number(plantPresetForm.value.sensorProfile.soil.max) },
          light: { min: Number(plantPresetForm.value.sensorProfile.light.min), max: Number(plantPresetForm.value.sensorProfile.light.max) },
          temperature: { min: Number(plantPresetForm.value.sensorProfile.temperature.min), max: Number(plantPresetForm.value.sensorProfile.temperature.max) },
          air: { min: Number(plantPresetForm.value.sensorProfile.air.min), max: Number(plantPresetForm.value.sensorProfile.air.max) },
          water: { min: Number(plantPresetForm.value.sensorProfile.water.min), max: Number(plantPresetForm.value.sensorProfile.water.max) },
        },
        lifecycleProfile: {
          seedDormancyDays: Number(plantPresetForm.value.lifecycleProfile.seedDormancyDays),
          germinationDays: Number(plantPresetForm.value.lifecycleProfile.germinationDays),
          seedlingDevelopmentDays: Number(plantPresetForm.value.lifecycleProfile.seedlingDevelopmentDays),
          vegetativeGrowthDays: Number(plantPresetForm.value.lifecycleProfile.vegetativeGrowthDays),
          floweringReproductionDays: Number(plantPresetForm.value.lifecycleProfile.floweringReproductionDays),
          maturitySenescenceDays: Number(plantPresetForm.value.lifecycleProfile.maturitySenescenceDays),
        },
        ...(plantPresetForm.value.presetId ? { presetId: plantPresetForm.value.presetId as Id<'plantCatalog'> } : {}),
        ...(imageUrl ? { imageUrl: imageUrl } : {}),
      })
      toast.success(plantPresetForm.value.presetId ? 'Preset tanaman diperbarui' : 'Preset tanaman dibuat')
      resetPlantPresetForm()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan preset tanaman'))
    } finally {
      savingPlantPreset.value = false
    }
  }

  async function handleDeletePlantPreset(presetId: string) {
    deletingPlantPresetId.value = presetId
    try {
      await deletePlantPreset({ presetId: presetId as Id<'plantCatalog'> })
      if (plantPresetForm.value.presetId === presetId) resetPlantPresetForm()
      toast.success('Preset tanaman dihapus')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menghapus preset tanaman'))
    } finally {
      deletingPlantPresetId.value = null
    }
  }

  return {
    plantPresetForm,
    savingPlantPreset,
    deletingPlantPresetId,
    plantPresetImageFile: img.file,
    plantPresetImagePreview: img.preview,
    plantPresetImageBlobUrl: img.blobUrl,
    cloneSensorProfile,
    resetPlantPresetForm,
    editPlantPreset,
    handleSavePlantPreset,
    handleDeletePlantPreset,
    handlePlantPresetImageChange: img.handleImageChange,
  }
}
