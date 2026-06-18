<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { renderMarkdown } from '@/lib/markdown'
import {
  defaultLifecycleProfile,
  defaultPlantSensorProfile,
  lifecycleStageOptions,
  type LifecycleProfile,
  type PlantSensorProfile,
  type PlantLifecycleStage,
} from '@/lib/plants'
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
const { mutate: updateOfficialProductStatus } = useConvexMutation(
  api.growmate.adminUpdateOfficialProductStatus,
)
const { mutate: deleteOfficialProduct } = useConvexMutation(api.growmate.adminDeleteOfficialProduct)
const { mutate: updateUserAccess } = useConvexMutation(api.growmate.adminUpdateUserAccess)
const { mutate: generateImageUploadUrl } = useConvexMutation(api.growmate.generateImageUploadUrl)
const { mutate: savePlantPreset } = useConvexMutation(api.growmate.adminSavePlantPreset)
const { mutate: deletePlantPreset } = useConvexMutation(api.growmate.adminDeletePlantPreset)
const { mutate: saveBlogPost } = useConvexMutation(api.growmate.adminSaveBlogPost)
const { mutate: deleteBlogPost } = useConvexMutation(api.growmate.adminDeleteBlogPost)

const activeTab = ref<'overview' | 'devices' | 'support' | 'products' | 'plants' | 'blog' | 'accounts'>(
  'overview',
)
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
const savingBlogPost = ref(false)
const deletingBlogPostId = ref<string | null>(null)
const blogImageFile = ref<File | null>(null)
const blogImagePreview = ref<string | null>(null)

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
  sensorProfile: { ...defaultPlantSensorProfile } as PlantSensorProfile,
  lifecycleProfile: { ...defaultLifecycleProfile } as LifecycleProfile,
})

const blogPostForm = ref({
  postId: null as string | null,
  title: '',
  excerpt: '',
  body: '',
  published: true,
  featured: false,
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

const supportReplyInput = ref('')
const renderedBlogPreview = computed(() => renderMarkdown(blogPostForm.value.body))

const tabs = [
  { key: 'overview', label: 'Ringkasan' },
  { key: 'devices', label: 'Perangkat' },
  { key: 'support', label: 'Dukungan' },
  { key: 'products', label: 'Produk Resmi' },
  { key: 'plants', label: 'Preset Tanaman' },
  { key: 'blog', label: 'Artikel' },
  { key: 'accounts', label: 'Akun' },
] as const

const supportQueue = computed(() => data.value?.supportRequests ?? [])
const selectedSupportRequest = computed(
  () =>
    supportQueue.value.find((request) => request._id === selectedSupportRequestId.value) ??
    supportQueue.value[0] ??
    null,
)

watch(
  supportQueue,
  (requests) => {
    if (!requests.length) {
      selectedSupportRequestId.value = null
      return
    }
    if (
      !selectedSupportRequestId.value ||
      !requests.some((request) => request._id === selectedSupportRequestId.value)
    ) {
      selectedSupportRequestId.value = requests[0]._id
    }
  },
  { immediate: true },
)

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
    sensorProfile: cloneSensorProfile(preset.sensorProfile),
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
    sensorProfile: cloneSensorProfile(),
    lifecycleProfile: { ...defaultLifecycleProfile },
  }
  plantPresetImageFile.value = null
  plantPresetImagePreview.value = null
}

function editBlogPost(post: NonNullable<typeof data.value>['blogPosts'][number]) {
  blogPostForm.value = {
    postId: post._id,
    title: post.title,
    excerpt: post.excerpt,
    body: post.body,
    published: post.published,
    featured: post.featured,
  }
  blogImageFile.value = null
  blogImagePreview.value = post.image
  activeTab.value = 'blog'
}

function resetBlogPostForm() {
  blogPostForm.value = {
    postId: null,
    title: '',
    excerpt: '',
    body: '',
    published: true,
    featured: false,
  }
  blogImageFile.value = null
  blogImagePreview.value = null
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

function handleBlogImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  blogImageFile.value = file
  blogImagePreview.value = readSelectedImage(file) ?? blogImagePreview.value
}

async function handleSaveDevice() {
  savingDevice.value = true
  try {
    await saveDevice({
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
      ...(deviceForm.value.existingDeviceId
        ? { existingDeviceId: deviceForm.value.existingDeviceId as never }
        : {}),
    })
    toast.success(
      deviceForm.value.existingDeviceId ? 'Perangkat diperbarui' : 'Perangkat ditambahkan',
    )
    resetDeviceForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menyimpan perangkat'))
  } finally {
    savingDevice.value = false
  }
}

