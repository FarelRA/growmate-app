<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'
import { defaultCustomPlantPreset, lifecycleStageOptions, type LifecycleProfile, type PlantLifecycleStage } from '@/lib/plants'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'

definePageMeta({
  requiresAuth: true,
  onboarding: true,
})

const route = useRoute()
const router = useRouter()

const selectedPresetKey = ref('basil')
const librarySearch = ref('')
const categoryFilter = ref<'all' | 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'>('all')
const plantName = ref('')
const plantSpecies = ref('')
const growthStage = ref<PlantLifecycleStage>('seed_dormancy')
const location = ref('')
const imagePreview = ref<string | null>(null)
const wateringThreshold = ref(defaultCustomPlantPreset.wateringThreshold)
const lightingThreshold = ref(defaultCustomPlantPreset.lightingThreshold)
const lifecycleProfile = ref<LifecycleProfile>({ ...defaultCustomPlantPreset.lifecycleProfile })
const saving = ref(false)
const imageFile = ref<File | null>(null)

const { data: setupStatus } = useConvexQuery(api.growmate.checkSetupStatus, {})
const { data: devices } = useConvexQuery(api.growmate.userDevices, {})
const { data: plantLibrary } = useConvexQuery(api.growmate.plantLibrary, {})
const { mutate: assignPlantToDevice } = useConvexMutation(api.growmate.assignPlantToDevice)
const { mutate: generateImageUploadUrl } = useConvexMutation(api.growmate.generateImageUploadUrl)

const categories = ['all', 'herb', 'leafy', 'fruiting', 'houseplant', 'flower', 'microgreen'] as const

const targetDeviceId = computed(() => {
  const fromQuery = typeof route.query.deviceId === 'string' ? route.query.deviceId : null
  return fromQuery || setupStatus.value?.nextDeviceId || activeDeviceId.value || null
})

const targetDevice = computed(() => devices.value?.find((device) => device.deviceId === targetDeviceId.value) ?? null)
const presets = computed(() => plantLibrary.value ?? [])
const selectedPreset = computed(() => presets.value.find((preset) => preset.key === selectedPresetKey.value) ?? presets.value[0] ?? null)

const filteredPresets = computed(() => {
  const search = librarySearch.value.trim().toLowerCase()
  return presets.value.filter((preset) => {
    const matchesCategory = categoryFilter.value === 'all' || preset.category === categoryFilter.value
    const haystack = `${preset.name} ${preset.species} ${preset.description}`.toLowerCase()
    const matchesSearch = !search || haystack.includes(search)
    return matchesCategory && matchesSearch
  })
})

watch(presets, (items) => {
  if (!items.length) return
  if (!items.some((preset) => preset.key === selectedPresetKey.value)) {
    selectedPresetKey.value = items[0]!.key
  }
}, { immediate: true })

const totalLifecycleDays = computed(() => Object.values(lifecycleProfile.value).reduce((sum, value) => sum + value, 0))

watch(devices, (deviceList) => {
  if (!deviceList) return
  syncActiveDevice(deviceList)
}, { immediate: true })

watch(selectedPreset, (preset) => {
  if (!preset) return

  plantName.value = preset.name
  plantSpecies.value = preset.species
  growthStage.value = 'seed_dormancy'
  location.value = preset.location
  imagePreview.value = preset.image
  imageFile.value = null
  wateringThreshold.value = preset.wateringThreshold
  lightingThreshold.value = preset.lightingThreshold
  lifecycleProfile.value = { ...preset.lifecycleProfile }
}, { immediate: true })

function stageLabel(value: PlantLifecycleStage) {
  return lifecycleStageOptions.find((option) => option.value === value)?.label ?? value
}

function handleImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  imageFile.value = file
  imagePreview.value = readSelectedImage(file) ?? imagePreview.value
}

