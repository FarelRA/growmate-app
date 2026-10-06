<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { api } from '~~/convex/_generated/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/composables/useActiveDevice'
import { getErrorMessage } from '~~/shared/utils/errors'
import {
  defaultCustomPlantPreset,
  type PlantPreset,
} from '@/utils/plant-presets'
import {
  defaultPlantSensorProfile,
  type LifecycleProfile,
  type PlantSensorProfile,
  type PlantStageValue as PlantLifecycleStage,
} from '~~/convex/types'
import { uploadImageFile } from '@/utils/uploads'
import { cloneSensorProfile } from '@/composables/useAdminPlantPresets'
import { useImageUpload } from '@/composables/useImageUpload'

definePageMeta({
  requiresAuth: true,
  onboarding: true,
})

const route = useRoute()
const router = useRouter()

const plantName = ref('')
const plantSpecies = ref('')
const growthStage = ref<PlantLifecycleStage>('seed_dormancy')
const location = ref('')
const imagePreview = ref<string | null>(null)
const wateringThreshold = ref(defaultCustomPlantPreset.wateringThreshold)
const lightingThreshold = ref(defaultCustomPlantPreset.lightingThreshold)
const sensorProfile = ref<PlantSensorProfile>({ ...defaultPlantSensorProfile })
const lifecycleProfile = ref<LifecycleProfile>({ ...defaultCustomPlantPreset.lifecycleProfile })
const saving = ref(false)
const upload = useImageUpload()

const { data: setupStatus } = useConvexQuery(api.users.checkSetupStatus, {})
const { data: devices } = useConvexQuery(api.devices.userDevices, {})
const { data: plantLibrary } = useConvexQuery(api.plants.plantLibrary, {})
const { mutate: assignPlantToDevice } = useConvexMutation(api.devices.assignPlantToDevice)


const presets = computed<PlantPreset[]>(() => plantLibrary.value ?? [])

function applyPreset(preset: PlantPreset) {
  plantName.value = preset.name
  plantSpecies.value = preset.species
  growthStage.value = preset.growthStage
  location.value = preset.location
  upload.clearImage()
  imagePreview.value = preset.imageUrl
  wateringThreshold.value = preset.wateringThreshold
  lightingThreshold.value = preset.lightingThreshold
  sensorProfile.value = cloneSensorProfile(preset.sensorProfile ?? defaultPlantSensorProfile)
  lifecycleProfile.value = { ...preset.lifecycleProfile }
}

const targetDeviceId = computed(() => {
  const fromQuery = typeof route.query.deviceId === 'string' ? route.query.deviceId : null
  const setupData = setupStatus.value as { nextDeviceId?: string | null } | null
  return fromQuery || setupData?.nextDeviceId || activeDeviceId.value || null
})

const targetDevice = computed(
  () => devices.value?.find((device) => device.deviceId === targetDeviceId.value) ?? null,
)

watch(
  devices,
  (deviceList) => {
    if (!deviceList) return
    syncActiveDevice(deviceList)
  },
  { immediate: true },
)

const totalLifecycleDays = computed(() =>
  Object.values(lifecycleProfile.value).reduce((sum, value) => sum + value, 0),
)

function handleImageChange(event: Event) {
  upload.handleImageChange(event)
  if (upload.blobUrl.value) {
    imagePreview.value = upload.blobUrl.value
  }
}

