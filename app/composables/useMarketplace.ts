import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'
import type { Id } from '@/lib/convex-types'

export function useMarketplace() {
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

  const { data } = useConvexQuery(api.marketplace.marketplace, {})

  const { mutate: saveMarketplaceDraft } = useConvexMutation(api.marketplace.saveMarketplaceDraft)
  const { mutate: publishMarketplaceDraft } = useConvexMutation(api.marketplace.publishMarketplaceDraft)
  const { mutate: updateMarketplaceListingStatus } = useConvexMutation(api.marketplace.updateMarketplaceListingStatus)
  const { mutate: updateMarketplaceListing } = useConvexMutation(api.marketplace.updateMarketplaceListing)
  const { mutate: deleteMarketplaceDraft } = useConvexMutation(api.marketplace.deleteMarketplaceDraft)
  const { mutate: deleteMarketplaceListing } = useConvexMutation(api.marketplace.deleteMarketplaceListing)
  const { mutate: sendMarketplaceMessage } = useConvexMutation(api.marketplace.sendMarketplaceMessage)
  const { mutate: replyMarketplaceThread } = useConvexMutation(api.marketplace.replyMarketplaceThread)
  const { mutate: markMarketplaceThreadRead } = useConvexMutation(api.marketplace.markMarketplaceThreadRead)


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
        !threads.some((thread: { _id: string }) => thread._id === selectedThreadId.value)
      ) {
        selectedThreadId.value = threads[0]!._id
      }
    },
    { immediate: true },
  )

  watch(selectedThreadId, async (threadId) => {
    if (!threadId) return
    try {
      await markMarketplaceThreadRead({ threadId: threadId as Id<'marketplaceThreads'> })
    } catch {
      // no-op
    }
  })

  const featured = computed(() => data.value?.featured ?? null)

  const filteredOfficial = computed(() => {
    const official = data.value?.official ?? []
    const query = searchQuery.value.trim().toLowerCase()
    return official.filter((item: { title: string; description: string; category: string }) => {
      if (selectedCategory.value === 'community') return false
      if (!query) return true
      return `${item.title} ${item.description} ${item.category}`.toLowerCase().includes(query)
    })
  })

  const filteredCommunity = computed(() => {
    const community = data.value?.community ?? []
    const query = searchQuery.value.trim().toLowerCase()
    return community.filter((item: { title: string; description: string; category: string; sellerName: string }) => {
      if (selectedCategory.value === 'official') return false
      if (!query) return true
      return `${item.title} ${item.description} ${item.category} ${item.sellerName}`
        .toLowerCase()
        .includes(query)
    })
  })

  const selectedThread = computed(
    () => data.value?.threads.find((thread: { _id: string }) => thread._id === selectedThreadId.value) ?? null,
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
    draftImagePreview.value = draft.imageUrl
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
    draftImagePreview.value = listing.imageUrl
  }

  function handleDraftImageChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    draftImageFile.value = file
    draftImagePreview.value = readSelectedImage(file) ?? draftImagePreview.value
  }

  function openInquiry(listing: MarketplaceListing) {
    inquiryListing.value = {
      _id: listing._id,
      sellerName: listing.sellerName,
      title: listing.title,
      contactThreadId: listing.contactThreadId,
    }
    inquiryMessage.value = `Halo ${listing.sellerName}, saya tertarik dengan ${listing.title}. Apakah masih tersedia?`
    showInquiryModal.value = true
  }

  async function handleSaveDraft() {
    savingDraft.value = true
    try {
      const imageUrl = draftImageFile.value
        ? await uploadImageFile(draftImageFile.value)
        : undefined
      if (editingListingId.value) {
        await updateMarketplaceListing({
          productId: editingListingId.value as Id<'products'>,
          title: draftForm.value.title,
          description: draftForm.value.description,
          category: draftForm.value.category,
          quantity: draftForm.value.quantity,
          quantityUnit: draftForm.value.quantityUnit,
          price: draftForm.value.price,
          priceUnit: draftForm.value.priceUnit,
          imageUrl: imageUrl ?? undefined,
          locationLabel: draftForm.value.locationLabel,
          contactPreference: draftForm.value.contactPreference,
        })
        toast.success('Listing diperbarui')
      } else {
        await saveMarketplaceDraft({
          ...draftForm.value,
          draftId: draftForm.value.draftId ? (draftForm.value.draftId as Id<'listingDrafts'>) : undefined,
          imageUrl: imageUrl ?? undefined,
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
      await publishMarketplaceDraft({ draftId: draftId as Id<'listingDrafts'> })
      toast.success('Listing dipublikasikan ke marketplace komunitas')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal mempublikasikan listing'))
    } finally {
      publishingDraftId.value = null
    }
  }

  async function handleUpdateListingStatus(productId: string, status: 'active' | 'reserved' | 'sold' | 'archived') {
    updatingListingId.value = productId
    try {
      await updateMarketplaceListingStatus({ productId: productId as Id<'products'>, status })
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
      await deleteMarketplaceDraft({ draftId: draftId as Id<'listingDrafts'> })
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
      await deleteMarketplaceListing({ productId: productId as Id<'products'> })
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
        productId: inquiryListing.value._id as Id<'products'>,
        threadId: (inquiryListing.value.contactThreadId ?? undefined) as Id<'marketplaceThreads'> | undefined,
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
        threadId: selectedThread.value._id as Id<'marketplaceThreads'>,
        body: replyMessage.value,
      })
      replyMessage.value = ''
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal mengirim balasan'))
    } finally {
      sendingReply.value = false
    }
  }

  return {
    // state
    searchQuery, selectedCategory, selectedThreadId,
    showInquiryModal, inquiryListing, inquiryMessage, replyMessage,
    draftForm, data,
    savingDraft, publishingDraftId, updatingListingId,
    deletingDraftId, deletingListingId,
    sendingInquiry, sendingReply, editingListingId,
    draftImageFile, draftImagePreview, failedMarketplaceImages,

    // computed
    featured, filteredOfficial, filteredCommunity, selectedThread,

    // helper methods
    openExternal, hasWorkingImage, handleImageError,
    resetDraftForm, editDraft, editListing, handleDraftImageChange, openInquiry,

    // mutation handlers
    handleSaveDraft, handlePublishDraft, handleUpdateListingStatus,
    handleDeleteDraft, handleDeleteListing,
    handleSendInquiry, handleReplyThread,
  }
}