async function handleAssignPlant() {
  const deviceId = targetDeviceId.value
  if (!deviceId) {
    toast.error('Select a device first')
    return
  }

  if (!plantName.value.trim() || !plantSpecies.value.trim()) {
    toast.error('Plant name and species are required')
    return
  }

  saving.value = true
  try {
    const imageStorageId = imageFile.value
      ? await uploadImageFile(imageFile.value, () => generateImageUploadUrl({}))
      : undefined

    await assignPlantToDevice({
      deviceId,
      plantName: plantName.value.trim(),
      plantSpecies: plantSpecies.value.trim(),
      growthStage: growthStage.value,
      wateringThreshold: Number(wateringThreshold.value),
      lightingThreshold: Number(lightingThreshold.value),
      lifecycleProfile: {
        seedDormancyDays: Number(lifecycleProfile.value.seedDormancyDays),
        germinationDays: Number(lifecycleProfile.value.germinationDays),
        seedlingDevelopmentDays: Number(lifecycleProfile.value.seedlingDevelopmentDays),
        vegetativeGrowthDays: Number(lifecycleProfile.value.vegetativeGrowthDays),
        floweringReproductionDays: Number(lifecycleProfile.value.floweringReproductionDays),
        maturitySenescenceDays: Number(lifecycleProfile.value.maturitySenescenceDays),
      },
      location: location.value.trim() || undefined,
      imageStorageId: imageStorageId as never,
    })

    setActiveDeviceId(deviceId)
    toast.success(targetDevice.value?.plant ? 'Plant changed and previous plant archived' : 'Plant assigned successfully')

    const returnTo = typeof route.query.returnTo === 'string' ? route.query.returnTo : null
    if (returnTo) {
      await router.replace(returnTo)
      return
    }

    await router.replace('/dashboard')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to save plant'))
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
            <p class="text-xs font-bold uppercase tracking-[0.25em] text-gm-primary">Plant Setup</p>
            <h1 class="mt-2 font-headline text-4xl font-black tracking-tight text-gm-text">Choose a real care profile for this device</h1>
            <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">
              {{ targetDevice ? `You're configuring ${targetDevice.name}.` : 'Select a claimed device, then choose a preset plant or define a custom one.' }}
              Presets now include automation thresholds and lifecycle estimates from seed dormancy through maturity.
            </p>
          </div>
          <div v-if="targetDevice" class="rounded-2xl bg-[#f3f3f3] px-5 py-4 text-sm text-gm-muted">
            <div class="font-bold text-gm-text">{{ targetDevice.name }}</div>
            <div>{{ targetDevice.deviceId }}</div>
          </div>
        </div>
      </section>

      <section class="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <div class="space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_20px_80px_rgba(16,24,40,0.06)]">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 class="font-headline text-2xl font-bold text-gm-text">Plant library</h2>
              <p class="mt-2 text-sm text-gm-muted">Search a broader preset catalog, then tune the profile before saving.</p>
            </div>
            <input v-model="librarySearch" type="text" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 text-sm outline-none transition focus:border-gm-primary lg:max-w-xs" placeholder="Search basil, tomato, monstera..." />
          </div>

          <div class="flex flex-wrap gap-3">
            <button
              v-for="category in categories"
              :key="category"
              type="button"
              class="rounded-full px-4 py-2 text-xs font-bold uppercase tracking-[0.18em]"
              :class="categoryFilter === category ? 'bg-gm-primary text-white' : 'bg-[#f3f3f3] text-gm-muted'"
              @click="categoryFilter = category"
            >
              {{ category === 'all' ? 'All' : category }}
            </button>
          </div>

           <div v-if="filteredPresets.length" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
             <button
               v-for="preset in filteredPresets"
              :key="preset.key"
              type="button"
              class="overflow-hidden rounded-[1.5rem] border text-left transition-all"
              :class="selectedPresetKey === preset.key ? 'border-gm-primary bg-gm-primary/5 shadow-lg shadow-gm-primary/10' : 'border-[#e8e8e8] bg-white hover:border-gm-primary/40'"
              @click="selectedPresetKey = preset.key"
            >
              <img :src="preset.image" :alt="preset.name" class="h-36 w-full object-cover" />
              <div class="space-y-3 p-4">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h3 class="font-bold text-gm-text">{{ preset.name }}</h3>
                    <p class="text-xs text-gm-muted">{{ preset.species }}</p>
                  </div>
                  <span class="rounded-full bg-[#f3f3f3] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-muted">{{ preset.difficulty }}</span>
                </div>
                <p class="text-sm leading-relaxed text-gm-muted">{{ preset.description }}</p>
                <div class="grid grid-cols-2 gap-2 text-[11px] text-gm-muted">
                  <div class="rounded-xl bg-[#f7f7f7] px-3 py-2">Water {{ preset.wateringThreshold }}%</div>
                  <div class="rounded-xl bg-[#f7f7f7] px-3 py-2">Light {{ preset.lightingThreshold }}%</div>
                  <div class="col-span-2 rounded-xl bg-[#f7f7f7] px-3 py-2">Starts at {{ stageLabel('seed_dormancy') }}</div>
                </div>
              </div>
            </button>
          </div>
          <div v-else class="rounded-[1.5rem] border border-dashed border-[#d8d8d8] p-6 text-sm text-gm-muted">
            No plant presets match this search.
          </div>
        </div>

        <div class="space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_20px_80px_rgba(16,24,40,0.06)]">
          <div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">Plant profile</h2>
            <p class="mt-2 text-sm text-gm-muted">Every preset field is editable. Custom plants start from a safe default profile.</p>
          </div>

          <div class="grid gap-5 md:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-semibold text-gm-text">Plant name</label>
              <input v-model="plantName" type="text" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary" placeholder="My balcony basil" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gm-text">Species</label>
              <input v-model="plantSpecies" type="text" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary" placeholder="Ocimum basilicum" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gm-text">Starting lifecycle stage</label>
              <div class="w-full rounded-2xl bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text">{{ stageLabel(growthStage) }}</div>
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gm-text">Location</label>
              <input v-model="location" type="text" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary" placeholder="Kitchen shelf" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gm-text">Watering threshold (%)</label>
              <input v-model="wateringThreshold" type="number" min="0" max="100" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary" />
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-gm-text">Lighting threshold (%)</label>
              <input v-model="lightingThreshold" type="number" min="0" max="100" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary" />
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-semibold text-gm-text">Plant image</label>
            <input type="file" accept="image/*" class="w-full rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary" @change="handleImageChange" />
          </div>

          <div class="rounded-[1.5rem] bg-[#f7f7f7] p-5">
            <div class="flex items-center justify-between gap-4">
              <div>
                <h3 class="font-headline text-lg font-bold text-gm-text">Lifecycle timing</h3>
                <p class="mt-1 text-sm text-gm-muted">Estimated total cycle: {{ totalLifecycleDays }} days</p>
              </div>
              <span class="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gm-primary">6 stages</span>
            </div>

            <div class="mt-4 grid gap-3 md:grid-cols-2">
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Seed dormancy</span>
                <input v-model="lifecycleProfile.seedDormancyDays" type="number" min="0" class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary" />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Germination</span>
                <input v-model="lifecycleProfile.germinationDays" type="number" min="0" class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary" />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Seedling development</span>
                <input v-model="lifecycleProfile.seedlingDevelopmentDays" type="number" min="0" class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary" />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Vegetative growth</span>
                <input v-model="lifecycleProfile.vegetativeGrowthDays" type="number" min="0" class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary" />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Flowering / reproduction</span>
                <input v-model="lifecycleProfile.floweringReproductionDays" type="number" min="0" class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary" />
              </label>
              <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
                <span class="mb-2 block font-semibold text-gm-text">Maturity / senescence</span>
                <input v-model="lifecycleProfile.maturitySenescenceDays" type="number" min="0" class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary" />
              </label>
            </div>
          </div>

          <div v-if="imagePreview" class="overflow-hidden rounded-[1.5rem] bg-[#f3f3f3]">
            <img :src="imagePreview" :alt="plantName || 'Plant preview'" class="h-56 w-full object-cover" />
          </div>

          <button
            type="button"
            class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-lg shadow-gm-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="saving || !targetDeviceId"
            @click="handleAssignPlant"
          >
            {{ saving ? 'Saving plant...' : targetDevice?.plant ? 'Change Plant' : 'Assign Plant' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
