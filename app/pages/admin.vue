<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { defaultLifecycleProfile, lifecycleStageOptions, type LifecycleProfile, type PlantLifecycleStage } from '@/lib/plants'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'

definePageMeta({
  requiresAuth: true,
})

const { data } = useConvexQuery(api.growmate.adminConsole, {})

const { mutate: saveDevice } = useConvexMutation(api.growmate.adminSaveDevice)
const { mutate: deleteDevice } = useConvexMutation(api.growmate.adminDeleteDevice)
const { mutate: updateSupportRequest } = useConvexMutation(api.growmate.adminUpdateSupportRequest)
const { mutate: sendSupportMessage } = useConvexMutation(api.growmate.sendSupportMessage)
const { mutate: saveOfficialProduct } = useConvexMutation(api.growmate.adminSaveOfficialProduct)
const { mutate: updateOfficialProductStatus } = useConvexMutation(api.growmate.adminUpdateOfficialProductStatus)
const { mutate: deleteOfficialProduct } = useConvexMutation(api.growmate.adminDeleteOfficialProduct)
const { mutate: updateUserAccess } = useConvexMutation(api.growmate.adminUpdateUserAccess)
const { mutate: generateImageUploadUrl } = useConvexMutation(api.growmate.generateImageUploadUrl)
const { mutate: savePlantPreset } = useConvexMutation(api.growmate.adminSavePlantPreset)
const { mutate: deletePlantPreset } = useConvexMutation(api.growmate.adminDeletePlantPreset)

const activeTab = ref<'overview' | 'devices' | 'support' | 'products' | 'plants' | 'accounts'>('overview')
const savingDevice = ref(false)
const deletingDeviceId = ref<string | null>(null)
const savingProduct = ref(false)
const deletingProductId = ref<string | null>(null)
const updatingProductId = ref<string | null>(null)
const updatingUserId = ref<string | null>(null)
const updatingTicketId = ref<string | null>(null)
const sendingTicketMessage = ref(false)
const selectedSupportRequestId = ref<string | null>(null)
const productImageFile = ref<File | null>(null)
const productImagePreview = ref<string | null>(null)
const savingPlantPreset = ref(false)
const deletingPlantPresetId = ref<string | null>(null)
const plantPresetImageFile = ref<File | null>(null)
const plantPresetImagePreview = ref<string | null>(null)

const deviceForm = ref({
  existingDeviceId: null as string | null,
  deviceId: '',
  name: '',
  firmwareVersion: '',
  autoWatering: false,
  autoLighting: false,
  wateringThreshold: 35,
  wateringDuration: 8,
  wateringCooldown: 21600,
  lightingThreshold: 30,
  lightingHysteresis: 8,
})

const productForm = ref({
  productId: null as string | null,
  title: '',
  description: '',
  price: 0,
  category: 'Grow Kit',
  quantityAvailable: 1,
  priceUnit: 'item',
  featured: false,
  status: 'active' as 'active' | 'reserved' | 'sold' | 'archived',
  shopeeUrl: '',
})

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
  lifecycleProfile: { ...defaultLifecycleProfile } as LifecycleProfile,
})

const supportReplyInput = ref('')

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'devices', label: 'Devices' },
  { key: 'support', label: 'Support' },
  { key: 'products', label: 'Official Products' },
  { key: 'plants', label: 'Plant Presets' },
  { key: 'accounts', label: 'Accounts' },
] as const

const supportQueue = computed(() => data.value?.supportRequests ?? [])
const selectedSupportRequest = computed(() => supportQueue.value.find((request) => request._id === selectedSupportRequestId.value) ?? supportQueue.value[0] ?? null)

watch(supportQueue, (requests) => {
  if (!requests.length) {
    selectedSupportRequestId.value = null
    return
  }
  if (!selectedSupportRequestId.value || !requests.some((request) => request._id === selectedSupportRequestId.value)) {
    selectedSupportRequestId.value = requests[0]._id
  }
}, { immediate: true })

