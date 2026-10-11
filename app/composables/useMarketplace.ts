import { computed, ref, watch } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '~~/convex/_generated/api'
import { getErrorMessage } from '~~/shared/utils/errors'
import { uploadImageFile } from '@/utils/uploads'
import type { Id } from '@/utils/convex-types'
import { filterCommunityItems, filterOfficialItems } from '@/composables/marketplace/filters'
import type { MarketplaceCategoryFilter } from '@/composables/marketplace/filters'
import { useMarketplaceForms } from '@/composables/marketplace/forms'

export {
  filterCommunityItems,
  filterOfficialItems,
  matchesMarketplaceQuery,
} from '@/composables/marketplace/filters'
export type {
  MarketplaceCategoryFilter,
  MarketplaceSearchableItem,
} from '@/composables/marketplace/filters'
export { mapFormFields } from '@/composables/marketplace/forms'
export type {
  DraftFormSource,
  DraftFormState,
  EditableDraftSource,
  EditableListingSource,
} from '@/composables/marketplace/forms'

export function useMarketplace() {
  const searchQuery = ref('')
  const selectedCategory = ref<MarketplaceCategoryFilter>('all')
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

  const {
    draftForm,
    editingListingId,
    draftImageFile,
    draftImagePreview,
    resetDraftForm,
    editDraft,
    editListing,
    handleDraftImageChange,
  } = useMarketplaceForms()

  const { data } = useConvexQuery(api.marketplace.marketplace, {})

  const { mutate: saveMarketplaceDraft } = useConvexMutation(api.marketplace.saveMarketplaceDraft)
  const { mutate: publishMarketplaceDraft } = useConvexMutation(
    api.marketplace.publishMarketplaceDraft,
  )
  const { mutate: updateMarketplaceListingStatus } = useConvexMutation(
    api.marketplace.updateMarketplaceListingStatus,
  )
  const { mutate: updateMarketplaceListing } = useConvexMutation(
    api.marketplace.updateMarketplaceListing,
  )
  const { mutate: deleteMarketplaceDraft } = useConvexMutation(
    api.marketplace.deleteMarketplaceDraft,
  )
  const { mutate: deleteMarketplaceListing } = useConvexMutation(
    api.marketplace.deleteMarketplaceListing,
  )
  const { mutate: sendMarketplaceMessage } = useConvexMutation(
    api.marketplace.sendMarketplaceMessage,
  )
  const { mutate: replyMarketplaceThread } = useConvexMutation(
    api.marketplace.replyMarketplaceThread,
  )
  const { mutate: markMarketplaceThreadRead } = useConvexMutation(
    api.marketplace.markMarketplaceThreadRead,
  )

  const savingDraft = ref(false)
  const publishingDraftId = ref<string | null>(null)
  const updatingListingId = ref<string | null>(null)
  const deletingDraftId = ref<string | null>(null)
  const deletingListingId = ref<string | null>(null)
  const sendingInquiry = ref(false)
  const sendingReply = ref(false)
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
        const first = threads[0]
        if (first) {
          selectedThreadId.value = first._id
        }
      }
    },
    { immediate: true },
  )

  watch(selectedThreadId, async (threadId) => {
    if (!threadId) return
    try {
      await markMarketplaceThreadRead({ threadId: threadId as Id<'marketplaceThreads'> })
    } catch (error) {
      // Best-effort read receipt: the watcher must not break thread selection
      // when the mark-read write fails (offline/race with deletion), so the
      // failure stays silent to the user and is only logged for diagnostics.
      console.warn('[marketplace] markMarketplaceThreadRead failed', error)
    }
  })

  const featured = computed(() => data.value?.featured ?? null)

  const filteredOfficial = computed(() =>
    filterOfficialItems(data.value?.official ?? [], searchQuery.value, selectedCategory.value),
  )

  const filteredCommunity = computed(() =>
    filterCommunityItems(data.value?.community ?? [], searchQuery.value, selectedCategory.value),
  )

  const selectedThread = computed(
    () =>
      data.value?.threads.find(
        (thread: { _id: string }) => thread._id === selectedThreadId.value,
      ) ?? null,
  )

  function openExternal(url: string) {
    window.open(url, '_blank', 'noopener')
  }

  function hasWorkingImage(id: string, image?: string | null) {
    return Boolean(image) && !failedMarketplaceImages.value.includes(id)
  }

  function handleImageError(id: string) {
    if (!failedMarketplaceImages.value.includes(id)) {
      failedMarketplaceImages.value = [...failedMarketplaceImages.value, id]
    }
  }

  function openInquiry(listing: {
    _id: string
    sellerName: string
    title: string
    contactThreadId: string | null
  }) {
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
          draftId: draftForm.value.draftId
            ? (draftForm.value.draftId as Id<'listingDrafts'>)
            : undefined,
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

  const listingStatusToast: Record<'active' | 'reserved' | 'sold' | 'archived', string> = {
    active: 'Listing diaktifkan',
    reserved: 'Listing dipesan',
    sold: 'Listing terjual',
    archived: 'Listing diarsipkan',
  }

  async function handleUpdateListingStatus(
    productId: string,
    status: 'active' | 'reserved' | 'sold' | 'archived',
  ) {
    updatingListingId.value = productId
    try {
      await updateMarketplaceListingStatus({ productId: productId as Id<'products'>, status })
      toast.success(listingStatusToast[status])
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
        threadId: (inquiryListing.value.contactThreadId ?? undefined) as
          | Id<'marketplaceThreads'>
          | undefined,
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
    searchQuery,
    selectedCategory,
    selectedThreadId,
    showInquiryModal,
    inquiryListing,
    inquiryMessage,
    replyMessage,
    draftForm,
    data,
    savingDraft,
    publishingDraftId,
    updatingListingId,
    deletingDraftId,
    deletingListingId,
    sendingInquiry,
    sendingReply,
    editingListingId,
    draftImageFile,
    draftImagePreview,
    failedMarketplaceImages,

    // computed
    featured,
    filteredOfficial,
    filteredCommunity,
    selectedThread,

    // helper methods
    openExternal,
    hasWorkingImage,
    handleImageError,
    resetDraftForm,
    editDraft,
    editListing,
    handleDraftImageChange,
    openInquiry,

    // mutation handlers
    handleSaveDraft,
    handlePublishDraft,
    handleUpdateListingStatus,
    handleDeleteDraft,
    handleDeleteListing,
    handleSendInquiry,
    handleReplyThread,
  }
}
