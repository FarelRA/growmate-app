<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

const searchQuery = ref('')
const selectedCategory = ref<'all' | 'official' | 'community'>('all')
const selectedThreadId = ref<string | null>(null)
const showInquiryModal = ref(false)
const inquiryListing = ref<null | {
  _id: string
  sellerName: string
  title: string
  contactThreadId: string | null
}>(null)
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

const { mutate: saveMarketplaceDraft } = useConvexMutation(api.growmate.saveMarketplaceDraft)
const { mutate: publishMarketplaceDraft } = useConvexMutation(api.growmate.publishMarketplaceDraft)
const { mutate: updateMarketplaceListingStatus } = useConvexMutation(
  api.growmate.updateMarketplaceListingStatus,
)
const { mutate: updateMarketplaceListing } = useConvexMutation(
  api.growmate.updateMarketplaceListing,
)
const { mutate: deleteMarketplaceDraft } = useConvexMutation(api.growmate.deleteMarketplaceDraft)
const { mutate: deleteMarketplaceListing } = useConvexMutation(
  api.growmate.deleteMarketplaceListing,
)
const { mutate: sendMarketplaceMessage } = useConvexMutation(api.growmate.sendMarketplaceMessage)
const { mutate: replyMarketplaceThread } = useConvexMutation(api.growmate.replyMarketplaceThread)
const { mutate: markMarketplaceThreadRead } = useConvexMutation(
  api.growmate.markMarketplaceThreadRead,
)
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
const failedMarketplaceImages = ref<string[]>([])

watch(
  () => data.value?.threads,
  async (threads) => {
    if (!threads?.length) {
      selectedThreadId.value = null
      return
    }
    if (
      !selectedThreadId.value ||
      !threads.some((thread) => thread._id === selectedThreadId.value)
    ) {
      selectedThreadId.value = threads[0]._id
    }
  },
  { immediate: true },
)

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
    return `${item.title} ${item.description} ${item.category} ${item.sellerName}`
      .toLowerCase()
      .includes(query)
  })
})

const selectedThread = computed(
  () => data.value?.threads.find((thread) => thread._id === selectedThreadId.value) ?? null,
)
type MarketplaceData = NonNullable<typeof data.value>
type MarketplaceDraft = MarketplaceData['listingDrafts'][number]
type MarketplaceListing = MarketplaceData['community'][number]

function openExternal(url: string) {
  window.open(url, '_blank')
}

function hasWorkingImage(id: string, image?: string | null) {
  return Boolean(image) && !failedMarketplaceImages.value.includes(id)
}

function handleImageError(id: string) {
  if (!failedMarketplaceImages.value.includes(id)) {
    failedMarketplaceImages.value = [...failedMarketplaceImages.value, id]
  }
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
  inquiryMessage.value = `Halo ${listing.sellerName}, saya tertarik dengan ${listing.title}. Apakah masih tersedia?`
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
      toast.success('Listing diperbarui')
    } else {
      await saveMarketplaceDraft({
        ...draftForm.value,
        draftId: draftForm.value.draftId ? (draftForm.value.draftId as never) : undefined,
        imageStorageId: imageStorageId as never,
      })
      toast.success(draftForm.value.draftId ? 'Draft diperbarui' : 'Draft disimpan')
    }
    resetDraftForm()
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menyimpan draft'))
  } finally {
    savingDraft.value = false
  }
}

async function handlePublishDraft(draftId: string) {
  publishingDraftId.value = draftId
  try {
    await publishMarketplaceDraft({ draftId: draftId as never })
    toast.success('Listing dipublikasikan ke marketplace komunitas')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mempublikasikan listing'))
  } finally {
    publishingDraftId.value = null
  }
}

async function handleUpdateListingStatus(
  productId: string,
  status: 'active' | 'reserved' | 'sold' | 'archived',
) {
  updatingListingId.value = productId
  try {
    await updateMarketplaceListingStatus({ productId: productId as never, status })
    toast.success(`Listing marked ${status}`)
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal memperbarui listing'))
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
    toast.success('Draft dihapus')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus draft'))
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
    toast.success('Listing dihapus')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal menghapus listing'))
  } finally {
    deletingListingId.value = null
  }
}