function resetDeviceForm() {
  deviceForm.value = {
    existingDeviceId: null,
    deviceId: '',
    name: '',
    firmwareVersion: '',
    autoWatering: false,
    autoLighting: false,
    wateringThreshold: 35,
    wateringDuration: 8,
    wateringCooldown: 21600,
    lightingThreshold: 30,
    lightingHysteresis: 8,
  }
}

function editDevice(device: NonNullable<typeof data.value>['devices'][number]) {
  deviceForm.value = {
    existingDeviceId: device._id,
    deviceId: device.deviceId,
    name: device.name,
    firmwareVersion: device.firmwareVersion,
    autoWatering: device.autoWatering,
    autoLighting: device.autoLighting,
    wateringThreshold: device.wateringThreshold,
    wateringDuration: device.wateringDuration,
    wateringCooldown: device.wateringCooldown,
    lightingThreshold: device.lightingThreshold,
    lightingHysteresis: device.lightingHysteresis,
  }
  activeTab.value = 'devices'
}

function editProduct(product: NonNullable<typeof data.value>['officialProducts'][number]) {
  productForm.value = {
    productId: product._id,
    title: product.title,
    description: product.description,
    price: product.price,
    category: product.category,
    quantityAvailable: product.quantityAvailable,
    priceUnit: product.priceUnit,
    featured: product.featured,
    status: product.status,
    shopeeUrl: product.shopeeUrl ?? '',
  }
  productImageFile.value = null
  productImagePreview.value = product.image
  activeTab.value = 'products'
}

function resetProductForm() {
  productForm.value = {
    productId: null,
    title: '',
    description: '',
    price: 0,
    category: 'Grow Kit',
    quantityAvailable: 1,
    priceUnit: 'item',
    featured: false,
    status: 'active',
    shopeeUrl: '',
  }
  productImageFile.value = null
  productImagePreview.value = null
}

function editPlantPreset(preset: NonNullable<typeof data.value>['plantCatalog'][number]) {
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
    lifecycleProfile: { ...preset.lifecycleProfile },
  }
  plantPresetImageFile.value = null
  plantPresetImagePreview.value = preset.image
  activeTab.value = 'plants'
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
    lifecycleProfile: { ...defaultLifecycleProfile },
  }
  plantPresetImageFile.value = null
  plantPresetImagePreview.value = null
}

function handleProductImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  productImageFile.value = file
  productImagePreview.value = readSelectedImage(file) ?? productImagePreview.value
}

function handlePlantPresetImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  plantPresetImageFile.value = file
  plantPresetImagePreview.value = readSelectedImage(file) ?? plantPresetImagePreview.value
}

async function handleSaveDevice() {
  savingDevice.value = true
  try {
    await saveDevice({
      existingDeviceId: deviceForm.value.existingDeviceId as never,
      deviceId: deviceForm.value.deviceId,
      name: deviceForm.value.name,
      firmwareVersion: deviceForm.value.firmwareVersion || undefined,
      autoWatering: deviceForm.value.autoWatering,
      autoLighting: deviceForm.value.autoLighting,
      wateringThreshold: Number(deviceForm.value.wateringThreshold),
      wateringDuration: Number(deviceForm.value.wateringDuration),
      wateringCooldown: Number(deviceForm.value.wateringCooldown),
      lightingThreshold: Number(deviceForm.value.lightingThreshold),
      lightingHysteresis: Number(deviceForm.value.lightingHysteresis),
    })
    toast.success(deviceForm.value.existingDeviceId ? 'Device updated' : 'Device added')
    resetDeviceForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to save device'))
  } finally {
    savingDevice.value = false
  }
}

