<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'
import {
  defaultCustomPlantPreset,
  defaultPlantSensorProfile,
  lifecycleStageOptions,
  type LifecycleProfile,
  type PlantSensorProfile,
  type PlantLifecycleStage,
} from '@/lib/plants'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'
import { usePlantSearch } from '@/composables/usePlantSearch'

definePageMeta({
  requiresAuth: true,
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
const imageFile = ref<File | null>(null)
const imagePreviewBlobUrl = ref<string | null>(null)

onBeforeUnmount(() => {
  if (imagePreviewBlobUrl.value) URL.revokeObjectURL(imagePreviewBlobUrl.value)
})

const { data: setupStatus } = useConvexQuery(api.users.checkSetupStatus, {})
const { data: devices } = useConvexQuery(api.devices.userDevices, {})
const { data: plantLibrary } = useConvexQuery(api.plants.plantLibrary, {})
const { mutate: assignPlantToDevice } = useConvexMutation(api.devices.assignPlantToDevice)


const presets = computed(() => plantLibrary.value ?? [])

const {
  selectedPresetKey,
  librarySearch,
  categoryFilter,
  filteredPresets,
  selectedPreset,
} = usePlantSearch(presets)

const targetDeviceId = computed(() => {
  const fromQuery = typeof route.query.deviceId === 'string' ? route.query.deviceId : null
  return fromQuery || setupStatus.value?.nextDeviceId || activeDeviceId.value || null
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

function cloneSensorProfile(profile?: Partial<PlantSensorProfile> | null): PlantSensorProfile {
  return {
    soil: { ...defaultPlantSensorProfile.soil, ...profile?.soil },
    light: { ...defaultPlantSensorProfile.light, ...profile?.light },
    temperature: { ...defaultPlantSensorProfile.temperature, ...profile?.temperature },
    air: { ...defaultPlantSensorProfile.air, ...profile?.air },
    water: { ...defaultPlantSensorProfile.water, ...profile?.water },
  }
}

watch(
  selectedPreset,
  (preset) => {
    if (!preset) return

    plantName.value = preset.name
    plantSpecies.value = preset.species
    growthStage.value = preset.growthStage
    location.value = preset.location
    imagePreview.value = preset.imageUrl
    imageFile.value = null
    wateringThreshold.value = preset.wateringThreshold
    lightingThreshold.value = preset.lightingThreshold
    sensorProfile.value = cloneSensorProfile(preset.sensorProfile)
    lifecycleProfile.value = { ...preset.lifecycleProfile }
  },
  { immediate: true },
)

function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  imageFile.value = file
  if (imagePreviewBlobUrl.value) URL.revokeObjectURL(imagePreviewBlobUrl.value)
  imagePreviewBlobUrl.value = readSelectedImage(file)
  imagePreview.value = imagePreviewBlobUrl.value ?? imagePreview.value
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
    const imageUrl = imageFile.value
      ? await uploadImageFile(imageFile.value)
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

        <div class="space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_20px_80px_rgba(16,24,40,0.06)]">
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
              @change="handleImageChange"
            />
          </div>

          <div class="rounded-[1.5rem] bg-[#f7f7f7] p-5">
            <div>
              <h3 class="font-headline text-lg font-bold text-gm-text">
                Rentang sensor yang cocok
              </h3>
              <p class="mt-1 text-sm text-gm-muted">
                    Sistem akan memakai rentang ini untuk menilai apakah kondisi tanaman sedang
                ideal.
              </p>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Kelembapan tanah (%)</span>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="sensorProfile.soil.min"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Min"
                  />
                  <input
                    v-model="sensorProfile.soil.max"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Maks"
                  />
                </div>
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Cahaya (%)</span>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="sensorProfile.light.min"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Min"
                  />
                  <input
                    v-model="sensorProfile.light.max"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Maks"
                  />
                </div>
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Suhu (C)</span>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="sensorProfile.temperature.min"
                    type="number"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Min"
                  />
                  <input
                    v-model="sensorProfile.temperature.max"
                    type="number"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Maks"
                  />
                </div>
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Kelembapan udara (%)</span>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="sensorProfile.air.min"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Min"
                  />
                  <input
                    v-model="sensorProfile.air.max"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Maks"
                  />
                </div>
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted md:col-span-2">
                <span class="mb-2 block font-semibold text-gm-text">Level air reservoir (%)</span>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="sensorProfile.water.min"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Min"
                  />
                  <input
                    v-model="sensorProfile.water.max"
                    type="number"
                    min="0"
                    max="100"
                    class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                    placeholder="Maks"
                  />
                </div>
              </label>
            </div>
          </div>

          <div class="rounded-[1.5rem] bg-[#f7f7f7] p-5">
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="font-headline text-lg font-bold text-gm-text">Durasi siklus hidup</h3>
                <p class="mt-1 text-sm text-gm-muted">
                  Estimasi total siklus: {{ totalLifecycleDays }} hari
                </p>
              </div>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Dormansi benih</span>
                <input
                  v-model="lifecycleProfile.seedDormancyDays"
                  type="number"
                  min="0"
                  class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Perkecambahan</span>
                <input
                  v-model="lifecycleProfile.germinationDays"
                  type="number"
                  min="0"
                  class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Perkembangan bibit</span>
                <input
                  v-model="lifecycleProfile.seedlingDevelopmentDays"
                  type="number"
                  min="0"
                  class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Pertumbuhan vegetatif</span>
                <input
                  v-model="lifecycleProfile.vegetativeGrowthDays"
                  type="number"
                  min="0"
                  class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Pembungaan / reproduksi</span>
                <input
                  v-model="lifecycleProfile.floweringReproductionDays"
                  type="number"
                  min="0"
                  class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Kematangan / senesens</span>
                <input
                  v-model="lifecycleProfile.maturitySenescenceDays"
                  type="number"
                  min="0"
                  class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
                />
              </label>
            </div>
          </div>

          <div v-if="imagePreview" class="overflow-hidden rounded-[1.5rem] bg-[#f3f3f3]">
            <img
              :src="imagePreview"
              :alt="plantName || 'Pratinjau tanaman'"
              class="h-56 w-full object-cover"
            />
          </div>

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