async function handleAssignPlant() {
  const deviceId = targetDeviceId.value
  if (!deviceId) {
    toast.error('Pilih perangkat terlebih dahulu')
    return
  }

  if (!plantName.value.trim() || !plantSpecies.value.trim()) {
    toast.error('Nama tanaman dan spesies wajib diisi')
    return
  }

  saving.value = true
  try {
    const imageUrl = upload.file.value
      ? await uploadImageFile(upload.file.value)
      : undefined

    await assignPlantToDevice({
      deviceId,
      plantName: plantName.value.trim(),
      plantSpecies: plantSpecies.value.trim(),
      growthStage: growthStage.value,
      wateringThreshold: Number(wateringThreshold.value),
      lightingThreshold: Number(lightingThreshold.value),
      sensorProfile: {
        soil: {
          min: Number(sensorProfile.value.soil.min),
          max: Number(sensorProfile.value.soil.max),
        },
        light: {
          min: Number(sensorProfile.value.light.min),
          max: Number(sensorProfile.value.light.max),
        },
        temperature: {
          min: Number(sensorProfile.value.temperature.min),
          max: Number(sensorProfile.value.temperature.max),
        },
        air: {
          min: Number(sensorProfile.value.air.min),
          max: Number(sensorProfile.value.air.max),
        },
        water: {
          min: Number(sensorProfile.value.water.min),
          max: Number(sensorProfile.value.water.max),
        },
      },
      lifecycleProfile: {
        seedDormancyDays: Number(lifecycleProfile.value.seedDormancyDays),
        germinationDays: Number(lifecycleProfile.value.germinationDays),
        seedlingDevelopmentDays: Number(lifecycleProfile.value.seedlingDevelopmentDays),
        vegetativeGrowthDays: Number(lifecycleProfile.value.vegetativeGrowthDays),
        floweringReproductionDays: Number(lifecycleProfile.value.floweringReproductionDays),
        maturitySenescenceDays: Number(lifecycleProfile.value.maturitySenescenceDays),
      },
      location: location.value.trim() || undefined,
      imageUrl: imageUrl ?? undefined,
    })

    setActiveDeviceId(deviceId)
    toast.success(
      targetDevice.value?.plant
        ? 'Tanaman berhasil diganti dan tanaman sebelumnya diarsipkan'
        : 'Tanaman berhasil dipasang',
    )

    const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : null
    const panel = typeof route.query.panel === 'string' ? route.query.panel : null
    if (returnTo) {
      await router.replace({
        path: returnTo,
        query: {
          panel: panel && panel !== 'overview' ? panel : undefined,
        },
      })
      return
    }

    await router.replace('/dashboard')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menyimpan tanaman'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-10">
    <div class="mx-auto max-w-7xl space-y-8">
      <section class="rounded-[2rem] bg-white p-8 shadow-[0_20px_80px_rgba(16,24,40,0.08)]">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.25em] text-gm-primary">
              Setup Tanaman
            </p>
            <h1 class="mt-2 font-headline text-4xl font-black tracking-tight text-gm-text">
              Pilih profil perawatan untuk perangkat ini
            </h1>
            <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">
              {{
                targetDevice
                  ? `Anda sedang mengatur ${targetDevice.name}.`
                  : 'Pilih perangkat yang sudah diklaim, lalu tentukan profil tanaman yang paling sesuai dengan kebutuhan budidaya Anda.'
              }}
              Anda dapat memilih profil yang tersedia atau menyesuaikannya agar lebih relevan dengan kondisi nyata.
            </p>
          </div>
        </div>
      </section>

      <section class="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <PlantPresetPicker :presets="presets" @select="applyPreset" />

        <div class="space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_20px_80px_rgba(16,24,40,0.06)]">
          <SelectPlantForm
            v-model:plantName="plantName"
            v-model:plantSpecies="plantSpecies"
            v-model:growthStage="growthStage"
            v-model:location="location"
            v-model:wateringThreshold="wateringThreshold"
            v-model:lightingThreshold="lightingThreshold"
            :image-preview="imagePreview"
            @image-change="handleImageChange"
          />

          <SelectPlantThresholds
            v-model:sensorProfile="sensorProfile"
            v-model:lifecycleProfile="lifecycleProfile"
            :total-lifecycle-days="totalLifecycleDays"
          />

          <button
            type="button"
            class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-lg shadow-gm-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving || !targetDeviceId"
            @click="handleAssignPlant"
          >
            {{
              saving
                ? 'Menyimpan tanaman...'
                : targetDevice?.plant
                  ? 'Ganti Tanaman'
                  : 'Pasang Tanaman'
            }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