async function handleDeleteDevice(deviceId: string) {
  deletingDeviceId.value = deviceId
  try {
    await deleteDevice({ deviceId: deviceId as never })
    toast.success('Device deleted')
    if (deviceForm.value.existingDeviceId === deviceId) {
      resetDeviceForm()
    }
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to delete device'))
  } finally {
    deletingDeviceId.value = null
  }
}

async function handleTicketUpdate(requestId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', priority: 'low' | 'normal' | 'high' | 'urgent') {
  updatingTicketId.value = requestId
  try {
    await updateSupportRequest({
      requestId: requestId as never,
      status,
      priority,
    })
    toast.success('Support ticket updated')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to update ticket'))
  } finally {
    updatingTicketId.value = null
  }
}

async function handleSendTicketMessage() {
  if (!selectedSupportRequest.value || !supportReplyInput.value.trim()) return
  sendingTicketMessage.value = true
  try {
    await sendSupportMessage({
      requestId: selectedSupportRequest.value._id as never,
      body: supportReplyInput.value,
    })
    supportReplyInput.value = ''
    toast.success('Reply sent to user')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to send reply'))
  } finally {
    sendingTicketMessage.value = false
  }
}

async function handleSaveProduct() {
  savingProduct.value = true
  try {
    const imageStorageId = productImageFile.value
      ? await uploadImageFile(productImageFile.value, () => generateImageUploadUrl({}))
      : undefined

    await saveOfficialProduct({
      productId: productForm.value.productId as never,
      title: productForm.value.title,
      description: productForm.value.description,
      price: Number(productForm.value.price),
      category: productForm.value.category,
      quantityAvailable: Number(productForm.value.quantityAvailable),
      priceUnit: productForm.value.priceUnit,
      imageStorageId: imageStorageId as never,
      featured: productForm.value.featured,
      status: productForm.value.status,
      shopeeUrl: productForm.value.shopeeUrl || undefined,
    })
    toast.success(productForm.value.productId ? 'Official product updated' : 'Official product created')
    resetProductForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to save product'))
  } finally {
    savingProduct.value = false
  }
}

async function handleSavePlantPreset() {
  savingPlantPreset.value = true
  try {
    const imageStorageId = plantPresetImageFile.value
      ? await uploadImageFile(plantPresetImageFile.value, () => generateImageUploadUrl({}))
      : undefined

    await savePlantPreset({
      presetId: plantPresetForm.value.presetId as never,
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
      lifecycleProfile: {
        seedDormancyDays: Number(plantPresetForm.value.lifecycleProfile.seedDormancyDays),
        germinationDays: Number(plantPresetForm.value.lifecycleProfile.germinationDays),
        seedlingDevelopmentDays: Number(plantPresetForm.value.lifecycleProfile.seedlingDevelopmentDays),
        vegetativeGrowthDays: Number(plantPresetForm.value.lifecycleProfile.vegetativeGrowthDays),
        floweringReproductionDays: Number(plantPresetForm.value.lifecycleProfile.floweringReproductionDays),
        maturitySenescenceDays: Number(plantPresetForm.value.lifecycleProfile.maturitySenescenceDays),
      },
      imageStorageId: imageStorageId as never,
    })
    toast.success(plantPresetForm.value.presetId ? 'Plant preset updated' : 'Plant preset created')
    resetPlantPresetForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to save plant preset'))
  } finally {
    savingPlantPreset.value = false
  }
}

async function handleDeletePlantPreset(presetId: string) {
  deletingPlantPresetId.value = presetId
  try {
    await deletePlantPreset({ presetId: presetId as never })
    if (plantPresetForm.value.presetId === presetId) {
      resetPlantPresetForm()
    }
    toast.success('Plant preset deleted')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to delete plant preset'))
  } finally {
    deletingPlantPresetId.value = null
  }
}

