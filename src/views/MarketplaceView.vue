<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { getSetupRoute } from '@/lib/setup'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'

const router = useRouter()

const searchQuery = ref('')
const selectedCategory = ref<'all' | 'official' | 'community'>('all')
const selectedThreadId = ref<string | null>(null)
const showInquiryModal = ref(false)
const inquiryListing = ref<null | { _id: string; sellerName: string; title: string; contactThreadId: string | null }>(null)
const inquiryMessage = ref('')
const replyMessage = ref('')

const draftForm = ref({
  draftId: null as string | null,
  title: '',
  description: '',
  category: 'Fresh Produce',
  quantity: 1,
  quantityUnit: 'bundle',
  price: 5,
  priceUnit: 'each',
  locationLabel: 'Local pickup',
  contactPreference: 'chat' as 'chat' | 'pickup' | 'delivery',
})

const { data } = useConvexQuery(api.growmate.marketplace, {})
const { data: setupStatus } = useConvexQuery(api.growmate.checkSetupStatus, {})

const { mutate: saveMarketplaceDraft } = useConvexMutation(api.growmate.saveMarketplaceDraft)
const { mutate: publishMarketplaceDraft } = useConvexMutation(api.growmate.publishMarketplaceDraft)
const { mutate: updateMarketplaceListingStatus } = useConvexMutation(api.growmate.updateMarketplaceListingStatus)
const { mutate: updateMarketplaceListing } = useConvexMutation(api.growmate.updateMarketplaceListing)
const { mutate: deleteMarketplaceDraft } = useConvexMutation(api.growmate.deleteMarketplaceDraft)
const { mutate: deleteMarketplaceListing } = useConvexMutation(api.growmate.deleteMarketplaceListing)
const { mutate: sendMarketplaceMessage } = useConvexMutation(api.growmate.sendMarketplaceMessage)
const { mutate: replyMarketplaceThread } = useConvexMutation(api.growmate.replyMarketplaceThread)
const { mutate: markMarketplaceThreadRead } = useConvexMutation(api.growmate.markMarketplaceThreadRead)
const { mutate: generateImageUploadUrl } = useConvexMutation(api.growmate.generateImageUploadUrl)

const savingDraft = ref(false)
const publishingDraftId = ref<string | null>(null)
const updatingListingId = ref<string | null>(null)
const deletingDraftId = ref<string | null>(null)
const deletingListingId = ref<string | null>(null)
const sendingInquiry = ref(false)
const sendingReply = ref(false)
const editingListingId = ref<string | null>(null)
const draftImageFile = ref<File | null>(null)
const draftImagePreview = ref<string | null>(null)

watch(setupStatus, async (status) => {
  if (!status) return
  if (!status.authenticated || !status.setupComplete || status.isAdmin) {
    await router.replace(getSetupRoute(status))
  }
}, { immediate: true })

watch(() => data.value?.threads, async (threads) => {
  if (!threads?.length) {
    selectedThreadId.value = null
    return
  }
  if (!selectedThreadId.value || !threads.some((thread) => thread._id === selectedThreadId.value)) {
    selectedThreadId.value = threads[0]._id
  }
}, { immediate: true })

watch(selectedThreadId, async (threadId) => {
  if (!threadId) return
  try {
    await markMarketplaceThreadRead({ threadId: threadId as never })
  } catch {
    // no-op; query refresh will still work if read marking fails
  }
})

const featured = computed(() => data.value?.featured ?? null)

