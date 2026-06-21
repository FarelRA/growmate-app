<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
type DraftForm = { draftId: string | null; title: string; description: string; category: string; quantity: number; quantityUnit: string; price: number; priceUnit: string; locationLabel: string; contactPreference: 'chat' | 'pickup' | 'delivery' }

const props = defineProps<{
  draftForm: DraftForm
  draftImagePreview: string | null
  savingDraft: boolean
  publishingDraftId: string | null
  deletingDraftId: string | null
  updatingListingId: string | null
  deletingListingId: string | null
  editingListingId: string | null
  listingDrafts: { _id: string; title: string; quantityLabel: string; priceLabel: string; locationLabel: string; status: string }[]
  myListings: { _id: string; title: string; quantityLabel: string; priceLabel: string; statusLabel: string }[]
}>()

const emit = defineEmits<{
  saveDraft: []
  publishDraft: [draftId: string]
  updateListingStatus: [productId: string, status: 'active' | 'reserved' | 'sold' | 'archived']
  deleteDraft: [draftId: string]
  deleteListing: [productId: string]
  resetForm: []
  editDraft: [draft: any]
  editListing: [listing: any]
  imageChange: [event: Event]
  'update:draftForm': [value: DraftForm]
}>()

function updateField(field: string, value: string | number) {
  emit('update:draftForm', { ...props.draftForm, [field]: value })
}
</script>

<template>
  <article class="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h2 class="font-headline text-2xl font-bold text-gm-text">Ruang Kelola Penjualan</h2>
        <p class="text-sm text-gm-muted">Susun draft, publikasikan penawaran, dan kelola informasi penjualan hasil budidaya Anda.</p>
      </div>
    </div>

    <div class="mt-6 grid gap-3 md:grid-cols-2">
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Judul listing</span>
        <input :value="draftForm.title" @input="updateField('title', ($event.target as HTMLInputElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Judul listing" />
      </label>
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Kategori</span>
        <input :value="draftForm.category" @input="updateField('category', ($event.target as HTMLInputElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Kategori" />
      </label>
      <label class="md:col-span-2">
        <span class="mb-2 block text-sm font-semibold text-gm-text">Deskripsi</span>
        <textarea :value="draftForm.description" @input="updateField('description', ($event.target as HTMLTextAreaElement).value)" rows="4" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Jelaskan kesegaran, metode budidaya, catatan pengambilan..." />
      </label>
      <label class="md:col-span-2">
        <span class="mb-2 block text-sm font-semibold text-gm-text">Gambar listing</span>
        <input type="file" accept="image/*" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="$emit('imageChange', $event)" />
      </label>
      <img v-if="draftImagePreview" :src="draftImagePreview" alt="Pratinjau listing" class="md:col-span-2 h-48 w-full rounded-[1.5rem] object-cover" />
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Lokasi</span>
        <input :value="draftForm.locationLabel" @input="updateField('locationLabel', ($event.target as HTMLInputElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Lokasi" />
      </label>
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Preferensi kontak</span>
        <select :value="draftForm.contactPreference" @input="updateField('contactPreference', ($event.target as HTMLSelectElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none">
          <option value="chat">Chat dulu</option>
          <option value="pickup">Ambil di tempat</option>
          <option value="delivery">Pengiriman diutamakan</option>
        </select>
      </label>
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Jumlah</span>
        <input :value="draftForm.quantity" @input="updateField('quantity', Number(($event.target as HTMLInputElement).value) || 1)" type="number" min="1" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Jumlah" />
      </label>
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Satuan jumlah</span>
        <input :value="draftForm.quantityUnit" @input="updateField('quantityUnit', ($event.target as HTMLInputElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Satuan" />
      </label>
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Harga</span>
        <input :value="draftForm.price" @input="updateField('price', Number(($event.target as HTMLInputElement).value) || 0)" type="number" min="0" step="0.01" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Harga" />
      </label>
      <label>
        <span class="mb-2 block text-sm font-semibold text-gm-text">Satuan harga</span>
        <input :value="draftForm.priceUnit" @input="updateField('priceUnit', ($event.target as HTMLInputElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Satuan harga" />
      </label>
    </div>

    <div class="mt-5 flex flex-wrap gap-3">
      <button @click="$emit('saveDraft')" class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" :disabled="savingDraft">
        {{ savingDraft ? 'Menyimpan...' : editingListingId ? 'Perbarui Listing' : draftForm.draftId ? 'Perbarui Draft' : 'Simpan Draft' }}
      </button>
      <button @click="$emit('resetForm')" class="rounded-full bg-[#e8e8e8] px-5 py-3 text-sm font-bold text-gm-text">Bersihkan</button>
    </div>

    <div v-if="listingDrafts.length || myListings.length" class="mt-8 space-y-4">
      <h3 class="font-headline text-lg font-bold text-gm-text">Listing Anda</h3>
      <div v-for="draft in listingDrafts" :key="draft._id" class="rounded-[1.5rem] bg-[#f7f7f7] p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="text-sm font-bold text-gm-text">{{ draft.title }}</div>
            <div class="mt-1 text-xs text-gm-muted">Draft • {{ draft.quantityLabel }} • {{ draft.priceLabel }} • {{ draft.locationLabel }}</div>
          </div>
          <div class="flex flex-wrap gap-3">
            <button @click="$emit('editDraft', draft)" class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text">Edit</button>
            <button @click="$emit('publishDraft', draft._id)" class="rounded-full bg-[#fff0ec] px-4 py-2 text-xs font-bold text-[#ee4d2d]" :disabled="publishingDraftId === draft._id || draft.status === 'published'">
              {{ publishingDraftId === draft._id ? 'Mempublikasikan...' : draft.status === 'published' ? 'Sudah terbit' : 'Publikasikan' }}
            </button>
            <button @click="$emit('deleteDraft', draft._id)" class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548]" :disabled="deletingDraftId === draft._id">
              {{ deletingDraftId === draft._id ? 'Menghapus...' : 'Hapus' }}
            </button>
          </div>
        </div>
      </div>

      <div v-for="listing in myListings" :key="listing._id" class="rounded-[1.5rem] bg-[#f7f7f7] p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div class="text-sm font-bold text-gm-text">{{ listing.title }}</div>
            <div class="mt-1 text-xs text-gm-muted">Aktif • {{ listing.quantityLabel }} • {{ listing.priceLabel }} • {{ listing.statusLabel }}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button @click="$emit('editListing', listing)" class="rounded-full bg-white px-3 py-2 text-xs font-bold text-gm-text">Edit</button>
            <button @click="$emit('updateListingStatus', listing._id, 'sold')" class="rounded-full bg-[#e8ffe8] px-3 py-2 text-xs font-bold text-[#005313]" :disabled="updatingListingId === listing._id">Terjual</button>
            <button @click="$emit('updateListingStatus', listing._id, 'active')" class="rounded-full bg-[#cae6ff] px-3 py-2 text-xs font-bold text-[#006493]" :disabled="updatingListingId === listing._id">Tayangkan lagi</button>
            <button @click="$emit('deleteListing', listing._id)" class="rounded-full bg-[#ffdbcf] px-3 py-2 text-xs font-bold text-[#795548]" :disabled="deletingListingId === listing._id">
              {{ deletingListingId === listing._id ? 'Menghapus...' : 'Hapus' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