async function handleDeleteDevice(deviceId: string) {
  deletingDeviceId.value = deviceId
  try {
    await deleteDevice({ deviceId: deviceId as never })
    toast.success('Perangkat dihapus')
    if (deviceForm.value.existingDeviceId === deviceId) {
      resetDeviceForm()
    }
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus perangkat'))
  } finally {
    deletingDeviceId.value = null
  }
}

async function handleTicketUpdate(
  requestId: string,
  status: 'open' | 'in_progress' | 'resolved' | 'closed',
  priority: 'low' | 'normal' | 'high' | 'urgent',
) {
  updatingTicketId.value = requestId
  try {
    await updateSupportRequest({
      requestId: requestId as never,
      status,
      priority,
    })
    toast.success('Tiket dukungan diperbarui')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memperbarui tiket'))
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
    toast.success('Balasan dikirim ke pengguna')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mengirim balasan'))
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
      title: productForm.value.title,
      description: productForm.value.description,
      price: Number(productForm.value.price),
      category: productForm.value.category,
      quantityAvailable: Number(productForm.value.quantityAvailable),
      priceUnit: productForm.value.priceUnit,
      featured: productForm.value.featured,
      status: productForm.value.status,
      shopeeUrl: productForm.value.shopeeUrl || undefined,
      ...(productForm.value.productId ? { productId: productForm.value.productId as never } : {}),
      ...(imageStorageId ? { imageStorageId: imageStorageId as never } : {}),
    })
    toast.success(productForm.value.productId ? 'Produk resmi diperbarui' : 'Produk resmi dibuat')
    resetProductForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menyimpan produk'))
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
      sensorProfile: {
        soil: {
          min: Number(plantPresetForm.value.sensorProfile.soil.min),
          max: Number(plantPresetForm.value.sensorProfile.soil.max),
        },
        light: {
          min: Number(plantPresetForm.value.sensorProfile.light.min),
          max: Number(plantPresetForm.value.sensorProfile.light.max),
        },
        temperature: {
          min: Number(plantPresetForm.value.sensorProfile.temperature.min),
          max: Number(plantPresetForm.value.sensorProfile.temperature.max),
        },
        air: {
          min: Number(plantPresetForm.value.sensorProfile.air.min),
          max: Number(plantPresetForm.value.sensorProfile.air.max),
        },
        water: {
          min: Number(plantPresetForm.value.sensorProfile.water.min),
          max: Number(plantPresetForm.value.sensorProfile.water.max),
        },
      },
      lifecycleProfile: {
        seedDormancyDays: Number(plantPresetForm.value.lifecycleProfile.seedDormancyDays),
        germinationDays: Number(plantPresetForm.value.lifecycleProfile.germinationDays),
        seedlingDevelopmentDays: Number(
          plantPresetForm.value.lifecycleProfile.seedlingDevelopmentDays,
        ),
        vegetativeGrowthDays: Number(plantPresetForm.value.lifecycleProfile.vegetativeGrowthDays),
        floweringReproductionDays: Number(
          plantPresetForm.value.lifecycleProfile.floweringReproductionDays,
        ),
        maturitySenescenceDays: Number(
          plantPresetForm.value.lifecycleProfile.maturitySenescenceDays,
        ),
      },
      ...(plantPresetForm.value.presetId
        ? { presetId: plantPresetForm.value.presetId as never }
        : {}),
      ...(imageStorageId ? { imageStorageId: imageStorageId as never } : {}),
    })
    toast.success(
      plantPresetForm.value.presetId ? 'Preset tanaman diperbarui' : 'Preset tanaman dibuat',
    )
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
    await deletePlantPreset({ presetId: presetId as never })
    if (plantPresetForm.value.presetId === presetId) {
      resetPlantPresetForm()
    }
    toast.success('Preset tanaman dihapus')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus preset tanaman'))
  } finally {
    deletingPlantPresetId.value = null
  }
}