async function handleSendInquiry() {
  if (!inquiryListing.value) return
  sendingInquiry.value = true
  try {
    await sendMarketplaceMessage({
      productId: inquiryListing.value._id,
      threadId: inquiryListing.value.contactThreadId ?? undefined,
      body: inquiryMessage.value,
    })
    toast.success(`Pertanyaan dikirim ke ${inquiryListing.value.sellerName}`)
    showInquiryModal.value = false
    inquiryListing.value = null
    inquiryMessage.value = ''
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mengirim pertanyaan'))
  } finally {
    sendingInquiry.value = false
  }
}

async function handleReplyThread() {
  if (!selectedThread.value || !replyMessage.value.trim()) return
  sendingReply.value = true
  try {
    await replyMarketplaceThread({
      threadId: selectedThread.value._id as never,
      body: replyMessage.value,
    })
    replyMessage.value = ''
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Gagal mengirim balasan'))
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
          <h1
            class="font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl md:text-5xl"
          >
            Produk resmi GrowMate dan hasil budidaya komunitas.
          </h1>
          <p class="max-w-2xl text-sm leading-relaxed text-gm-muted">
            Halaman ini membantu pengguna melihat produk resmi GrowMate sekaligus mengelola jual
            beli hasil budidaya komunitas melalui percakapan langsung antara pembeli dan penjual.
          </p>
        </div>

        <div
          v-if="featured"
          class="overflow-hidden rounded-[2rem] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        >
          <img
            v-if="hasWorkingImage(featured._id, featured.image)"
            :src="featured.image"
            :alt="featured.title"
            class="h-72 w-full object-cover"
            @error="handleImageError(featured._id)"
          />
          <div
            v-else
            class="flex h-72 w-full items-center justify-center bg-[#eef5ea] text-gm-primary"
          >
            <span class="material-symbols-outlined gm-visual-icon">devices</span>
          </div>
          <div class="space-y-3 p-6">
            <div class="flex items-center justify-between gap-4">
              <span
                class="rounded-full bg-[#ee4d2d] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white"
                >Shopee</span
              >
              <span class="text-sm font-bold text-gm-primary">{{ featured.priceLabel }}</span>
            </div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">{{ featured.title }}</h2>
            <p class="text-sm text-gm-muted">{{ featured.description }}</p>
            <button
              @click="openExternal(featured.shopeeUrl)"
              class="w-full rounded-full bg-[#ee4d2d] px-5 py-3 text-sm font-bold text-white"
            >
              Beli via Shopee
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <button
          class="rounded-full px-5 py-2 text-sm font-semibold"
          :class="
            selectedCategory === 'all' ? 'bg-gm-primary text-white' : 'bg-[#e8e8e8] text-gm-muted'
          "
          @click="selectedCategory = 'all'"
        >
          Semua
        </button>
        <button
          class="rounded-full px-5 py-2 text-sm font-semibold"
          :class="
            selectedCategory === 'official'
              ? 'bg-gm-primary text-white'
              : 'bg-[#e8e8e8] text-gm-muted'
          "
          @click="selectedCategory = 'official'"
        >
          Resmi
        </button>
        <button
          class="rounded-full px-5 py-2 text-sm font-semibold"
          :class="
            selectedCategory === 'community'
              ? 'bg-gm-primary text-white'
              : 'bg-[#e8e8e8] text-gm-muted'
          "
          @click="selectedCategory = 'community'"
        >
          Komunitas
        </button>
      </div>
      <input
        v-model="searchQuery"
        class="w-full rounded-full bg-[#e8e8e8] px-5 py-3 text-sm outline-none lg:max-w-sm"
        placeholder="Cari listing, penjual, atau kategori..."
      />
    </section>

    <section v-if="filteredOfficial.length" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-headline text-2xl font-bold text-gm-text">Produk Resmi GrowMate</h2>
          <p class="text-sm text-gm-muted">Produk ini dijual di Shopee, bukan di dalam GrowMate.</p>
        </div>
      </div>
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <article
          v-for="item in filteredOfficial"
          :key="item._id"
          class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
        >
          <img
            v-if="hasWorkingImage(item._id, item.image)"
            :src="item.image"
            :alt="item.title"
            class="h-52 w-full object-cover"
            @error="handleImageError(item._id)"
          />
          <div
            v-else
            class="flex h-52 w-full items-center justify-center bg-[#eef5ea] text-gm-primary"
          >
            <span class="material-symbols-outlined gm-visual-icon">devices</span>
          </div>
          <div class="space-y-3 p-6">
            <div class="flex items-center justify-between gap-4">
              <span
                class="rounded-full bg-[#fff0ec] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ee4d2d]"
                >Shopee</span
              >
              <span class="font-bold text-gm-primary">{{ item.priceLabel }}</span>
            </div>
            <h3 class="font-headline text-xl font-bold text-gm-text">{{ item.title }}</h3>
            <p class="text-sm text-gm-muted">{{ item.description }}</p>
            <button
              @click="openExternal(item.shopeeUrl)"
              class="w-full rounded-full bg-[#ee4d2d] px-5 py-3 text-sm font-bold text-white"
            >
              Beli via Shopee
            </button>
          </div>
        </article>
      </div>
    </section>

    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="font-headline text-2xl font-bold text-gm-text">Penawaran Komunitas</h2>
          <p class="text-sm text-gm-muted">
            Pembeli menghubungi penjual langsung. Pengambilan, pengiriman, dan pembayaran dilakukan
            di luar platform.
          </p>
        </div>
      </div>

      <div v-if="filteredCommunity.length" class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="item in filteredCommunity"
          :key="item._id"
          class="overflow-hidden rounded-[2rem] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]"
        >
          <img
            v-if="hasWorkingImage(item._id, item.image)"
            :src="item.image"
            :alt="item.title"
            class="h-48 w-full object-cover"
            @error="handleImageError(item._id)"
          />
          <div
            v-else
            class="flex h-48 w-full items-center justify-center bg-[#eef5ea] text-gm-primary"
          >
            <span class="material-symbols-outlined gm-visual-icon">inventory_2</span>
          </div>
          <div class="space-y-3 p-5">
            <div class="flex items-center justify-between gap-3">
              <h3 class="font-headline text-lg font-bold text-gm-text">{{ item.title }}</h3>
              <span class="text-sm font-bold text-gm-primary">{{ item.priceLabel }}</span>
            </div>
            <p class="text-sm text-gm-muted">{{ item.description }}</p>
            <div class="flex flex-wrap gap-2 text-[11px] text-gm-muted">
              <span class="rounded-full bg-[#f3f3f3] px-3 py-1">{{ item.statusLabel }}</span>
              <span class="rounded-full bg-[#f3f3f3] px-3 py-1"
                >{{ item.quantityAvailable }} tersedia</span
              >
              <span v-if="item.locationLabel" class="rounded-full bg-[#f3f3f3] px-3 py-1">{{
                item.locationLabel
              }}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gm-muted">
              <span class="material-symbols-outlined text-sm">person</span>
              {{ item.sellerName }}
            </div>
            <button
              @click="openInquiry(item)"
              class="w-full rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white"
              :disabled="item.status !== 'active'"
            >
              {{ item.contactThreadId ? 'Buka Percakapan' : 'Hubungi Penjual' }}
            </button>
          </div>
        </article>
      </div>

      <div v-else class="rounded-[2rem] bg-[#f3f3f3] p-8 text-center text-sm text-gm-muted">
        Tidak ada listing komunitas yang cocok dengan pencarian ini saat ini.
      </div>
    </section>

    <section class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <article class="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">Ruang Kelola Penjualan</h2>
            <p class="text-sm text-gm-muted">
              Susun draft, publikasikan penawaran, dan kelola informasi penjualan hasil budidaya Anda.
            </p>
          </div>
        </div>

        <div class="mt-6 grid gap-3 md:grid-cols-2">
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Judul listing</span>
            <input
              v-model="draftForm.title"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Judul listing"
            />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Kategori</span>
            <input
              v-model="draftForm.category"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Kategori"
            />
          </label>
          <label class="md:col-span-2">
            <span class="mb-2 block text-sm font-semibold text-gm-text">Deskripsi</span>
            <textarea
              v-model="draftForm.description"
              rows="4"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Jelaskan kesegaran, metode budidaya, catatan pengambilan..."
            />
          </label>
          <label class="md:col-span-2">
            <span class="mb-2 block text-sm font-semibold text-gm-text">Gambar listing</span>
            <input
              type="file"
              accept="image/*"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              @change="handleDraftImageChange"
            />
          </label>
          <img
            v-if="draftImagePreview"
            :src="draftImagePreview"
            alt="Pratinjau listing"
            class="md:col-span-2 h-48 w-full rounded-[1.5rem] object-cover"
          />
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Lokasi</span>
            <input
              v-model="draftForm.locationLabel"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Lokasi"
            />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Preferensi kontak</span>
            <select
              v-model="draftForm.contactPreference"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
            >
              <option value="chat">Chat dulu</option>
              <option value="pickup">Ambil di tempat</option>
              <option value="delivery">Pengiriman diutamakan</option>
            </select>
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Jumlah</span>
            <input
              v-model="draftForm.quantity"
              type="number"
              min="1"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Jumlah"
            />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Satuan jumlah</span>
            <input
              v-model="draftForm.quantityUnit"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Satuan"
            />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Harga</span>
            <input
              v-model="draftForm.price"
              type="number"
              min="0"
              step="0.01"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Harga"
            />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Satuan harga</span>
            <input
              v-model="draftForm.priceUnit"
              class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none"
              placeholder="Satuan harga"
            />
          </label>
        </div>

        <div class="mt-5 flex flex-wrap gap-3">
          <button
            @click="handleSaveDraft"
            class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white"
            :disabled="savingDraft"
          >
            {{
              savingDraft
                ? 'Menyimpan...'
                : editingListingId
                  ? 'Perbarui Listing'
                  : draftForm.draftId
                    ? 'Perbarui Draft'
                    : 'Simpan Draft'
            }}
          </button>
          <button
            @click="resetDraftForm"
            class="rounded-full bg-[#e8e8e8] px-5 py-3 text-sm font-bold text-gm-text"
          >
            Bersihkan
          </button>
        </div>

        <div v-if="data.listingDrafts.length || data.myListings.length" class="mt-8 space-y-4">
          <h3 class="font-headline text-lg font-bold text-gm-text">Listing Anda</h3>
          <div
            v-for="draft in data.listingDrafts"
            :key="draft._id"
            class="rounded-[1.5rem] bg-[#f7f7f7] p-4"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ draft.title }}</div>
                <div class="mt-1 text-xs text-gm-muted">
                  Draft • {{ draft.quantityLabel }} • {{ draft.priceLabel }} •
                  {{ draft.locationLabel }}
                </div>
              </div>
              <div class="flex flex-wrap gap-3">
                <button
                  @click="editDraft(draft)"
                  class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text"
                >
                  Edit
                </button>
                <button
                  @click="handlePublishDraft(draft._id)"
                  class="rounded-full bg-[#fff0ec] px-4 py-2 text-xs font-bold text-[#ee4d2d]"
                  :disabled="publishingDraftId === draft._id || draft.status === 'published'"
                >
                  {{
                    publishingDraftId === draft._id
                      ? 'Mempublikasikan...'
                      : draft.status === 'published'
                        ? 'Sudah terbit'
                        : 'Publikasikan'
                  }}
                </button>
                <button
                  @click="handleDeleteDraft(draft._id)"
                  class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548]"
                  :disabled="deletingDraftId === draft._id"
                >
                  {{ deletingDraftId === draft._id ? 'Menghapus...' : 'Hapus' }}
                </button>
              </div>
            </div>
          </div>

          <div
            v-for="listing in data.myListings"
            :key="listing._id"
            class="rounded-[1.5rem] bg-[#f7f7f7] p-4"
          >
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ listing.title }}</div>
                <div class="mt-1 text-xs text-gm-muted">
                  Aktif • {{ listing.quantityLabel }} • {{ listing.priceLabel }} •
                  {{ listing.statusLabel }}
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <button
                  @click="editListing(listing)"
                  class="rounded-full bg-white px-3 py-2 text-xs font-bold text-gm-text"
                >
                  Edit
                </button>
                <button
                  @click="handleUpdateListingStatus(listing._id, 'sold')"
                  class="rounded-full bg-[#e8ffe8] px-3 py-2 text-xs font-bold text-[#005313]"
                  :disabled="updatingListingId === listing._id"
                >
                  Terjual
                </button>
                <button
                  @click="handleUpdateListingStatus(listing._id, 'active')"
                  class="rounded-full bg-[#cae6ff] px-3 py-2 text-xs font-bold text-[#006493]"
                  :disabled="updatingListingId === listing._id"
                >
                  Tayangkan lagi
                </button>
                <button
                  @click="handleDeleteListing(listing._id)"
                  class="rounded-full bg-[#ffdbcf] px-3 py-2 text-xs font-bold text-[#795548]"
                  :disabled="deletingListingId === listing._id"
                >
                  {{ deletingListingId === listing._id ? 'Menghapus...' : 'Hapus' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>

      <article class="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">Percakapan Marketplace</h2>
            <p class="text-sm text-gm-muted">
              Setiap percakapan pembeli dan penjual tetap terhubung ke penawaran yang sedang dibahas.
            </p>
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
                  <div class="mt-1 text-xs text-gm-muted">
                    {{ thread.participantName }} • {{ thread.role }}
                  </div>
                </div>
                <div class="text-[11px] text-gm-muted">
                  {{
                    thread.role === 'seller' ? thread.sellerUnreadCount : thread.buyerUnreadCount
                  }}
                </div>
              </div>
              <div class="mt-2 text-xs text-gm-muted">{{ thread.lastMessagePreview }}</div>
            </button>

            <div
              v-if="!data.threads.length"
              class="rounded-[1.25rem] bg-[#f3f3f3] p-6 text-sm text-gm-muted"
            >
              Belum ada percakapan marketplace.
            </div>
          </div>

          <div
            v-if="selectedThread"
            class="flex min-h-[420px] flex-col rounded-[1.5rem] bg-[#f7f7f7] p-4"
          >
            <div class="border-b border-[#e5e5e5] px-2 pb-4">
              <div class="text-sm font-bold text-gm-text">{{ selectedThread.productTitle }}</div>
              <div class="mt-1 text-xs text-gm-muted">
                Sedang berbicara dengan {{ selectedThread.participantName }}
              </div>
            </div>
            <div class="flex-1 space-y-3 overflow-y-auto px-1 py-4">
              <div
                v-for="message in selectedThread.messages"
                :key="message._id"
                class="flex"
                :class="message.mine ? 'justify-end' : 'justify-start'"
              >
                <div
                  class="max-w-[85%] rounded-[1.25rem] px-4 py-3 text-sm"
                  :class="message.mine ? 'bg-gm-primary text-white' : 'bg-white text-gm-text'"
                >
                  <div>{{ message.body }}</div>
                  <div
                    class="mt-2 text-[11px]"
                    :class="message.mine ? 'text-white/70' : 'text-gm-muted'"
                  >
                    {{ message.createdAtLabel }}
                  </div>
                </div>
              </div>
            </div>
            <div class="flex gap-3 border-t border-[#e5e5e5] pt-4">
              <input
                v-model="replyMessage"
                @keyup.enter="!sendingReply && handleReplyThread()"
                class="flex-1 rounded-full bg-white px-5 py-3 text-sm outline-none"
                placeholder="Balas di percakapan listing ini..."
              />
              <button
                @click="handleReplyThread"
                class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white"
                :disabled="sendingReply"
              >
                {{ sendingReply ? 'Mengirim...' : 'Kirim' }}
              </button>
            </div>
          </div>

          <div v-else class="rounded-[1.5rem] bg-[#f3f3f3] p-8 text-sm text-gm-muted">
            Pilih percakapan untuk mengelola pertanyaan listing.
          </div>
        </div>
      </article>
    </section>
  </div>

  <div
    v-if="showInquiryModal && inquiryListing"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
    @click="showInquiryModal = false"
  >
    <div class="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-2xl" @click.stop>
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="font-headline text-2xl font-bold text-gm-text">
            Kirim pesan ke {{ inquiryListing.sellerName }}
          </h3>
          <p class="mt-1 text-sm text-gm-muted">
            Percakapan ini akan tetap terkait dengan {{ inquiryListing.title }}.
          </p>
        </div>
        <button class="rounded-full p-2 hover:bg-[#f3f3f3]" @click="showInquiryModal = false">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <textarea
        v-model="inquiryMessage"
        rows="7"
        class="mt-6 w-full rounded-[1.5rem] bg-[#f7f7f7] px-5 py-4 text-sm outline-none"
        placeholder="Tanyakan ketersediaan, waktu ambil, kondisi, jumlah, atau pengiriman..."
      />
      <div class="mt-6 flex gap-3">
        <button
          @click="handleSendInquiry"
          class="flex-1 rounded-full bg-gm-primary px-6 py-4 text-sm font-bold text-white"
          :disabled="sendingInquiry"
        >
          {{ sendingInquiry ? 'Mengirim...' : 'Kirim Pertanyaan' }}
        </button>
        <button
          @click="showInquiryModal = false"
          class="rounded-full bg-[#e8e8e8] px-6 py-4 text-sm font-bold text-gm-text"
        >
          Batal
        </button>
      </div>
    </div>
  </div>
</template>
