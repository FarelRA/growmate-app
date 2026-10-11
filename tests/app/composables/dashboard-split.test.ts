// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import type { Ref } from 'vue'

vi.mock('@convex-vue/core', () => ({
  useConvexMutation: () => ({ mutate: vi.fn() }),
  useConvexQuery: () => ({ data: ref(null) }),
}))

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils/images', () => ({
  getImageUrl: (path?: string | null) => path ?? null,
}))

vi.mock('@/utils/uploads', () => ({
  readSelectedImage: () => null,
  uploadImageFile: vi.fn(),
}))

vi.stubGlobal('useRoute', () => ({ query: {} }))
vi.stubGlobal('useRouter', () => ({ replace: vi.fn(), push: vi.fn() }))

import { useDashboard } from '../../../app/composables/useDashboard'
import { useMarketplace } from '../../../app/composables/useMarketplace'
import {
  filterCommunityItems,
  filterOfficialItems,
  matchesMarketplaceQuery,
} from '../../../app/composables/useMarketplace'
import {
  filterCommunityItems as filterCommunityDirect,
  filterOfficialItems as filterOfficialDirect,
  matchesMarketplaceQuery as matchesDirect,
} from '../../../app/composables/marketplace/filters'
import { mapFormFields } from '../../../app/composables/marketplace/forms'

const DASHBOARD_KEYS = [
  'panelOptions', 'iconMap', 'accentMap',
  'devices', 'data', 'plantLibrary', 'historyData',
  'activePanel', 'currentDeviceId',
  'waterSensor', 'displayPlantImage', 'displaySensors',
  'schedulePreview', 'historyMetricCards',
  'scheduleForm', 'savingSchedule', 'deletingScheduleId', 'removingDeviceId',
  'setPanel', 'handleSelectDevice', 'openSelectPlant',
  'handleWater', 'handleLight', 'handleFertilize', 'handlePesticide', 'handleToggleAutomation',
  'handleStartStream', 'handleStopStream', 'isStreaming',
  'handleToggleSchedule', 'handleSaveSchedule', 'handleDeleteSchedule',
  'handleRemoveDevice',
  'resetScheduleForm', 'editSchedule',
  'formatPlantHealthLabel',
  'isV2', 'streamUrl', 'recordings', 'recordingsError', 'recordingsLoading', 'recordingsRetryCount',
  'streamActive', 'isLiveLoading', 'fetchRecordings', 'retryRecordings',
  'batterySoC', 'batteryCurrent', 'batteryCapacityAh', 'batteryIcon',
  'timeToEmpty', 'timeToFull',
  'tankSwitchOpen', 'drawerSwitchOpen',
  'hasModem', 'hasSolarPanel', 'solarPanelWatts',
  'tankCapacity', 'tankMinLevel',
]

const MARKETPLACE_KEYS = [
  'searchQuery', 'selectedCategory', 'selectedThreadId',
  'showInquiryModal', 'inquiryListing', 'inquiryMessage', 'replyMessage',
  'draftForm', 'data',
  'savingDraft', 'publishingDraftId', 'updatingListingId',
  'deletingDraftId', 'deletingListingId',
  'sendingInquiry', 'sendingReply', 'editingListingId',
  'draftImageFile', 'draftImagePreview', 'failedMarketplaceImages',
  'featured', 'filteredOfficial', 'filteredCommunity', 'selectedThread',
  'openExternal', 'hasWorkingImage', 'handleImageError',
  'resetDraftForm', 'editDraft', 'editListing', 'handleDraftImageChange', 'openInquiry',
  'handleSaveDraft', 'handlePublishDraft', 'handleUpdateListingStatus',
  'handleDeleteDraft', 'handleDeleteListing',
  'handleSendInquiry', 'handleReplyThread',
]

describe('dashboard/marketplace split return shapes', () => {
  it('useDashboard keeps every facade key', () => {
    expect(Object.keys(useDashboard()).sort()).toEqual([...DASHBOARD_KEYS].sort())
  })

  it('useMarketplace keeps every facade key', () => {
    expect(Object.keys(useMarketplace()).sort()).toEqual([...MARKETPLACE_KEYS].sort())
  })

  it('re-exports the filter helpers from the facade path', () => {
    expect(filterOfficialItems).toBe(filterOfficialDirect)
    expect(filterCommunityItems).toBe(filterCommunityDirect)
    expect(matchesMarketplaceQuery).toBe(matchesDirect)
  })

  it('filters keep query semantics across category gates', () => {
    const items = [
      { title: 'Bayam Segar', description: 'Panen pagi', category: 'Fresh Produce', sellerName: 'Tani A' },
      { title: 'Pupuk Cair', description: 'Untuk hidroponik', category: 'Inputs', sellerName: 'Toko B' },
    ]
    expect(filterOfficialItems(items, 'bayam', 'all')).toHaveLength(1)
    expect(filterOfficialItems(items, '', 'community')).toEqual([])
    expect(filterCommunityItems(items, 'pupuk', 'all')).toHaveLength(1)
    expect(filterCommunityItems(items, '', 'official')).toEqual([])
    expect(matchesDirect(items[0]!, 'TANI a')).toBe(true)
  })

  it('mapFormFields hydrates drafts and listings identically', () => {
    expect(mapFormFields({
      title: 'T', description: 'D', category: 'C',
      quantity: 3, quantityUnit: 'bundle', price: 5, priceUnit: 'each',
      locationLabel: 'L', contactPreference: 'chat', imageUrl: null,
    }, 'draft-1').draftId).toBe('draft-1')
    const fromListing = mapFormFields({
      title: 'T', description: 'D', category: 'C',
      quantityAvailable: 7, quantityUnit: null, price: 5, priceUnit: 'each',
      locationLabel: null, contactPreference: null, imageUrl: null,
    }, null)
    expect(fromListing.quantity).toBe(7)
    expect(fromListing.quantityUnit).toBe('item')
    expect(fromListing.draftId).toBeNull()
  })

  it('editDraft/editListing route through the shared mapper', () => {
    const marketplace = useMarketplace()
    const draft = {
      _id: 'draft-9', title: 'Draft', description: 'D', category: 'Fresh Produce',
      quantity: 2, quantityUnit: 'bundle', price: 5, priceUnit: 'each',
      locationLabel: 'Local pickup', contactPreference: 'chat' as const, imageUrl: 'img.png',
    }
    marketplace.editDraft(draft as Parameters<typeof marketplace.editDraft>[0])
    expect((marketplace.draftForm as Ref<{ draftId: string | null }>).value.draftId).toBe('draft-9')
    const listing = {
      _id: 'prod-1', title: 'Listing', description: 'D', category: 'Fresh Produce',
      quantityAvailable: 4, quantityUnit: null, price: 9, priceUnit: 'each',
      locationLabel: null, contactPreference: null, imageUrl: null,
    }
    marketplace.editListing(listing as Parameters<typeof marketplace.editListing>[0])
    expect((marketplace.editingListingId as Ref<string | null>).value).toBe('prod-1')
    expect((marketplace.draftForm as Ref<{ quantity: number }>).value.quantity).toBe(4)
  })
})
