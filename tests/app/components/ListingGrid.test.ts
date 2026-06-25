// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ListingGrid from '../../../app/components/ListingGrid.vue'

vi.mock('@/lib/images', () => ({
  getImageUrl: (url: string | null, size: number) => url ? `${url}?w=${size}` : null,
}))

const defaultProps = {
  featured: null,
  filteredOfficial: [],
  filteredCommunity: [],
  searchQuery: '',
  selectedCategory: 'all',
  hasWorkingImage: (_id: string, _url?: string | null) => true,
}

function communityItem(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'c1',
    title: 'Cabai rawit',
    description: 'Segar dari kebun',
    priceLabel: 'Rp 5.000',
    statusLabel: 'Aktif',
    quantityAvailable: 10,
    sellerName: 'Pak Tani',
    locationLabel: 'Jakarta',
    contactThreadId: null,
    status: 'active',
    imageUrl: '/cabai.jpg',
    ...overrides,
  }
}

describe('ListingGrid', () => {
  function createWrapper(overrides: Record<string, unknown> = {}) {
    return mount(ListingGrid, {
      props: { ...defaultProps, ...overrides },
    })
  }

  describe('header', () => {
    it('renders title and description', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Marketplace')
      expect(wrapper.text()).toContain('Produk resmi GrowMate')
    })
  })

  describe('featured product', () => {
    it('renders featured card when provided', () => {
      const featured = { _id: 'f1', title: 'GrowMate Pro', description: 'Best device', priceLabel: 'Rp 500K', shopeeUrl: 'https://shopee.com/growmate' }
      const wrapper = createWrapper({ featured })
      expect(wrapper.text()).toContain('GrowMate Pro')
      expect(wrapper.text()).toContain('Shopee')
      expect(wrapper.text()).toContain('Beli via Shopee')
    })

    it('does not render featured card when null', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).not.toContain('Beli via Shopee')
    })

    it('shows placeholder when featured image fails', () => {
      const featured = { _id: 'f1', title: 'GrowMate Pro', description: 'Best', priceLabel: 'Rp 500K' }
      const wrapper = createWrapper({ featured, hasWorkingImage: () => false })
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('emits openExternal on featured buy button click', async () => {
      const featured = { _id: 'f1', title: 'Pro', description: 'Best', priceLabel: 'Rp 500K', shopeeUrl: 'https://shopee.com/growmate' }
      const wrapper = createWrapper({ featured })
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Beli via Shopee')
      await btn[0].trigger('click')
      expect(wrapper.emitted('openExternal')).toBeTruthy()
    })
  })

  describe('category filter tabs', () => {
    it('shows all three category buttons', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Semua')
      expect(wrapper.text()).toContain('Resmi')
      expect(wrapper.text()).toContain('Komunitas')
    })

    it('highlights selected category', () => {
      const wrapper = createWrapper({ selectedCategory: 'official' })
      const allBtns = wrapper.findAll('button')
      const officialBtn = allBtns.filter(b => b.text() === 'Resmi')
      expect(officialBtn[0].classes()).toContain('bg-gm-primary')
    })

    it('emits update:selectedCategory on tab click', async () => {
      const wrapper = createWrapper()
      const komunitasBtn = wrapper.findAll('button').filter(b => b.text() === 'Komunitas')
      await komunitasBtn[0].trigger('click')
      expect(wrapper.emitted('update:selectedCategory')).toBeTruthy()
      expect(wrapper.emitted('update:selectedCategory')![0]).toEqual(['community'])
    })
  })

  describe('search input', () => {
    it('renders search input', () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input[placeholder="Cari listing, penjual, atau kategori..."]')
      expect(input.exists()).toBe(true)
    })

    it('emits update:searchQuery on input', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input[placeholder="Cari listing, penjual, atau kategori..."]')
      await input.setValue('tomat')
      expect(wrapper.emitted('update:searchQuery')).toBeTruthy()
    })
  })

  describe('official products', () => {
    it('renders official products section', () => {
      const items = [{ _id: 'o1', title: 'Official Product', description: 'Desc', priceLabel: 'Rp 100K', shopeeUrl: 'https://shopee.com' }]
      const wrapper = createWrapper({ filteredOfficial: items })
      expect(wrapper.text()).toContain('Produk Resmi GrowMate')
      expect(wrapper.text()).toContain('Official Product')
    })

    it('shows placeholder when official product image fails', () => {
      const items = [{ _id: 'o1', title: 'OP', description: 'D', priceLabel: 'Rp 100K' }]
      const wrapper = createWrapper({ filteredOfficial: items, hasWorkingImage: () => false })
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('does not render official section when empty', () => {
      const wrapper = createWrapper({ selectedCategory: 'community' })
      expect(wrapper.text()).not.toContain('Produk Resmi GrowMate')
    })
  })

  describe('community products', () => {
    it('renders community products', () => {
      const wrapper = createWrapper({ filteredCommunity: [communityItem()] })
      expect(wrapper.text()).toContain('Penawaran Komunitas')
      expect(wrapper.text()).toContain('Cabai rawit')
      expect(wrapper.text()).toContain('Pak Tani')
      expect(wrapper.text()).toContain('10 tersedia')
    })

    it('shows "Hubungi Penjual" when contactThreadId is null', () => {
      const wrapper = createWrapper({ filteredCommunity: [communityItem()] })
      expect(wrapper.text()).toContain('Hubungi Penjual')
    })

    it('shows "Buka Percakapan" when contactThreadId is set', () => {
      const wrapper = createWrapper({ filteredCommunity: [communityItem({ contactThreadId: 't1' })] })
      expect(wrapper.text()).toContain('Buka Percakapan')
    })

    it('disables inquiry button when status is not active', () => {
      const wrapper = createWrapper({ filteredCommunity: [communityItem({ status: 'sold' })] })
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Hubungi Penjual' || b.text() === 'Buka Percakapan')
      expect(btn[0].attributes('disabled')).toBeDefined()
    })

    it('emits openInquiry on community buy button click', async () => {
      const wrapper = createWrapper({ filteredCommunity: [communityItem()] })
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Hubungi Penjual')
      await btn[0].trigger('click')
      expect(wrapper.emitted('openInquiry')).toBeTruthy()
    })

    it('shows location label when provided', () => {
      const wrapper = createWrapper({ filteredCommunity: [communityItem({ locationLabel: 'Bandung' })] })
      expect(wrapper.text()).toContain('Bandung')
    })

    it('shows placeholder when community image fails', () => {
      const wrapper = createWrapper({ filteredCommunity: [communityItem()], hasWorkingImage: () => false })
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('shows empty state when no community items', () => {
      const wrapper = createWrapper({ filteredCommunity: [] })
      expect(wrapper.text()).toContain('Tidak ada listing komunitas')
    })
  })

  describe('image error handling', () => {
    it('emits handleImageError on img error', async () => {
      const featured = { _id: 'f1', title: 'Pro', description: 'Best', priceLabel: 'Rp 500K', imageUrl: '/img.jpg' }
      const wrapper = createWrapper({ featured })
      const img = wrapper.find('img')
      if (img.exists()) {
        await img.trigger('error')
        expect(wrapper.emitted('handleImageError')).toBeTruthy()
      }
    })
  })
})