const filteredOfficial = computed(() => {
  const official = data.value?.official ?? []
  const query = searchQuery.value.trim().toLowerCase()
  return official.filter((item) => {
    if (selectedCategory.value === 'community') return false
    if (!query) return true
    return `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query)
  })
})

const filteredCommunity = computed(() => {
  const community = data.value?.community ?? []
  const query = searchQuery.value.trim().toLowerCase()
  return community.filter((item) => {
    if (selectedCategory.value === 'official') return false
    if (!query) return true
    return `${item.title} ${item.description} ${item.category} ${item.sellerName}`.toLowerCase().includes(query)
  })
})

const selectedThread = computed(() => data.value?.threads.find((thread) => thread._id === selectedThreadId.value) ?? null)
type MarketplaceData = NonNullable<typeof data.value>
type MarketplaceDraft = MarketplaceData['listingDrafts'][number]
type MarketplaceListing = MarketplaceData['community'][number]

function openExternal(url: string) {
  window.open(url, '_blank')
}

function resetDraftForm() {
  editingListingId.value = null
  draftForm.value = {
    draftId: null,
    title: '',
    description: '',
    category: 'Fresh Produce',
    quantity: 1,
    quantityUnit: 'bundle',
    price: 5,
    priceUnit: 'each',
    locationLabel: 'Local pickup',
    contactPreference: 'chat',
  }
  draftImageFile.value = null
  draftImagePreview.value = null
}

function editDraft(draft: MarketplaceDraft) {
  editingListingId.value = null
  draftForm.value = {
    draftId: draft._id,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    quantity: draft.quantity,
    quantityUnit: draft.quantityUnit,
    price: draft.price,
    priceUnit: draft.priceUnit,
    locationLabel: draft.locationLabel,
    contactPreference: draft.contactPreference,
  }
  draftImageFile.value = null
  draftImagePreview.value = draft.image
}

function editListing(listing: MarketplaceListing) {
  editingListingId.value = listing._id
  draftForm.value = {
    draftId: null,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    quantity: listing.quantityAvailable,
    quantityUnit: listing.quantityUnit ?? 'item',
    price: listing.price,
    priceUnit: listing.priceUnit,
    locationLabel: listing.locationLabel ?? '',
    contactPreference: listing.contactPreference ?? 'chat',
  }
  draftImageFile.value = null
  draftImagePreview.value = listing.image
}

function handleDraftImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  draftImageFile.value = file
  draftImagePreview.value = readSelectedImage(file) ?? draftImagePreview.value
}

function openInquiry(listing: MarketplaceListing) {
  inquiryListing.value = listing
  inquiryMessage.value = `Hi ${listing.sellerName}, I'm interested in ${listing.title}. Is it still available?`
  showInquiryModal.value = true
}

async function handleSaveDraft() {
  savingDraft.value = true
  try {
    const imageStorageId = draftImageFile.value
      ? await uploadImageFile(draftImageFile.value, () => generateImageUploadUrl({}))
      : undefined

    if (editingListingId.value) {
      await updateMarketplaceListing({
        productId: editingListingId.value as never,
        title: draftForm.value.title,
        description: draftForm.value.description,
        category: draftForm.value.category,
        quantity: draftForm.value.quantity,
        quantityUnit: draftForm.value.quantityUnit,
        price: draftForm.value.price,
        priceUnit: draftForm.value.priceUnit,
        imageStorageId: imageStorageId as never,
        locationLabel: draftForm.value.locationLabel,
        contactPreference: draftForm.value.contactPreference,
      })
      toast.success('Listing updated')
    } else {
      await saveMarketplaceDraft({
        ...draftForm.value,
        draftId: draftForm.value.draftId ? (draftForm.value.draftId as never) : undefined,
        imageStorageId: imageStorageId as never,
      })
      toast.success(draftForm.value.draftId ? 'Draft updated' : 'Draft saved')
    }
    resetDraftForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to save draft'))
  } finally {
    savingDraft.value = false
  }
}

async function handlePublishDraft(draftId: string) {
  publishingDraftId.value = draftId
  try {
    await publishMarketplaceDraft({ draftId: draftId as never })
    toast.success('Listing published to the community marketplace')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to publish listing'))
  } finally {
    publishingDraftId.value = null
  }
}

async function handleUpdateListingStatus(productId: string, status: 'active' | 'reserved' | 'sold' | 'archived') {
  updatingListingId.value = productId
  try {
    await updateMarketplaceListingStatus({ productId: productId as never, status })
    toast.success(`Listing marked ${status}`)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to update listing'))
  } finally {
    updatingListingId.value = null
  }
}

async function handleDeleteDraft(draftId: string) {
  deletingDraftId.value = draftId
  try {
    await deleteMarketplaceDraft({ draftId: draftId as never })
    if (draftForm.value.draftId === draftId) {
      resetDraftForm()
    }
    toast.success('Draft removed')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to remove draft'))
  } finally {
    deletingDraftId.value = null
  }
}

async function handleDeleteListing(productId: string) {
  deletingListingId.value = productId
  try {
    await deleteMarketplaceListing({ productId: productId as never })
    if (editingListingId.value === productId) {
      resetDraftForm()
    }
    toast.success('Listing removed')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to remove listing'))
  } finally {
    deletingListingId.value = null
  }
}

async function handleSendInquiry() {
  if (!inquiryListing.value) return
  sendingInquiry.value = true
  try {
    await sendMarketplaceMessage({ productId: inquiryListing.value._id, threadId: inquiryListing.value.contactThreadId ?? undefined, body: inquiryMessage.value })
    toast.success(`Inquiry sent to ${inquiryListing.value.sellerName}`)
    showInquiryModal.value = false
    inquiryListing.value = null
    inquiryMessage.value = ''
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to send inquiry'))
  } finally {
    sendingInquiry.value = false
  }
}

async function handleReplyThread() {
  if (!selectedThread.value || !replyMessage.value.trim()) return
  sendingReply.value = true
  try {
    await replyMarketplaceThread({ threadId: selectedThread.value._id as never, body: replyMessage.value })
    replyMessage.value = ''
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to send reply'))
  } finally {
    sendingReply.value = false
  }
}

</script>

<template>
  <div v-if="data" class="space-y-6">
    <section class="relative overflow-hidden rounded-[2rem] bg-[#f3f3f3] p-5 sm:p-8 md:p-10">
      <div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div class="space-y-6">
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Marketplace</p>
          <h1 class="font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl md:text-5xl">GrowMate gear and Community harvests.</h1>
          <p class="max-w-2xl text-sm leading-relaxed text-gm-muted">
            Official GrowMate products. Community listings work like a local grower marketplace, buyers message sellers directly, sellers manage inquiries, and payment or pickup happens off-platform.
          </p>
        </div>

        <div v-if="featured" class="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <img :src="featured.image" :alt="featured.title" class="h-72 w-full object-cover" />
          <div class="space-y-3 p-6">
            <div class="flex items-center justify-between gap-4">
              <span class="rounded-full bg-[#ee4d2d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">Shopee</span>
              <span class="text-sm font-bold text-gm-primary">{{ featured.priceLabel }}</span>
            </div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">{{ featured.title }}</h2>
            <p class="text-sm text-gm-muted">{{ featured.description }}</p>
            <button @click="openExternal(featured.shopeeUrl)" class="w-full rounded-full bg-[#ee4d2d] px-5 py-3 text-sm font-bold text-white">Open on Shopee</button>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <button class="rounded-full px-5 py-2 text-sm font-semibold" :class="selectedCategory === 'all' ? 'bg-gm-primary text-white' : 'bg-[#e8e8e8] text-gm-muted'" @click="selectedCategory = 'all'">All</button>
        <button class="rounded-full px-5 py-2 text-sm font-semibold" :class="selectedCategory === 'official' ? 'bg-gm-primary text-white' : 'bg-[#e8e8e8] text-gm-muted'" @click="selectedCategory = 'official'">Official</button>
        <button class="rounded-full px-5 py-2 text-sm font-semibold" :class="selectedCategory === 'community' ? 'bg-gm-primary text-white' : 'bg-[#e8e8e8] text-gm-muted'" @click="selectedCategory = 'community'">Community</button>
      </div>
      <input v-model="searchQuery" class="w-full rounded-full bg-[#e8e8e8] px-5 py-3 text-sm outline-none lg:max-w-sm" placeholder="Search listings, sellers, or categories..." />
    </section>

    <section v-if="filteredOfficial.length" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-headline text-2xl font-bold text-gm-text">Official GrowMate</h2>
          <p class="text-sm text-gm-muted">These products are sold on Shopee, not inside GrowMate.</p>
        </div>
      </div>
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article v-for="item in filteredOfficial" :key="item._id" class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <img :src="item.image" :alt="item.title" class="h-52 w-full object-cover" />
          <div class="space-y-3 p-6">
            <div class="flex items-center justify-between gap-4">
              <span class="rounded-full bg-[#fff0ec] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ee4d2d]">Shopee</span>
              <span class="font-bold text-gm-primary">{{ item.priceLabel }}</span>
            </div>
            <h3 class="font-headline text-xl font-bold text-gm-text">{{ item.title }}</h3>
            <p class="text-sm text-gm-muted">{{ item.description }}</p>
            <button @click="openExternal(item.shopeeUrl)" class="w-full rounded-full bg-[#ee4d2d] px-5 py-3 text-sm font-bold text-white">View on Shopee</button>
          </div>
        </article>
      </div>
    </section>

    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-headline text-2xl font-bold text-gm-text">Community Marketplace</h2>
          <p class="text-sm text-gm-muted">Buyers message sellers directly. Pickup, delivery, and payment happen off-platform.</p>
        </div>
      </div>

      <div v-if="filteredCommunity.length" class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in filteredCommunity" :key="item._id" class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <img :src="item.image" :alt="item.title" class="h-48 w-full object-cover" />
          <div class="space-y-3 p-5">
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-headline text-lg font-bold text-gm-text">{{ item.title }}</h3>
              <span class="text-sm font-bold text-gm-primary">{{ item.priceLabel }}</span>
            </div>
            <p class="text-sm text-gm-muted">{{ item.description }}</p>
            <div class="flex flex-wrap gap-2 text-[11px] text-gm-muted">
              <span class="rounded-full bg-[#f3f3f3] px-3 py-1">{{ item.statusLabel }}</span>
              <span class="rounded-full bg-[#f3f3f3] px-3 py-1">{{ item.quantityAvailable }} available</span>
              <span v-if="item.locationLabel" class="rounded-full bg-[#f3f3f3] px-3 py-1">{{ item.locationLabel }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gm-muted">
              <span class="material-symbols-outlined text-sm">person</span>
              {{ item.sellerName }}
            </div>
            <button @click="openInquiry(item)" class="w-full rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" :disabled="item.status !== 'active'">
              {{ item.contactThreadId ? 'Open Conversation' : 'Message Seller' }}
            </button>
          </div>
        </article>
      </div>

      <div v-else class="rounded-[2rem] bg-[#f3f3f3] p-8 text-center text-sm text-gm-muted">
        No community listings match this search right now.
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <article class="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">Seller Studio</h2>
            <p class="text-sm text-gm-muted">Draft, publish, and manage your local marketplace listings.</p>
          </div>
        </div>

        <div class="mt-6 grid gap-3 md:grid-cols-2">
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Listing title</span>
            <input v-model="draftForm.title" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Listing title" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Category</span>
            <input v-model="draftForm.category" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Category" />
          </label>
          <label class="md:col-span-2">
            <span class="mb-2 block text-sm font-semibold text-gm-text">Description</span>
            <textarea v-model="draftForm.description" rows="4" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Describe freshness, growing method, pickup notes..." />
          </label>
          <label class="md:col-span-2">
            <span class="mb-2 block text-sm font-semibold text-gm-text">Listing image</span>
            <input type="file" accept="image/*" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="handleDraftImageChange" />
          </label>
          <img v-if="draftImagePreview" :src="draftImagePreview" alt="Listing preview" class="md:col-span-2 h-48 w-full rounded-[1.5rem] object-cover" />
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Location</span>
            <input v-model="draftForm.locationLabel" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Location" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Contact preference</span>
            <select v-model="draftForm.contactPreference" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none">
              <option value="chat">Chat first</option>
              <option value="pickup">Pickup preferred</option>
              <option value="delivery">Delivery preferred</option>
            </select>
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Quantity</span>
            <input v-model="draftForm.quantity" type="number" min="1" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Quantity" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Quantity unit</span>
            <input v-model="draftForm.quantityUnit" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Unit" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Price</span>
            <input v-model="draftForm.price" type="number" min="0" step="0.01" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Price" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Price unit</span>
            <input v-model="draftForm.priceUnit" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Price unit" />
          </label>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <button @click="handleSaveDraft" class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" :disabled="savingDraft">{{ savingDraft ? 'Saving...' : editingListingId ? 'Update Listing' : draftForm.draftId ? 'Update Draft' : 'Save Draft' }}</button>
          <button @click="resetDraftForm" class="rounded-full bg-[#e8e8e8] px-5 py-3 text-sm font-bold text-gm-text">Clear</button>
        </div>

        <div v-if="data.listingDrafts.length || data.myListings.length" class="mt-8 space-y-4">
          <h3 class="font-headline text-lg font-bold text-gm-text">Your listings</h3>
          <div v-for="draft in data.listingDrafts" :key="draft._id" class="rounded-[1.5rem] bg-[#f7f7f7] p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ draft.title }}</div>
                <div class="mt-1 text-xs text-gm-muted">Draft • {{ draft.quantityLabel }} • {{ draft.priceLabel }} • {{ draft.locationLabel }}</div>
              </div>
              <div class="flex flex-wrap gap-3">
                <button @click="editDraft(draft)" class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text">Edit</button>
                <button @click="handlePublishDraft(draft._id)" class="rounded-full bg-[#fff0ec] px-4 py-2 text-xs font-bold text-[#ee4d2d]" :disabled="publishingDraftId === draft._id || draft.status === 'published'">
                  {{ publishingDraftId === draft._id ? 'Publishing...' : draft.status === 'published' ? 'Published' : 'Publish' }}
                </button>
                <button @click="handleDeleteDraft(draft._id)" class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548]" :disabled="deletingDraftId === draft._id">{{ deletingDraftId === draft._id ? 'Removing...' : 'Remove' }}</button>
              </div>
            </div>
          </div>

          <div v-for="listing in data.myListings" :key="listing._id" class="rounded-[1.5rem] bg-[#f7f7f7] p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ listing.title }}</div>
                <div class="mt-1 text-xs text-gm-muted">Live • {{ listing.quantityLabel }} • {{ listing.priceLabel }} • {{ listing.statusLabel }}</div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button @click="editListing(listing)" class="rounded-full bg-white px-3 py-2 text-xs font-bold text-gm-text">Edit</button>
                <button @click="handleUpdateListingStatus(listing._id, 'sold')" class="rounded-full bg-[#e8ffe8] px-3 py-2 text-xs font-bold text-[#005313]" :disabled="updatingListingId === listing._id">Sold</button>
                <button @click="handleUpdateListingStatus(listing._id, 'active')" class="rounded-full bg-[#cae6ff] px-3 py-2 text-xs font-bold text-[#006493]" :disabled="updatingListingId === listing._id">Relist</button>
                <button @click="handleDeleteListing(listing._id)" class="rounded-full bg-[#ffdbcf] px-3 py-2 text-xs font-bold text-[#795548]" :disabled="deletingListingId === listing._id">{{ deletingListingId === listing._id ? 'Removing...' : 'Remove' }}</button>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">Marketplace Inbox</h2>
            <p class="text-sm text-gm-muted">Keep every deal anchored to a listing conversation.</p>
          </div>
        </div>

        <div class="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div class="space-y-3">
            <button
              v-for="thread in data.threads"
              :key="thread._id"
              type="button"
              class="w-full rounded-[1.25rem] p-4 text-left"
              :class="selectedThreadId === thread._id ? 'bg-gm-primary/5' : 'bg-[#fafafa]'"
              @click="selectedThreadId = thread._id"
            >
              <div class="flex items-start justify-between gap-3">
                <div>
                  <div class="text-sm font-bold text-gm-text">{{ thread.productTitle }}</div>
                  <div class="mt-1 text-xs text-gm-muted">{{ thread.participantName }} • {{ thread.role }}</div>
                </div>
                <div class="text-[11px] text-gm-muted">{{ thread.role === 'seller' ? thread.sellerUnreadCount : thread.buyerUnreadCount }}</div>
              </div>
              <div class="mt-2 text-xs text-gm-muted">{{ thread.lastMessagePreview }}</div>
            </button>

            <div v-if="!data.threads.length" class="rounded-[1.25rem] bg-[#f3f3f3] p-6 text-sm text-gm-muted">
              No marketplace conversations yet.
            </div>
          </div>

          <div v-if="selectedThread" class="flex min-h-[420px] flex-col rounded-[1.5rem] bg-[#f7f7f7] p-4">
            <div class="border-b border-[#e5e5e5] px-2 pb-4">
              <div class="text-sm font-bold text-gm-text">{{ selectedThread.productTitle }}</div>
              <div class="mt-1 text-xs text-gm-muted">Talking with {{ selectedThread.participantName }}</div>
            </div>
            <div class="flex-1 space-y-3 overflow-y-auto px-1 py-4">
              <div v-for="message in selectedThread.messages" :key="message._id" class="flex" :class="message.mine ? 'justify-end' : 'justify-start'">
                <div class="max-w-[85%] rounded-[1.25rem] px-4 py-3 text-sm" :class="message.mine ? 'bg-gm-primary text-white' : 'bg-white text-gm-text'">
                  <div>{{ message.body }}</div>
                  <div class="mt-2 text-[11px]" :class="message.mine ? 'text-white/70' : 'text-gm-muted'">{{ message.createdAtLabel }}</div>
                </div>
              </div>
            </div>
            <div class="flex gap-3 border-t border-[#e5e5e5] pt-4">
              <input v-model="replyMessage" @keyup.enter="!sendingReply && handleReplyThread()" class="flex-1 rounded-full bg-white px-5 py-3 text-sm outline-none" placeholder="Reply in this listing conversation..." />
              <button @click="handleReplyThread" class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" :disabled="sendingReply">{{ sendingReply ? 'Sending...' : 'Send' }}</button>
            </div>
          </div>

          <div v-else class="rounded-[1.5rem] bg-[#f3f3f3] p-8 text-sm text-gm-muted">
            Select a conversation to manage a listing inquiry.
          </div>
        </div>
      </article>
    </section>

  </div>

  <div v-if="showInquiryModal && inquiryListing" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" @click="showInquiryModal = false">
    <div class="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-2xl" @click.stop>
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="font-headline text-2xl font-bold text-gm-text">Message {{ inquiryListing.sellerName }}</h3>
          <p class="mt-1 text-sm text-gm-muted">This conversation will stay attached to {{ inquiryListing.title }}.</p>
        </div>
        <button class="rounded-full p-2 hover:bg-[#f3f3f3]" @click="showInquiryModal = false">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <textarea v-model="inquiryMessage" rows="7" class="mt-6 w-full rounded-[1.5rem] bg-[#f7f7f7] px-5 py-4 text-sm outline-none" placeholder="Ask availability, pickup time, condition, quantity, or delivery..." />
      <div class="mt-6 flex gap-3">
        <button @click="handleSendInquiry" class="flex-1 rounded-full bg-gm-primary px-6 py-4 text-sm font-bold text-white" :disabled="sendingInquiry">{{ sendingInquiry ? 'Sending...' : 'Send Inquiry' }}</button>
        <button @click="showInquiryModal = false" class="rounded-full bg-[#e8e8e8] px-6 py-4 text-sm font-bold text-gm-text">Cancel</button>
      </div>
    </div>
  </div>
</template>
