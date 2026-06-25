// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DevicesPanel from '../../../app/components/DevicesPanel.vue'

const baseDevice = {
  deviceId: 'GM-001',
  name: 'Pod #1',
  isOnline: true,
  version: 'v1',
  streamUrl: null,
  plant: { name: 'Monstera', species: 'Monstera deliciosa' },
  archivedPlants: [],
}

describe('DevicesPanel', () => {
  function createWrapper(overrides: Record<string, unknown> = {}) {
    return mount(DevicesPanel, {
      props: {
        devices: [baseDevice],
        currentDeviceId: 'GM-001',
        removingDeviceId: null,
        ...overrides,
      },
    })
  }

  describe('header', () => {
    it('renders title and description', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Pod GrowMate Anda')
      expect(wrapper.text()).toContain('Hubungkan perangkat lain')
    })

    it('emits connectDevice on button click', async () => {
      const wrapper = createWrapper()
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('connectDevice')).toBeTruthy()
    })
  })

  describe('device card', () => {
    it('renders device name and ID', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Pod #1')
      expect(wrapper.text()).toContain('GM-001')
    })

    it('shows active badge for current device', () => {
      const wrapper = createWrapper()
      const badges = wrapper.findAll('span.rounded-full')
      const activeBadge = badges.filter(b => b.text() === 'Aktif')
      expect(activeBadge.length).toBeGreaterThanOrEqual(1)
    })

    it('shows standby badge for non-current device', () => {
      const wrapper = createWrapper({ currentDeviceId: 'other' })
      expect(wrapper.text()).toContain('Siaga')
    })

    it('shows online status', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Terhubung')
    })

    it('shows offline status', () => {
      const wrapper = createWrapper({ devices: [{ ...baseDevice, isOnline: false }] })
      expect(wrapper.text()).toContain('Tidak terhubung')
    })

    it('shows version badge', () => {
      const wrapper = createWrapper({ devices: [{ ...baseDevice, version: 'v2' }] })
      expect(wrapper.text()).toContain('V2')
    })

    it('shows stream status for v2 devices', () => {
      const wrapper = createWrapper({ devices: [{ ...baseDevice, version: 'v2', streamUrl: 'ws://stream' }] })
      expect(wrapper.text()).toContain('Stream aktif')
    })

    it('shows stream unavailable for v2 without streamUrl', () => {
      const wrapper = createWrapper({ devices: [{ ...baseDevice, version: 'v2', streamUrl: null }] })
      expect(wrapper.text()).toContain('Stream tidak tersedia')
    })

    it('does not show stream status for v1', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).not.toContain('Stream')
    })

    it('shows current plant info', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Monstera')
      expect(wrapper.text()).toContain('Monstera deliciosa')
    })

    it('shows no-plant message when plant is null', () => {
      const wrapper = createWrapper({ devices: [{ ...baseDevice, plant: null }] })
      expect(wrapper.text()).toContain('menunggu profil tanaman')
    })
  })

  describe('archived plants', () => {
    it('renders archived plants', () => {
      const archivedPlants = [
        { _id: 'p1', name: 'Lavender', archivedAtLabel: '2 bulan lalu' },
      ]
      const wrapper = createWrapper({ devices: [{ ...baseDevice, archivedPlants }] })
      expect(wrapper.text()).toContain('Lavender')
      expect(wrapper.text()).toContain('2 bulan lalu')
    })

    it('does not show archived section when empty', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).not.toContain('Arsip terbaru')
    })
  })

  describe('action buttons', () => {
    it('shows "Jadikan aktif" button', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Jadikan aktif')
    })

    it('emits selectDevice on "Jadikan aktif" click', async () => {
      const wrapper = createWrapper()
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Jadikan aktif')
      if (btn.length > 0) {
        await btn[0].trigger('click')
        expect(wrapper.emitted('selectDevice')).toBeTruthy()
      }
    })

    it('shows "Ganti tanaman" when device has a plant', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Ganti tanaman')
    })

    it('shows "Pilih tanaman" when device has no plant', () => {
      const wrapper = createWrapper({ devices: [{ ...baseDevice, plant: null }] })
      expect(wrapper.text()).toContain('Pilih tanaman')
    })

    it('emits selectPlant on plant button click', async () => {
      const wrapper = createWrapper()
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Ganti tanaman')
      if (btn.length > 0) {
        await btn[0].trigger('click')
        expect(wrapper.emitted('selectPlant')).toBeTruthy()
      }
    })

    it('shows "Hapus" button', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Hapus')
    })

    it('shows "Menghapus..." when removing', () => {
      const wrapper = createWrapper({ removingDeviceId: 'GM-001' })
      expect(wrapper.text()).toContain('Menghapus...')
    })

    it('emits removeDevice on delete click', async () => {
      const wrapper = createWrapper()
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Hapus')
      if (btn.length > 0) {
        await btn[0].trigger('click')
        expect(wrapper.emitted('removeDevice')).toBeTruthy()
      }
    })
  })

  describe('multiple devices', () => {
    it('renders multiple device cards', () => {
      const devices = [
        baseDevice,
        { ...baseDevice, deviceId: 'GM-002', name: 'Pod #2' },
      ]
      const wrapper = createWrapper({ devices })
      expect(wrapper.text()).toContain('Pod #1')
      expect(wrapper.text()).toContain('Pod #2')
    })
  })
})
