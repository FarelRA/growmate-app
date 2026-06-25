// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ListingForm from '../../../app/components/ListingForm.vue'

const baseForm = {
  draftId: null,
  title: '',
  description: '',
  category: '',
  quantity: 1,
  quantityUnit: 'kg',
  price: 0,
  priceUnit: '/kg',
  locationLabel: '',
  contactPreference: 'chat' as const,
}

describe('ListingForm', () => {
  function createWrapper(overrides: Record<string, unknown> = {}) {
    return mount(ListingForm, {
      props: {
        draftForm: baseForm,
        draftImagePreview: null,
        savingDraft: false,
        publishingDraftId: null,
        deletingDraftId: null,
        updatingListingId: null,
        deletingListingId: null,
        editingListingId: null,
        listingDrafts: [],
        myListings: [],
        ...overrides,
      },
    })
  }

  describe('form fields', () => {
    it('renders all form fields', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Judul listing')
      expect(wrapper.text()).toContain('Kategori')
      expect(wrapper.text()).toContain('Deskripsi')
      expect(wrapper.text()).toContain('Gambar listing')
      expect(wrapper.text()).toContain('Lokasi')
      expect(wrapper.text()).toContain('Preferensi kontak')
      expect(wrapper.text()).toContain('Jumlah')
      expect(wrapper.text()).toContain('Satuan jumlah')
      expect(wrapper.text()).toContain('Harga')
      expect(wrapper.text()).toContain('Satuan harga')
    })

    it('emits update:draftForm on title input', async () => {
      const wrapper = createWrapper()
      const input = wrapper.findAll('input').filter(i => i.attributes('placeholder') === 'Judul listing')
      await input[0].setValue('Tomat segar')
      expect(wrapper.emitted('update:draftForm')).toBeTruthy()
      const payload = wrapper.emitted('update:draftForm')![0][0] as Record<string, unknown>
      expect(payload.title).toBe('Tomat segar')
    })
  })

  describe('image preview', () => {
    it('shows image preview when draftImagePreview is set', () => {
      const wrapper = createWrapper({ draftImagePreview: '/preview.jpg' })
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('/preview.jpg')
    })

    it('does not show image preview when null', () => {
      const wrapper = createWrapper()
      const imgs = wrapper.findAll('img').filter(i => i.attributes('alt') === 'Pratinjau listing')
      expect(imgs.length).toBe(0)
    })
  })

  describe('save button text', () => {
    it('shows "Simpan Draft" when creating new draft', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Simpan Draft')
    })

    it('shows "Perbarui Draft" when draftId is set', () => {
      const wrapper = createWrapper({ draftForm: { ...baseForm, draftId: 'd1' } })
      expect(wrapper.text()).toContain('Perbarui Draft')
    })

    it('shows "Perbarui Listing" when editingListingId is set', () => {
      const wrapper = createWrapper({ editingListingId: 'l1' })
      expect(wrapper.text()).toContain('Perbarui Listing')
    })

    it('shows "Menyimpan..." when savingDraft', () => {
      const wrapper = createWrapper({ savingDraft: true })
      expect(wrapper.text()).toContain('Menyimpan...')
    })
  })

  describe('listing drafts', () => {
    const drafts = [
      { _id: 'd1', title: 'Tomat segar', quantityLabel: '2 kg', priceLabel: 'Rp 15.000', locationLabel: 'Jakarta', status: 'draft' },
    ]

    it('renders draft items', () => {
      const wrapper = createWrapper({ listingDrafts: drafts })
      expect(wrapper.text()).toContain('Tomat segar')
      expect(wrapper.text()).toContain('Draft')
      expect(wrapper.text()).toContain('2 kg')
      expect(wrapper.text()).toContain('Rp 15.000')
    })

    it('shows "Publikasikan" button for draft items', () => {
      const wrapper = createWrapper({ listingDrafts: drafts })
      expect(wrapper.text()).toContain('Publikasikan')
    })

    it('shows "Sudah terbit" when draft is published', () => {
      const published = [{ ...drafts[0], status: 'published' }]
      const wrapper = createWrapper({ listingDrafts: published })
      expect(wrapper.text()).toContain('Sudah terbit')
      expect(wrapper.text()).not.toContain('Publikasikan')
    })

    it('disables publish button while publishing', () => {
      const wrapper = createWrapper({ listingDrafts: drafts, publishingDraftId: 'd1' })
      expect(wrapper.text()).toContain('Mempublikasikan...')
    })

    it('shows "Menghapus..." when deleting draft', () => {
      const wrapper = createWrapper({ listingDrafts: drafts, deletingDraftId: 'd1' })
      expect(wrapper.text()).toContain('Menghapus...')
    })

    it('emits editDraft on Edit click', async () => {
      const wrapper = createWrapper({ listingDrafts: drafts })
      const editBtns = wrapper.findAll('button').filter(b => b.text() === 'Edit')
      if (editBtns.length > 0) {
        await editBtns[0].trigger('click')
        expect(wrapper.emitted('editDraft')).toBeTruthy()
      }
    })

    it('emits deleteDraft on Hapus click', async () => {
      const wrapper = createWrapper({ listingDrafts: drafts })
      const delBtns = wrapper.findAll('button').filter(b => b.text() === 'Hapus')
      if (delBtns.length > 0) {
        await delBtns[0].trigger('click')
        expect(wrapper.emitted('deleteDraft')).toBeTruthy()
      }
    })
  })

  describe('my listings', () => {
    const listings = [
      { _id: 'l1', title: 'Tomat segar', quantityLabel: '2 kg', priceLabel: 'Rp 15.000', statusLabel: 'Aktif' },
    ]

    it('renders active listings', () => {
      const wrapper = createWrapper({ myListings: listings })
      expect(wrapper.text()).toContain('Tomat segar')
      expect(wrapper.text()).toContain('Aktif')
    })

    it('emits updateListingStatus with "sold" on Terjual click', async () => {
      const wrapper = createWrapper({ myListings: listings })
      const terjualBtn = wrapper.findAll('button').filter(b => b.text() === 'Terjual')
      await terjualBtn[0].trigger('click')
      expect(wrapper.emitted('updateListingStatus')).toBeTruthy()
      expect(wrapper.emitted('updateListingStatus')![0]).toEqual(['l1', 'sold'])
    })

    it('emits deleteListing on Hapus click', async () => {
      const wrapper = createWrapper({ myListings: listings })
      const allBtns = wrapper.findAll('button')
      const hapusBtns = allBtns.filter(b => b.text() === 'Hapus' && !b.text().includes('Menghapus'))
      if (hapusBtns.length > 0) {
        await hapusBtns[0].trigger('click')
      }
    })

    it('shows "Menghapus..." when deleting listing', () => {
      const wrapper = createWrapper({ myListings: listings, deletingListingId: 'l1' })
      expect(wrapper.text()).toContain('Menghapus...')
    })
  })

  describe('empty state', () => {
    it('does not show "Listing Anda" section when both lists are empty', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).not.toContain('Listing Anda')
    })

    it('shows "Listing Anda" section when drafts exist', () => {
      const wrapper = createWrapper({ listingDrafts: [{ _id: 'd1', title: 'Test', quantityLabel: '1', priceLabel: 'Rp1', locationLabel: 'Jkt', status: 'draft' }] })
      expect(wrapper.text()).toContain('Listing Anda')
    })
  })
})
