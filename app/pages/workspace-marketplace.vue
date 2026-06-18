<script setup lang="ts">
import { useMarketplace } from '@/composables/useMarketplace'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

const {
  searchQuery, selectedCategory, selectedThreadId,
  showInquiryModal, inquiryListing, inquiryMessage, replyMessage,
  draftForm, data,
  savingDraft, publishingDraftId, updatingListingId,
  deletingDraftId, deletingListingId,
  sendingInquiry, sendingReply, editingListingId,
  draftImagePreview,

  featured, filteredOfficial, filteredCommunity, selectedThread,

  openExternal, hasWorkingImage, handleImageError,
  resetDraftForm, editDraft, editListing, handleDraftImageChange, openInquiry,

  handleSaveDraft, handlePublishDraft, handleUpdateListingStatus,
  handleDeleteDraft, handleDeleteListing,
  handleSendInquiry, handleReplyThread,
} = useMarketplace()
</script>

<template>
  <div v-if="data" class="space-y-6">
    <ListingGrid
      :featured="featured"
      :filtered-official="filteredOfficial"
      :filtered-community="filteredCommunity"
      :search-query="searchQuery"
      :selected-category="selectedCategory"
      :has-working-image="hasWorkingImage"
      @open-external="openExternal"
      @handle-image-error="handleImageError"
      @update:search-query="searchQuery = $event"
      @update:selected-category="selectedCategory = $event"
      @open-inquiry="openInquiry"
    />

    <section class="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <ListingForm
        :draft-form="draftForm"
        :draft-image-preview="draftImagePreview"
        :saving-draft="savingDraft"
        :publishing-draft-id="publishingDraftId"
        :deleting-draft-id="deletingDraftId"
        :updating-listing-id="updatingListingId"
        :deleting-listing-id="deletingListingId"
        :editing-listing-id="editingListingId"
        :listing-drafts="data.listingDrafts"
        :my-listings="data.myListings"
        @update:draft-form="draftForm = $event"
        @save-draft="handleSaveDraft"
        @publish-draft="handlePublishDraft"
        @update-listing-status="handleUpdateListingStatus"
        @delete-draft="handleDeleteDraft"
        @delete-listing="handleDeleteListing"
        @reset-form="resetDraftForm"
        @edit-draft="editDraft"
        @edit-listing="editListing"
        @image-change="handleDraftImageChange"
      />

      <ChatPanel
        :threads="data.threads"
        :selected-thread="selectedThread"
        :selected-thread-id="selectedThreadId"
        :reply-message="replyMessage"
        :sending-reply="sendingReply"
        @select-thread="selectedThreadId = $event"
        @update:reply-message="replyMessage = $event"
        @reply-thread="handleReplyThread"
      />
    </section>
  </div>

  <div v-else class="rounded-[2rem] bg-white p-6 text-sm text-gm-muted shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
    Memuat marketplace...
  </div>

  <div
    v-if="showInquiryModal && inquiryListing"
    role="dialog"
    aria-modal="true"
    aria-label="Kirim pesan"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
    @click="showInquiryModal = false"
  >
    <div class="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-2xl" @click.stop>
      <div class="flex items-start justify-between gap-4">
        <div>
          <h3 class="font-headline text-2xl font-bold text-gm-text">Kirim pesan ke {{ inquiryListing.sellerName }}</h3>
          <p class="mt-1 text-sm text-gm-muted">Percakapan ini akan tetap terkait dengan {{ inquiryListing.title }}.</p>
        </div>
        <button class="rounded-full p-2 hover:bg-[#f3f3f3]" aria-label="Tutup" @click="showInquiryModal = false">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <label class="mt-6 block">
        <span class="mb-2 block text-sm font-semibold text-gm-text">Pesan</span>
        <textarea
          v-model="inquiryMessage"
          rows="7"
          class="w-full rounded-[1.5rem] bg-[#f7f7f7] px-5 py-4 text-sm outline-none"
          placeholder="Tanyakan ketersediaan, waktu ambil, kondisi, jumlah, atau pengiriman..."
        />
      </label>
      <div class="mt-6 flex gap-3">
        <button
          @click="handleSendInquiry"
          class="flex-1 rounded-full bg-gm-primary px-6 py-4 text-sm font-bold text-white"
          :disabled="sendingInquiry"
        >
          {{ sendingInquiry ? 'Mengirim...' : 'Kirim Pertanyaan' }}
        </button>
        <button @click="showInquiryModal = false" class="rounded-full bg-[#e8e8e8] px-6 py-4 text-sm font-bold text-gm-text">Batal</button>
      </div>
    </div>
  </div>
</template>