async function handleSaveBlogPost() {
  savingBlogPost.value = true
  try {
    const imageStorageId = blogImageFile.value
      ? await uploadImageFile(blogImageFile.value, () => generateImageUploadUrl({}))
      : undefined

    await saveBlogPost({
      title: blogPostForm.value.title,
      excerpt: blogPostForm.value.excerpt,
      body: blogPostForm.value.body,
      published: blogPostForm.value.published,
      featured: blogPostForm.value.featured,
      ...(blogPostForm.value.postId ? { postId: blogPostForm.value.postId as never } : {}),
      ...(imageStorageId ? { imageStorageId: imageStorageId as never } : {}),
    })

    toast.success(blogPostForm.value.postId ? 'Artikel blog diperbarui' : 'Artikel blog dibuat')
    resetBlogPostForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menyimpan artikel blog'))
  } finally {
    savingBlogPost.value = false
  }
}

async function handleDeleteBlogPost(postId: string) {
  deletingBlogPostId.value = postId
  try {
    await deleteBlogPost({ postId: postId as never })
    if (blogPostForm.value.postId === postId) {
      resetBlogPostForm()
    }
    toast.success('Artikel blog dihapus')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus artikel blog'))
  } finally {
    deletingBlogPostId.value = null
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
    toast.success('Akun diperbarui')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memperbarui akun'))
  } finally {
    updatingUserId.value = null
  }
}

async function handleUpdateProductStatus(
  productId: string,
  status: 'active' | 'reserved' | 'sold' | 'archived',
) {
  updatingProductId.value = productId
  try {
    await updateOfficialProductStatus({ productId: productId as never, status })
    toast.success(`Status produk resmi diperbarui menjadi ${status}`)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memperbarui status produk'))
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
    toast.success('Produk resmi dihapus')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus produk'))
  } finally {
    deletingProductId.value = null
  }
}
</script>

