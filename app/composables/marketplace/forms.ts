import { ref } from 'vue'
import { readSelectedImage } from '@/utils/uploads'

export interface DraftFormState {
  draftId: string | null
  title: string
  description: string
  category: string
  quantity: number
  quantityUnit: string
  price: number
  priceUnit: string
  locationLabel: string
  contactPreference: 'chat' | 'pickup' | 'delivery'
}

export interface DraftFormSource {
  title: string
  description: string
  category: string
  quantity?: number
  quantityAvailable?: number
  quantityUnit?: string | null
  price: number
  priceUnit: string
  locationLabel?: string | null
  contactPreference?: 'chat' | 'pickup' | 'delivery' | null
  imageUrl?: string | null
}

export interface EditableDraftSource extends DraftFormSource {
  _id: string
  imageUrl: string | null
}

export interface EditableListingSource extends DraftFormSource {
  _id: string
  imageUrl: string | null
}

/**
 * Single source for hydrating the draft form from either a saved draft
 * (which carries `quantity`) or a published listing (which carries
 * `quantityAvailable` plus nullable display fields).
 */
export function mapFormFields(source: DraftFormSource, draftId: string | null): DraftFormState {
  return {
    draftId,
    title: source.title,
    description: source.description,
    category: source.category,
    quantity: source.quantity ?? source.quantityAvailable ?? 1,
    quantityUnit: source.quantityUnit ?? 'item',
    price: source.price,
    priceUnit: source.priceUnit,
    locationLabel: source.locationLabel ?? '',
    contactPreference: source.contactPreference ?? 'chat' as 'chat' | 'pickup' | 'delivery',
  }
}

function defaultDraftForm(): DraftFormState {
  return {
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
}

/**
 * Owns the marketplace draft/listing form state and the edit handlers.
 * Mutation handlers (`handleSaveDraft`, ...) stay in `useMarketplace` and
 * operate on the refs returned here.
 */
export function useMarketplaceForms() {
  const draftForm = ref<DraftFormState>(defaultDraftForm())
  const editingListingId = ref<string | null>(null)
  const draftImageFile = ref<File | null>(null)
  const draftImagePreview = ref<string | null>(null)

  function resetDraftForm() {
    editingListingId.value = null
    draftForm.value = defaultDraftForm()
    draftImageFile.value = null
    draftImagePreview.value = null
  }

  function editDraft(draft: EditableDraftSource) {
    editingListingId.value = null
    draftForm.value = mapFormFields(draft, draft._id)
    draftImageFile.value = null
    draftImagePreview.value = draft.imageUrl
  }

  function editListing(listing: EditableListingSource) {
    editingListingId.value = listing._id
    draftForm.value = mapFormFields(listing, null)
    draftImageFile.value = null
    draftImagePreview.value = listing.imageUrl
  }

  function handleDraftImageChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0] ?? null
    draftImageFile.value = file
    draftImagePreview.value = readSelectedImage(file) ?? draftImagePreview.value
  }

  return {
    draftForm,
    editingListingId,
    draftImageFile,
    draftImagePreview,
    resetDraftForm,
    editDraft,
    editListing,
    handleDraftImageChange,
  }
}
