import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { renderMarkdown } from '@/lib/markdown'
import {
  defaultLifecycleProfile,
  defaultPlantSensorProfile,
  type LifecycleProfile,
  type PlantSensorProfile,
  type PlantLifecycleStage,
} from '@/lib/plants'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'
import type { Id } from '@/lib/convex-types'

export function useAdmin() {
  onBeforeUnmount(() => {
    [productImageBlobUrl, plantPresetImageBlobUrl, blogImageBlobUrl].forEach((ref) => {
      if (ref.value) URL.revokeObjectURL(ref.value)
    })
  })

  const { data } = useConvexQuery(api.admin.adminConsole, {})

  const { mutate: saveDevice } = useConvexMutation(api.admin.adminSaveDevice)
  const { mutate: deleteDevice } = useConvexMutation(api.admin.adminDeleteDevice)
  const { mutate: updateSupportRequest } = useConvexMutation(api.support.adminUpdateSupportRequest)
  const { mutate: sendSupportMessage } = useConvexMutation(api.support.sendSupportMessage)
  const { mutate: saveOfficialProduct } = useConvexMutation(api.admin.adminSaveOfficialProduct)
  const { mutate: updateOfficialProductStatus } = useConvexMutation(api.admin.adminUpdateOfficialProductStatus)
  const { mutate: deleteOfficialProduct } = useConvexMutation(api.admin.adminDeleteOfficialProduct)
  const { mutate: updateUserAccess } = useConvexMutation(api.admin.adminUpdateUserAccess)
  const { mutate: generateImageUploadUrl } = useConvexMutation(api.images.generateImageUploadUrl)
  const { mutate: savePlantPreset } = useConvexMutation(api.admin.adminSavePlantPreset)
  const { mutate: deletePlantPreset } = useConvexMutation(api.admin.adminDeletePlantPreset)
  const { mutate: saveBlogPost } = useConvexMutation(api.blog.adminSaveBlogPost)
  const { mutate: deleteBlogPost } = useConvexMutation(api.blog.adminDeleteBlogPost)

  const activeTab = ref<'overview' | 'devices' | 'support' | 'products' | 'plants' | 'blog' | 'accounts'>('overview')
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
  const productImageBlobUrl = ref<string | null>(null)
  const plantPresetImageBlobUrl = ref<string | null>(null)
  const blogImageBlobUrl = ref<string | null>(null)
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
  const selectedSupportRequest = computed(() =>
    supportQueue.value.find((r: { _id: string }) => r._id === selectedSupportRequestId.value) ?? supportQueue.value[0] ?? null,
  )

  watch(supportQueue, (requests: { _id: string }[]) => {
    if (!requests.length) {
      selectedSupportRequestId.value = null
      return
    }
    if (!selectedSupportRequestId.value || !requests.some((r: { _id: string }) => r._id === selectedSupportRequestId.value)) {
      selectedSupportRequestId.value = requests[0]?._id ?? null
    }
  }, { immediate: true })

  function cloneSensorProfile(profile?: Partial<PlantSensorProfile> | null): PlantSensorProfile {
    return {
      soil: { ...defaultPlantSensorProfile.soil, ...profile?.soil },
      light: { ...defaultPlantSensorProfile.light, ...profile?.light },
      temperature: { ...defaultPlantSensorProfile.temperature, ...profile?.temperature },
      air: { ...defaultPlantSensorProfile.air, ...profile?.air },
      water: { ...defaultPlantSensorProfile.water, ...profile?.water },
    }
  }

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
    if (productImageBlobUrl.value) URL.revokeObjectURL(productImageBlobUrl.value)
    productImageBlobUrl.value = readSelectedImage(file)
    productImagePreview.value = productImageBlobUrl.value ?? productImagePreview.value
  }

  function handlePlantPresetImageChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    plantPresetImageFile.value = file
    if (plantPresetImageBlobUrl.value) URL.revokeObjectURL(plantPresetImageBlobUrl.value)
    plantPresetImageBlobUrl.value = readSelectedImage(file)
    plantPresetImagePreview.value = plantPresetImageBlobUrl.value ?? plantPresetImagePreview.value
  }

  function handleBlogImageChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    blogImageFile.value = file
    if (blogImageBlobUrl.value) URL.revokeObjectURL(blogImageBlobUrl.value)
    blogImageBlobUrl.value = readSelectedImage(file)
    blogImagePreview.value = blogImageBlobUrl.value ?? blogImagePreview.value
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
        ...(deviceForm.value.existingDeviceId ? { existingDeviceId: deviceForm.value.existingDeviceId as Id<'devices'> } : {}),
      })
      toast.success(deviceForm.value.existingDeviceId ? 'Perangkat diperbarui' : 'Perangkat ditambahkan')
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
      await deleteDevice({ deviceId: deviceId as Id<'devices'> })
      toast.success('Perangkat dihapus')
      if (deviceForm.value.existingDeviceId === deviceId) resetDeviceForm()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menghapus perangkat'))
    } finally {
      deletingDeviceId.value = null
    }
  }

  async function handleTicketUpdate(requestId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', priority: 'low' | 'normal' | 'high' | 'urgent') {
    updatingTicketId.value = requestId
    try {
      await updateSupportRequest({ requestId: requestId as Id<'supportRequests'>, status, priority })
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
      await sendSupportMessage({ requestId: selectedSupportRequest.value._id as Id<'supportRequests'>, body: supportReplyInput.value })
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
      const imageStorageId = productImageFile.value ? await uploadImageFile(productImageFile.value, () => generateImageUploadUrl({})) : undefined
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
        ...(productForm.value.productId ? { productId: productForm.value.productId as Id<'products'> } : {}),
        ...(imageStorageId ? { imageStorageId: imageStorageId as Id<'_storage'> } : {}),
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
      const imageStorageId = plantPresetImageFile.value ? await uploadImageFile(plantPresetImageFile.value, () => generateImageUploadUrl({})) : undefined
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
        ...(imageStorageId ? { imageStorageId: imageStorageId as Id<'_storage'> } : {}),
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

  async function handleSaveBlogPost() {
    savingBlogPost.value = true
    try {
      const imageStorageId = blogImageFile.value ? await uploadImageFile(blogImageFile.value, () => generateImageUploadUrl({})) : undefined
      await saveBlogPost({
        title: blogPostForm.value.title,
        excerpt: blogPostForm.value.excerpt,
        body: blogPostForm.value.body,
        published: blogPostForm.value.published,
        featured: blogPostForm.value.featured,
        ...(blogPostForm.value.postId ? { postId: blogPostForm.value.postId as Id<'blogPosts'> } : {}),
        ...(imageStorageId ? { imageStorageId: imageStorageId as Id<'_storage'> } : {}),
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
      await deleteBlogPost({ postId: postId as Id<'blogPosts'> })
      if (blogPostForm.value.postId === postId) resetBlogPostForm()
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
        userId: userId as Id<'users'>,
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

  async function handleUpdateProductStatus(productId: string, status: 'active' | 'reserved' | 'sold' | 'archived') {
    updatingProductId.value = productId
    try {
      await updateOfficialProductStatus({ productId: productId as Id<'products'>, status })
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
      await deleteOfficialProduct({ productId: productId as Id<'products'> })
      if (productForm.value.productId === productId) resetProductForm()
      toast.success('Produk resmi dihapus')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menghapus produk'))
    } finally {
      deletingProductId.value = null
    }
  }

  return {
    data,
    activeTab,
    tabs,
    deviceForm,
    productForm,
    plantPresetForm,
    blogPostForm,
    supportReplyInput,
    savingDevice, deletingDeviceId,
    savingProduct, deletingProductId, updatingProductId,
    updatingUserId, updatingTicketId, sendingTicketMessage,
    selectedSupportRequestId, selectedSupportRequest,
    productImageFile, productImagePreview,
    savingPlantPreset, deletingPlantPresetId,
    plantPresetImageFile, plantPresetImagePreview,
    savingBlogPost, deletingBlogPostId,
    blogImageFile, blogImagePreview,
    productImageBlobUrl, plantPresetImageBlobUrl, blogImageBlobUrl,
    renderedBlogPreview,
    supportQueue,
    cloneSensorProfile,
    resetDeviceForm, editDevice,
    resetProductForm, editProduct,
    resetPlantPresetForm, editPlantPreset,
    resetBlogPostForm, editBlogPost,
    handleProductImageChange, handlePlantPresetImageChange, handleBlogImageChange,
    handleSaveDevice, handleDeleteDevice,
    handleTicketUpdate, handleSendTicketMessage,
    handleSaveProduct, handleSavePlantPreset, handleDeletePlantPreset,
    handleSaveBlogPost, handleDeleteBlogPost,
    handleUserAccessChange,
    handleUpdateProductStatus, handleDeleteProduct,
  }
}