async function handleUserAccessChange(userId: string, field: 'tier' | 'role', value: string) {
  updatingUserId.value = userId
  try {
    await updateUserAccess({
      userId: userId as never,
      tier: field === 'tier' ? (value as 'basic' | 'advanced') : undefined,
      role: field === 'role' ? (value as 'grower' | 'company' | 'admin') : undefined,
    })
    toast.success('Account updated')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to update account'))
  } finally {
    updatingUserId.value = null
  }
}

async function handleUpdateProductStatus(productId: string, status: 'active' | 'reserved' | 'sold' | 'archived') {
  updatingProductId.value = productId
  try {
    await updateOfficialProductStatus({ productId: productId as never, status })
    toast.success(`Official product marked ${status}`)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to update product status'))
  } finally {
    updatingProductId.value = null
  }
}

async function handleDeleteProduct(productId: string) {
  deletingProductId.value = productId
  try {
    await deleteOfficialProduct({ productId: productId as never })
    if (productForm.value.productId === productId) {
      resetProductForm()
    }
    toast.success('Official product deleted')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to delete product'))
  } finally {
    deletingProductId.value = null
  }
}
</script>

<template>
  <div v-if="data" class="space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Admin Control</p>
      <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Ecosystem operations</h1>
      <p class="mt-2 max-w-3xl text-sm text-gm-muted">Admin accounts manage the platform itself: device inventory and hardware tuning, support workflows, official catalog entries, and account access.</p>

      <div class="mt-6 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Users</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.totalUsers }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Devices</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.totalDevices }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Claimed</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.claimedDevices }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Active Plants</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.activePlants }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Open Tickets</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.openTickets }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Official Products</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.officialProducts }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Community Listings</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.communityListings }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Community Posts</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.communityPosts }}</div></article>
      </div>
    </section>

    <section class="rounded-[1.75rem] bg-[#f3f3f3] p-2 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div class="grid grid-cols-2 gap-2 md:grid-cols-5">
        <button v-for="tab in tabs" :key="tab.key" type="button" class="rounded-[1.25rem] px-3 py-3 text-xs font-bold uppercase tracking-[0.18em]" :class="activeTab === tab.key ? 'bg-white text-gm-primary shadow-[0_10px_20px_rgba(15,23,42,0.06)]' : 'text-gm-muted'" @click="activeTab = tab.key">
          {{ tab.label }}
        </button>
      </div>
    </section>

    <section v-if="activeTab === 'overview'" class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Immediate queue</h2>
        <div class="mt-5 space-y-3">
          <div v-for="request in supportQueue.slice(0, 5)" :key="request._id" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
            <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
            <div class="mt-1 text-xs uppercase tracking-[0.18em] text-gm-muted">{{ request.userName }} • {{ request.priority }} • {{ request.status.replaceAll('_', ' ') }}</div>
          </div>
          <div v-if="!supportQueue.length" class="rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted">No open support tickets.</div>
        </div>
      </article>
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Recent devices</h2>
        <div class="mt-5 space-y-3">
          <div v-for="device in data.devices.slice(0, 5)" :key="device._id" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ device.name }}</div>
                <div class="mt-1 text-xs text-gm-muted">{{ device.deviceId }} • {{ device.ownerName || 'Unclaimed' }}</div>
              </div>
              <button class="rounded-full bg-white px-4 py-2 text-xs font-bold text-gm-text" @click="editDevice(device)">Edit</button>
            </div>
          </div>
        </div>
      </article>
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:col-span-2">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Recent operational events</h2>
        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div v-for="event in data.recentEvents" :key="event._id" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
            <div class="text-sm font-bold text-gm-text">{{ event.title }}</div>
            <div v-if="event.detail" class="mt-1 text-sm text-gm-muted">{{ event.detail }}</div>
            <div class="mt-2 text-[11px] text-gm-muted">{{ event.relativeTime }} • {{ event.timestampLabel }}</div>
          </div>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'devices'" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-headline text-2xl font-bold text-gm-text">Device registry</h2>
          <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="resetDeviceForm">New device</button>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <input v-model="deviceForm.deviceId" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Device ID" />
          <input v-model="deviceForm.name" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Display name" />
          <input v-model="deviceForm.firmwareVersion" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Firmware version" />
          <input v-model="deviceForm.wateringThreshold" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Water threshold" />
          <input v-model="deviceForm.lightingThreshold" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Light threshold" />
          <input v-model="deviceForm.wateringDuration" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Water duration" />
          <input v-model="deviceForm.wateringCooldown" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Water cooldown" />
          <input v-model="deviceForm.lightingHysteresis" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Lighting hysteresis" />
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input v-model="deviceForm.autoWatering" type="checkbox" /> Auto watering</label>
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input v-model="deviceForm.autoLighting" type="checkbox" /> Auto lighting</label>
        </div>
        <button class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="savingDevice" @click="handleSaveDevice">{{ savingDevice ? 'Saving...' : deviceForm.existingDeviceId ? 'Update device' : 'Add device' }}</button>
      </article>
      <article class="space-y-4">
        <article v-for="device in data.devices" :key="device._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-lg font-bold text-gm-text">{{ device.name }}</div>
              <div class="mt-1 text-sm text-gm-muted">{{ device.deviceId }} • {{ device.ownerName || 'Unclaimed' }}</div>
              <div class="mt-2 text-xs text-gm-muted">Pulse {{ device.wateringDuration }}s • Cooldown {{ device.wateringCooldown }}s • Hysteresis {{ device.lightingHysteresis }}</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="editDevice(device)">Edit</button>
              <button class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="deletingDeviceId === device._id || device.isClaimed || !!device.plantName" @click="handleDeleteDevice(device._id)">{{ deletingDeviceId === device._id ? 'Deleting...' : 'Delete' }}</button>
            </div>
          </div>
        </article>
      </article>
    </section>

    <section v-else-if="activeTab === 'support'" class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Ticket queue</h2>
        <div v-if="data.supportRequests.length" class="mt-5 space-y-3">
          <button v-for="request in data.supportRequests" :key="request._id" type="button" class="w-full rounded-[1.5rem] p-4 text-left transition" :class="selectedSupportRequest?._id === request._id ? 'bg-gm-primary/5' : 'bg-[#f7f7f7]'" @click="selectedSupportRequestId = request._id">
            <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
            <div class="mt-1 text-xs uppercase tracking-[0.18em] text-gm-muted">{{ request.userName }} • {{ request.priority }} • {{ request.status.replaceAll('_', ' ') }}</div>
            <div class="mt-2 text-xs text-gm-muted">Updated {{ request.updatedAtLabel }}</div>
          </button>
        </div>
        <div v-else class="mt-5 rounded-[1.5rem] bg-[#f7f7f7] p-4 text-sm text-gm-muted">No support tickets right now.</div>
      </article>

      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div v-if="selectedSupportRequest" class="space-y-4">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-lg font-bold text-gm-text">{{ selectedSupportRequest.topic }}</div>
              <div class="mt-1 text-sm text-gm-muted">{{ selectedSupportRequest.userName }} • {{ selectedSupportRequest.userEmail }}</div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <select class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" :value="selectedSupportRequest.status" @change="handleTicketUpdate(selectedSupportRequest._id, ($event.target as HTMLSelectElement).value as 'open' | 'in_progress' | 'resolved' | 'closed', selectedSupportRequest.priority)">
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <select class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" :value="selectedSupportRequest.priority" @change="handleTicketUpdate(selectedSupportRequest._id, selectedSupportRequest.status, ($event.target as HTMLSelectElement).value as 'low' | 'normal' | 'high' | 'urgent')">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div class="space-y-3 rounded-[1.5rem] bg-[#f7f7f7] p-4">
            <div v-for="message in selectedSupportRequest.messages" :key="message._id" class="flex" :class="message.senderRole === 'admin' ? 'justify-end' : 'justify-start'">
              <div class="max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-6" :class="message.senderRole === 'admin' ? 'bg-gm-primary text-white' : message.senderRole === 'system' ? 'bg-[#fff6da] text-gm-text' : 'bg-white text-gm-text'">
                <div class="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">{{ message.senderName }}</div>
                <div class="whitespace-pre-wrap">{{ message.body }}</div>
                <div class="mt-2 text-[11px] opacity-70">{{ message.createdAtLabel }}</div>
              </div>
            </div>
          </div>

          <textarea v-model="supportReplyInput" rows="4" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Reply to the user..." />
          <div class="flex flex-wrap gap-3">
            <button class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="sendingTicketMessage" @click="handleSendTicketMessage">{{ sendingTicketMessage ? 'Sending...' : 'Send reply' }}</button>
            <button class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text disabled:opacity-50" :disabled="updatingTicketId === selectedSupportRequest._id" @click="handleTicketUpdate(selectedSupportRequest._id, selectedSupportRequest.status, selectedSupportRequest.priority)">{{ updatingTicketId === selectedSupportRequest._id ? 'Saving...' : 'Save status only' }}</button>
          </div>
        </div>

        <div v-else class="rounded-[1.5rem] bg-[#f7f7f7] p-5 text-sm text-gm-muted">Select a ticket to open the conversation.</div>
      </article>
    </section>

    <section v-else-if="activeTab === 'products'" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-headline text-2xl font-bold text-gm-text">Official catalog</h2>
          <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="resetProductForm">New product</button>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <input v-model="productForm.title" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Title" />
          <textarea v-model="productForm.description" rows="4" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Description" />
          <input v-model="productForm.category" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Category" />
          <input v-model="productForm.priceUnit" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Price unit" />
          <input v-model="productForm.price" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Price" />
          <input v-model="productForm.quantityAvailable" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Quantity" />
          <input type="file" accept="image/*" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" @change="handleProductImageChange" />
          <img v-if="productImagePreview" :src="productImagePreview" alt="Product preview" class="h-48 w-full rounded-[1.5rem] object-cover md:col-span-2" />
          <input v-model="productForm.shopeeUrl" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Shopee URL" />
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input v-model="productForm.featured" type="checkbox" /> Featured</label>
          <select v-model="productForm.status" class="rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text outline-none">
            <option value="active">Active</option>
            <option value="reserved">Reserved</option>
            <option value="sold">Sold</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <button class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="savingProduct" @click="handleSaveProduct">{{ savingProduct ? 'Saving...' : productForm.productId ? 'Update product' : 'Create product' }}</button>
      </article>
      <article class="space-y-4">
        <article v-for="product in data.officialProducts" :key="product._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="text-lg font-bold text-gm-text">{{ product.title }}</div>
              <div class="mt-1 text-sm text-gm-muted">{{ product.priceLabel }} • {{ product.statusLabel }}</div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="editProduct(product)">Edit</button>
              <button class="rounded-full bg-[#fff6da] px-4 py-2 text-xs font-bold text-[#7a5a00] disabled:opacity-50" :disabled="updatingProductId === product._id" @click="handleUpdateProductStatus(product._id, product.status === 'archived' ? 'active' : 'archived')">{{ product.status === 'archived' ? 'Activate' : 'Archive' }}</button>
              <button class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="deletingProductId === product._id" @click="handleDeleteProduct(product._id)">{{ deletingProductId === product._id ? 'Deleting...' : 'Delete' }}</button>
            </div>
          </div>
        </article>
      </article>
    </section>

    <section v-else-if="activeTab === 'plants'" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-headline text-2xl font-bold text-gm-text">Plant preset library</h2>
          <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="resetPlantPresetForm">New preset</button>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <input v-model="plantPresetForm.name" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Plant name" />
          <input v-model="plantPresetForm.species" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Species" />
          <input v-model="plantPresetForm.key" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Preset key (optional)" />
          <input v-model="plantPresetForm.location" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Location" />
          <select v-model="plantPresetForm.category" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none">
            <option value="herb">Herb</option>
            <option value="leafy">Leafy</option>
            <option value="fruiting">Fruiting</option>
            <option value="houseplant">Houseplant</option>
            <option value="flower">Flower</option>
            <option value="microgreen">Microgreen</option>
          </select>
          <select v-model="plantPresetForm.difficulty" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none">
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="advanced">Advanced</option>
          </select>
          <select v-model="plantPresetForm.growthStage" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2">
            <option v-for="stage in lifecycleStageOptions" :key="stage.value" :value="stage.value">{{ stage.label }}</option>
          </select>
          <textarea v-model="plantPresetForm.description" rows="4" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" placeholder="Description" />
          <input v-model="plantPresetForm.wateringThreshold" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Water threshold" />
          <input v-model="plantPresetForm.lightingThreshold" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Light threshold" />
          <input type="file" accept="image/*" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none md:col-span-2" @change="handlePlantPresetImageChange" />
          <img v-if="plantPresetImagePreview" :src="plantPresetImagePreview" alt="Plant preset preview" class="h-48 w-full rounded-[1.5rem] object-cover md:col-span-2" />
          <input v-model="plantPresetForm.lifecycleProfile.seedDormancyDays" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Seed dormancy days" />
          <input v-model="plantPresetForm.lifecycleProfile.germinationDays" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Germination days" />
          <input v-model="plantPresetForm.lifecycleProfile.seedlingDevelopmentDays" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Seedling days" />
          <input v-model="plantPresetForm.lifecycleProfile.vegetativeGrowthDays" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Vegetative days" />
          <input v-model="plantPresetForm.lifecycleProfile.floweringReproductionDays" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Flowering days" />
          <input v-model="plantPresetForm.lifecycleProfile.maturitySenescenceDays" type="number" class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Maturity days" />
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <button class="rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="savingPlantPreset" @click="handleSavePlantPreset">{{ savingPlantPreset ? 'Saving...' : plantPresetForm.presetId ? 'Update preset' : 'Create preset' }}</button>
        </div>
      </article>
      <article class="space-y-4">
        <article v-for="preset in data.plantCatalog" :key="preset._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex gap-4">
              <img :src="preset.image" :alt="preset.name" class="h-20 w-20 rounded-[1.25rem] object-cover" />
              <div>
                <div class="text-lg font-bold text-gm-text">{{ preset.name }}</div>
                <div class="mt-1 text-sm text-gm-muted">{{ preset.species }} • {{ preset.category }} • {{ preset.difficulty }}</div>
                <div class="mt-1 text-xs text-gm-muted">{{ preset.key }}</div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="editPlantPreset(preset)">Edit</button>
              <button class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="deletingPlantPresetId === preset._id" @click="handleDeletePlantPreset(preset._id)">{{ deletingPlantPresetId === preset._id ? 'Deleting...' : 'Delete' }}</button>
            </div>
          </div>
        </article>
      </article>
    </section>

    <section v-else class="space-y-4">
      <article v-for="user in data.users" :key="user._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="text-lg font-bold text-gm-text">{{ user.name }}</div>
            <div class="mt-1 text-sm text-gm-muted">{{ user.email }} • @{{ user.handle || 'no-handle' }}</div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <select class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" :value="user.tier" :disabled="updatingUserId === user._id" @change="handleUserAccessChange(user._id, 'tier', ($event.target as HTMLSelectElement).value)">
              <option value="basic">Basic</option>
              <option value="advanced">Advanced</option>
            </select>
            <select class="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" :value="user.role" :disabled="updatingUserId === user._id" @change="handleUserAccessChange(user._id, 'role', ($event.target as HTMLSelectElement).value)">
              <option value="grower">Grower</option>
              <option value="company">Company</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