<template>
  <div v-if="data" class="space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Kontrol Admin</p>
      <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">
        Operasi ekosistem
      </h1>
      <p class="mt-2 max-w-3xl text-sm text-gm-muted">
        Halaman ini membantu admin mengawasi operasional GrowMate, mulai dari kesiapan
        perangkat, alur dukungan pengguna, katalog produk resmi, artikel edukasi, hingga
        pengelolaan akses akun.
      </p>

      <div class="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-9">
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Pengguna</div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.totalUsers }}</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Perangkat</div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.totalDevices }}</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Diklaim</div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.claimedDevices }}</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Tanaman Aktif
          </div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.activePlants }}</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Tiket Terbuka
          </div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.openTickets }}</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Produk Resmi
          </div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.officialProducts }}</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Listing Komunitas
          </div>
          <div class="mt-2 text-3xl font-black text-gm-text">
            {{ data.stats.communityListings }}
          </div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Postingan Komunitas
          </div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.communityPosts }}</div>
        </article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">
            Artikel Edukasi
          </div>
          <div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.blogPosts }}</div>
        </article>
      </div>
    </section>

    <section class="rounded-[1.75rem] bg-[#f3f3f3] p-2 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="rounded-[1.25rem] px-3 py-3 text-xs font-bold uppercase tracking-[0.18em]"
          :class="
            activeTab === tab.key
              ? 'bg-white text-gm-primary shadow-[0_10px_20px_rgba(15,23,42,0.06)]'
              : 'text-gm-muted'
          "
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>
    </section>

    <section v-if="activeTab === 'overview'" class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Antrian prioritas</h2>
        <div class="mt-5 space-y-3">
          <div
            v-for="request in supportQueue.slice(0, 5)"
            :key="request._id"
            class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
          >
            <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
            <div class="mt-1 text-xs uppercase tracking-[0.18em] text-gm-muted">
              {{ request.userName }} • {{ request.priority }} •
              {{ request.status.replaceAll('_', ' ') }}
            </div>
          </div>
          <div
            v-if="!supportQueue.length"
            class="rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted"
          >
            Tidak ada tiket dukungan terbuka.
          </div>
        </div>
      </article>
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Perangkat terbaru</h2>
        <div class="mt-5 space-y-3">
          <div
            v-for="device in data.devices.slice(0, 5)"
            :key="device._id"
            class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
          >
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ device.name }}</div>
                <div class="mt-1 text-xs text-gm-muted">
                  {{ device.deviceId }} • {{ device.ownerName || 'Belum diklaim' }}
                </div>
              </div>
              <button
                class="rounded-full bg-white px-4 py-2 text-xs font-bold text-gm-text"
                @click="editDevice(device)"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      </article>
      <article
        class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:col-span-2"
      >
        <h2 class="font-headline text-2xl font-bold text-gm-text">Aktivitas operasional terbaru</h2>
        <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="event in data.recentEvents"
            :key="event._id"
            class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
          >
            <div class="text-sm font-bold text-gm-text">{{ event.title }}</div>
            <div v-if="event.detail" class="mt-1 text-sm text-gm-muted">{{ event.detail }}</div>
            <div class="mt-2 text-[11px] text-gm-muted">
              {{ event.relativeTime }} • {{ event.timestampLabel }}
            </div>
          </div>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'devices'" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-headline text-2xl font-bold text-gm-text">Registri perangkat</h2>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">ID perangkat</span>
            <input
              v-model="deviceForm.deviceId"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="ID perangkat"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Nama tampilan</span>
            <input
              v-model="deviceForm.name"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Nama tampilan"
            />
          </label>
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Versi firmware</span>
            <input
              v-model="deviceForm.firmwareVersion"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Versi firmware"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Ambang penyiraman device</span>
            <input
              v-model="deviceForm.wateringThreshold"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Ambang air"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Ambang cahaya device</span>
            <input
              v-model="deviceForm.lightingThreshold"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Ambang cahaya"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Durasi penyiraman</span>
            <input
              v-model="deviceForm.wateringDuration"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Durasi penyiraman"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Jeda penyiraman</span>
            <input
              v-model="deviceForm.wateringCooldown"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Jeda penyiraman"
            />
          </label>
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Histeresis pencahayaan</span>
            <input
              v-model="deviceForm.lightingHysteresis"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Histeresis pencahayaan"
            />
          </label>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <label
            class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"
            ><input v-model="deviceForm.autoWatering" type="checkbox" /> Penyiraman otomatis</label
          >
          <label
            class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"
            ><input v-model="deviceForm.autoLighting" type="checkbox" /> Pencahayaan otomatis</label
          >
        </div>
        <button
          class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          :disabled="savingDevice"
          @click="handleSaveDevice"
        >
          {{
            savingDevice
              ? 'Menyimpan...'
              : deviceForm.existingDeviceId
                ? 'Perbarui perangkat'
                : 'Tambah perangkat'
          }}
        </button>
      </article>
      <article class="space-y-4">
        <article
          v-for="device in data.devices"
          :key="device._id"
          class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
        >
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-lg font-bold text-gm-text">{{ device.name }}</div>
              <div class="mt-1 text-sm text-gm-muted">
                {{ device.deviceId }} • {{ device.ownerName || 'Belum diklaim' }}
              </div>
              <div class="mt-2 text-xs text-gm-muted">
                Pulsa {{ device.wateringDuration }}d • Jeda {{ device.wateringCooldown }}d •
                Hysteresis {{ device.lightingHysteresis }}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text"
                @click="editDevice(device)"
              >
                Edit
              </button>
              <button
                class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50"
                :disabled="
                  deletingDeviceId === device._id || device.isClaimed || !!device.plantName
                "
                @click="handleDeleteDevice(device._id)"
              >
                {{ deletingDeviceId === device._id ? 'Menghapus...' : 'Hapus' }}
              </button>
            </div>
          </div>
        </article>
      </article>
    </section>

    <section v-else-if="activeTab === 'support'" class="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Antrian tiket</h2>
        <div v-if="data.supportRequests.length" class="mt-5 space-y-3">
          <button
            v-for="request in data.supportRequests"
            :key="request._id"
            type="button"
            class="w-full rounded-[1.5rem] p-4 text-left transition"
            :class="
              selectedSupportRequest?._id === request._id ? 'bg-gm-primary/5' : 'bg-[#f7f7f7]'
            "
            @click="selectedSupportRequestId = request._id"
          >
            <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
            <div class="mt-1 text-xs uppercase tracking-[0.18em] text-gm-muted">
              {{ request.userName }} • {{ request.priority }} •
              {{ request.status.replaceAll('_', ' ') }}
            </div>
            <div class="mt-2 text-xs text-gm-muted">Diperbarui {{ request.updatedAtLabel }}</div>
          </button>
        </div>
        <div v-else class="mt-5 rounded-[1.5rem] bg-[#f7f7f7] p-4 text-sm text-gm-muted">
          Tidak ada tiket dukungan saat ini.
        </div>
      </article>

      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div v-if="selectedSupportRequest" class="space-y-4">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div class="text-lg font-bold text-gm-text">{{ selectedSupportRequest.topic }}</div>
              <div class="mt-1 text-sm text-gm-muted">
                {{ selectedSupportRequest.userName }} • {{ selectedSupportRequest.userEmail }}
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <label class="space-y-2">
                <span class="block text-sm font-semibold text-gm-text">Status tiket</span>
                <select
                  class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                  :value="selectedSupportRequest.status"
                  @change="
                    handleTicketUpdate(
                      selectedSupportRequest._id,
                      ($event.target as HTMLSelectElement).value as
                        | 'open'
                        | 'in_progress'
                        | 'resolved'
                        | 'closed',
                      selectedSupportRequest.priority,
                    )
                  "
                >
                  <option value="open">Terbuka</option>
                  <option value="in_progress">Diproses</option>
                  <option value="resolved">Selesai</option>
                  <option value="closed">Ditutup</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="block text-sm font-semibold text-gm-text">Prioritas tiket</span>
                <select
                  class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                  :value="selectedSupportRequest.priority"
                  @change="
                    handleTicketUpdate(
                      selectedSupportRequest._id,
                      selectedSupportRequest.status,
                      ($event.target as HTMLSelectElement).value as
                        | 'low'
                        | 'normal'
                        | 'high'
                        | 'urgent',
                    )
                  "
                >
                  <option value="low">Rendah</option>
                  <option value="normal">Normal</option>
                  <option value="high">Tinggi</option>
                  <option value="urgent">Mendesak</option>
                </select>
              </label>
            </div>
          </div>

          <div class="space-y-3 rounded-[1.5rem] bg-[#f7f7f7] p-4">
            <div
              v-for="message in selectedSupportRequest.messages"
              :key="message._id"
              class="flex"
              :class="message.senderRole === 'admin' ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-6"
                :class="
                  message.senderRole === 'admin'
                    ? 'bg-gm-primary text-white'
                    : message.senderRole === 'system'
                      ? 'bg-[#fff6da] text-gm-text'
                      : 'bg-white text-gm-text'
                "
              >
                <div class="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">
                  {{ message.senderName }}
                </div>
                <div class="whitespace-pre-wrap">{{ message.body }}</div>
                <div class="mt-2 text-[11px] opacity-70">{{ message.createdAtLabel }}</div>
              </div>
            </div>
          </div>

          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Balasan admin</span>
            <textarea
              v-model="supportReplyInput"
              rows="4"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Balas ke pengguna..."
            />
          </label>
          <div class="flex flex-wrap gap-3">
            <button
              class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              :disabled="sendingTicketMessage"
              @click="handleSendTicketMessage"
            >
              {{ sendingTicketMessage ? 'Mengirim...' : 'Kirim balasan' }}
            </button>
            <button
              class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-bold text-gm-text disabled:opacity-50"
              :disabled="updatingTicketId === selectedSupportRequest._id"
              @click="
                handleTicketUpdate(
                  selectedSupportRequest._id,
                  selectedSupportRequest.status,
                  selectedSupportRequest.priority,
                )
              "
            >
              {{
                updatingTicketId === selectedSupportRequest._id
                  ? 'Menyimpan...'
                  : 'Simpan status saja'
              }}
            </button>
          </div>
        </div>

        <div v-else class="rounded-[1.5rem] bg-[#f7f7f7] p-5 text-sm text-gm-muted">
          Pilih tiket untuk membuka percakapan.
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'products'" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-headline text-2xl font-bold text-gm-text">Katalog resmi</h2>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Judul produk</span>
            <input
              v-model="productForm.title"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Judul"
            />
          </label>
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Deskripsi produk</span>
            <textarea
              v-model="productForm.description"
              rows="4"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Deskripsi"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Kategori</span>
            <input
              v-model="productForm.category"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Kategori"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Satuan harga</span>
            <input
              v-model="productForm.priceUnit"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Satuan harga"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Harga</span>
            <input
              v-model="productForm.price"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Harga"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Jumlah tersedia</span>
            <input
              v-model="productForm.quantityAvailable"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Jumlah"
            />
          </label>
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Gambar produk</span>
            <input
              type="file"
              accept="image/*"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              @change="handleProductImageChange"
            />
          </label>
          <img
            v-if="productImagePreview"
            :src="productImagePreview"
            alt="Pratinjau produk"
            class="h-48 w-full rounded-[1.5rem] object-cover md:col-span-2"
          />
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">URL Shopee</span>
            <input
              v-model="productForm.shopeeUrl"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="URL Shopee"
            />
          </label>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <label
            class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"
            ><input v-model="productForm.featured" type="checkbox" /> Produk unggulan</label
          >
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Status produk</span>
            <select
              v-model="productForm.status"
              class="rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text outline-none"
            >
              <option value="active">Aktif</option>
              <option value="reserved">Dipesan</option>
              <option value="sold">Terjual</option>
              <option value="archived">Diarsipkan</option>
            </select>
          </label>
        </div>
        <button
          class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          :disabled="savingProduct"
          @click="handleSaveProduct"
        >
          {{
            savingProduct
              ? 'Menyimpan...'
              : productForm.productId
                ? 'Perbarui produk'
                : 'Buat produk'
          }}
        </button>
      </article>
      <article class="space-y-4">
        <article
          v-for="product in data.officialProducts"
          :key="product._id"
          class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div class="text-lg font-bold text-gm-text">{{ product.title }}</div>
              <div class="mt-1 text-sm text-gm-muted">
                {{ product.priceLabel }} • {{ product.statusLabel }}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text"
                @click="editProduct(product)"
              >
                Edit
              </button>
              <button
                class="rounded-full bg-[#fff6da] px-4 py-2 text-xs font-bold text-[#7a5a00] disabled:opacity-50"
                :disabled="updatingProductId === product._id"
                @click="
                  handleUpdateProductStatus(
                    product._id,
                    product.status === 'archived' ? 'active' : 'archived',
                  )
                "
              >
                {{ product.status === 'archived' ? 'Aktifkan' : 'Arsipkan' }}
              </button>
              <button
                class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50"
                :disabled="deletingProductId === product._id"
                @click="handleDeleteProduct(product._id)"
              >
                {{ deletingProductId === product._id ? 'Menghapus...' : 'Hapus' }}
              </button>
            </div>
          </div>
        </article>
      </article>
    </section>

    <section v-else-if="activeTab === 'plants'" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-headline text-2xl font-bold text-gm-text">Pustaka preset tanaman</h2>
        </div>
        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Nama tanaman</span>
            <input
              v-model="plantPresetForm.name"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Nama tanaman"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Spesies</span>
            <input
              v-model="plantPresetForm.species"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Spesies"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Kunci preset</span>
            <input
              v-model="plantPresetForm.key"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Kunci preset (opsional)"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Lokasi default</span>
            <input
              v-model="plantPresetForm.location"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Lokasi"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Kategori</span>
            <select
              v-model="plantPresetForm.category"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
            >
              <option value="herb">Herba</option>
              <option value="leafy">Daun</option>
              <option value="fruiting">Berbuah</option>
              <option value="houseplant">Tanaman hias</option>
              <option value="flower">Bunga</option>
              <option value="microgreen">Microgreen</option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Tingkat kesulitan</span>
            <select
              v-model="plantPresetForm.difficulty"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
            >
              <option value="easy">Mudah</option>
              <option value="medium">Menengah</option>
              <option value="advanced">Lanjutan</option>
            </select>
          </label>
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Tahap siklus hidup default</span>
            <select
              v-model="plantPresetForm.growthStage"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
            >
              <option
                v-for="stage in lifecycleStageOptions"
                :key="stage.value"
                :value="stage.value"
              >
                {{ stage.label }}
              </option>
            </select>
          </label>
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Deskripsi preset</span>
            <textarea
              v-model="plantPresetForm.description"
              rows="4"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Deskripsi"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Ambang penyiraman</span>
            <input
              v-model="plantPresetForm.wateringThreshold"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Ambang penyiraman"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Ambang pencahayaan</span>
            <input
              v-model="plantPresetForm.lightingThreshold"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Ambang pencahayaan"
            />
          </label>
          <label class="space-y-2 md:col-span-2">
            <span class="block text-sm font-semibold text-gm-text">Gambar preset tanaman</span>
            <input
              type="file"
              accept="image/*"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              @change="handlePlantPresetImageChange"
            />
          </label>
          <img
            v-if="plantPresetImagePreview"
            :src="plantPresetImagePreview"
            alt="Pratinjau preset tanaman"
            class="h-48 w-full rounded-[1.5rem] object-cover md:col-span-2"
          />
          <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4 md:col-span-2">
            <div class="mb-3 text-sm font-bold text-gm-text">Rentang sensor ideal</div>
            <div class="grid gap-3 md:grid-cols-2">
              <div class="rounded-xl bg-white p-3">
                <div class="mb-2 text-sm font-semibold text-gm-text">Kelembapan tanah (%)</div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="plantPresetForm.sensorProfile.soil.min"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Min"
                  />
                  <input
                    v-model="plantPresetForm.sensorProfile.soil.max"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Maks"
                  />
                </div>
              </div>
              <div class="rounded-xl bg-white p-3">
                <div class="mb-2 text-sm font-semibold text-gm-text">Cahaya (%)</div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="plantPresetForm.sensorProfile.light.min"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Min"
                  />
                  <input
                    v-model="plantPresetForm.sensorProfile.light.max"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Maks"
                  />
                </div>
              </div>
              <div class="rounded-xl bg-white p-3">
                <div class="mb-2 text-sm font-semibold text-gm-text">Suhu (C)</div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="plantPresetForm.sensorProfile.temperature.min"
                    type="number"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Min"
                  />
                  <input
                    v-model="plantPresetForm.sensorProfile.temperature.max"
                    type="number"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Maks"
                  />
                </div>
              </div>
              <div class="rounded-xl bg-white p-3">
                <div class="mb-2 text-sm font-semibold text-gm-text">Kelembapan udara (%)</div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="plantPresetForm.sensorProfile.air.min"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Min"
                  />
                  <input
                    v-model="plantPresetForm.sensorProfile.air.max"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Maks"
                  />
                </div>
              </div>
              <div class="rounded-xl bg-white p-3 md:col-span-2">
                <div class="mb-2 text-sm font-semibold text-gm-text">Level air reservoir (%)</div>
                <div class="grid grid-cols-2 gap-2">
                  <input
                    v-model="plantPresetForm.sensorProfile.water.min"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Min"
                  />
                  <input
                    v-model="plantPresetForm.sensorProfile.water.max"
                    type="number"
                    min="0"
                    max="100"
                    class="rounded-xl border border-[#e3e3e3] px-3 py-2 text-sm outline-none"
                    placeholder="Maks"
                  />
                </div>
              </div>
            </div>
          </div>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Hari dormansi benih</span>
            <input
              v-model="plantPresetForm.lifecycleProfile.seedDormancyDays"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Hari dormansi benih"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Hari perkecambahan</span>
            <input
              v-model="plantPresetForm.lifecycleProfile.germinationDays"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Hari perkecambahan"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Hari perkembangan bibit</span>
            <input
              v-model="plantPresetForm.lifecycleProfile.seedlingDevelopmentDays"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Hari perkembangan bibit"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Hari pertumbuhan vegetatif</span>
            <input
              v-model="plantPresetForm.lifecycleProfile.vegetativeGrowthDays"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Hari pertumbuhan vegetatif"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text"
              >Hari pembungaan / reproduksi</span
            >
            <input
              v-model="plantPresetForm.lifecycleProfile.floweringReproductionDays"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Hari pembungaan"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Hari kematangan / senesens</span>
            <input
              v-model="plantPresetForm.lifecycleProfile.maturitySenescenceDays"
              type="number"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Hari kematangan"
            />
          </label>
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <button
            class="rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
            :disabled="savingPlantPreset"
            @click="handleSavePlantPreset"
          >
            {{
              savingPlantPreset
                ? 'Menyimpan...'
                : plantPresetForm.presetId
                  ? 'Perbarui preset'
                  : 'Buat preset'
            }}
          </button>
        </div>
      </article>
      <article class="space-y-4">
        <article
          v-for="preset in data.plantCatalog"
          :key="preset._id"
          class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex gap-4">
              <img
                :src="preset.image"
                :alt="preset.name"
                class="h-20 w-20 rounded-[1.25rem] object-cover"
              />
              <div>
                <div class="text-lg font-bold text-gm-text">{{ preset.name }}</div>
                <div class="mt-1 text-sm text-gm-muted">
                  {{ preset.species }} • {{ preset.category }} • {{ preset.difficulty }}
                </div>
                <div class="mt-1 text-xs text-gm-muted">{{ preset.key }}</div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text"
                @click="editPlantPreset(preset)"
              >
                Edit
              </button>
              <button
                class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50"
                :disabled="deletingPlantPresetId === preset._id"
                @click="handleDeletePlantPreset(preset._id)"
              >
                {{ deletingPlantPresetId === preset._id ? 'Menghapus...' : 'Hapus' }}
              </button>
            </div>
          </div>
        </article>
      </article>
    </section>

    <section v-else-if="activeTab === 'blog'" class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-headline text-2xl font-bold text-gm-text">Blog publik</h2>
        </div>
        <div class="mt-5 grid gap-3">
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Judul artikel</span>
            <input
              v-model="blogPostForm.title"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Judul artikel"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Ringkasan singkat</span>
            <textarea
              v-model="blogPostForm.excerpt"
              rows="3"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Ringkasan untuk kartu blog dan halaman indeks"
            />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Isi artikel</span>
            <textarea
              v-model="blogPostForm.body"
              rows="14"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="# Judul bagian\n\nTulis artikel dengan Markdown di sini...\n\n- daftar poin\n- daftar poin lain\n\n**teks tebal** dan [tautan](https://example.com)"
            />
            <p class="text-xs leading-relaxed text-gm-muted">
              Mendukung Markdown seperti heading, list, bold, italic, quote, link, dan code block.
            </p>
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-semibold text-gm-text">Cover artikel</span>
            <input
              type="file"
              accept="image/*"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              @change="handleBlogImageChange"
            />
          </label>
          <img
            v-if="blogImagePreview"
            :src="blogImagePreview"
            alt="Pratinjau blog"
            class="h-48 w-full rounded-[1.5rem] object-cover"
          />
        </div>
        <div class="mt-5 flex flex-wrap gap-3">
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text">
            <input v-model="blogPostForm.featured" type="checkbox" /> Artikel unggulan
          </label>
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text">
            <input v-model="blogPostForm.published" type="checkbox" /> Publikasikan artikel
          </label>
        </div>
        <button
          class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
          :disabled="savingBlogPost"
          @click="handleSaveBlogPost"
        >
          {{
            savingBlogPost
              ? 'Menyimpan...'
              : blogPostForm.postId
                ? 'Perbarui artikel'
                : 'Buat artikel'
          }}
        </button>

        <div class="mt-8">
          <div class="mb-3 text-sm font-semibold text-gm-text">Pratinjau Markdown</div>
          <div class="gm-article rounded-[2rem] bg-[#f8faf7] p-6 text-gm-muted" v-html="renderedBlogPreview" />
        </div>
      </article>
      <article class="space-y-4">
        <article
          v-for="post in data.blogPosts"
          :key="post._id"
          class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
        >
          <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div class="flex gap-4">
              <img :src="post.image" :alt="post.title" class="h-20 w-20 rounded-[1.25rem] object-cover" />
              <div>
                <div class="text-lg font-bold text-gm-text">{{ post.title }}</div>
                <div class="mt-1 text-sm text-gm-muted">
                  {{ post.relativeTime }} • {{ post.published ? 'Published' : 'Draft' }}
                </div>
                <div class="mt-1 text-xs text-gm-muted">{{ post.authorName }}</div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text"
                @click="editBlogPost(post)"
              >
                Edit
              </button>
              <button
                class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50"
                :disabled="deletingBlogPostId === post._id"
                @click="handleDeleteBlogPost(post._id)"
              >
                {{ deletingBlogPostId === post._id ? 'Menghapus...' : 'Hapus' }}
              </button>
            </div>
          </div>
        </article>
      </article>
    </section>

    <section v-else class="space-y-4">
      <article
        v-for="user in data.users"
        :key="user._id"
        class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
      >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="text-lg font-bold text-gm-text">{{ user.name }}</div>
            <div class="mt-1 text-sm text-gm-muted">
              {{ user.email }} • @{{ user.handle || 'no-handle' }}
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-2">
              <span class="block text-sm font-semibold text-gm-text">Tier akun</span>
              <select
                class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                :value="user.tier"
                :disabled="updatingUserId === user._id"
                @change="
                  handleUserAccessChange(
                    user._id,
                    'tier',
                    ($event.target as HTMLSelectElement).value,
                  )
                "
              >
                <option value="basic">Dasar</option>
                <option value="advanced">Lanjutan</option>
              </select>
            </label>
            <label class="space-y-2">
              <span class="block text-sm font-semibold text-gm-text">Peran akun</span>
              <select
                class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
                :value="user.role"
                :disabled="updatingUserId === user._id"
                @change="
                  handleUserAccessChange(
                    user._id,
                    'role',
                    ($event.target as HTMLSelectElement).value,
                  )
                "
              >
                <option value="grower">Grower</option>
                <option value="company">Company</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>
