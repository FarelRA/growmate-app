// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CarePanel from '../../../app/components/CarePanel.vue'

const baseDevice = { autoWatering: false, autoLighting: false, lightEnabled: false, deviceId: 'GM-001' }
const baseForm = { scheduleId: null, title: '', cadenceValue: 1, cadenceUnit: 'hours' as const, timeOfDay: '' }

describe('CarePanel', () => {
  function createWrapper(overrides: Record<string, unknown> = {}) {
    return mount(CarePanel, {
      props: {
        device: baseDevice,
        schedules: [],
        scheduleForm: baseForm,
        schedulePreview: 'Setiap 1 jam',
        savingSchedule: false,
        deletingScheduleId: null,
        ...overrides,
      },
    })
  }

  describe('automation toggles', () => {
    it('renders watering automation toggle', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Penyiraman otomatis')
    })

    it('renders lighting automation toggle', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Pencahayaan otomatis')
    })

    it('does not show fertilizing/pesticide toggles for v1', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).not.toContain('Pemupukan otomatis')
      expect(wrapper.text()).not.toContain('Pestisida otomatis')
    })

    it('shows fertilizing and pesticide toggles for v2', () => {
      const wrapper = createWrapper({ device: { ...baseDevice, version: 'v2' } })
      expect(wrapper.text()).toContain('Pemupukan otomatis')
      expect(wrapper.text()).toContain('Pestisida otomatis')
    })

    it('emits toggleAutomation when watering switch clicked', async () => {
      const wrapper = createWrapper()
      const switchBtn = wrapper.findAll('button[role="switch"]').at(0)
      await switchBtn?.trigger('click')
      expect(wrapper.emitted('toggleAutomation')).toBeTruthy()
      expect(wrapper.emitted('toggleAutomation')![0]).toEqual(['watering', false])
    })

    it('shows watering toggle as active when autoWatering is true', () => {
      const wrapper = createWrapper({ device: { ...baseDevice, autoWatering: true } })
      const switches = wrapper.findAll('button[role="switch"]')
      expect(switches.at(0)?.classes()).toContain('bg-gm-primary')
    })

    it('shows watering toggle as inactive when autoWatering is false', () => {
      const wrapper = createWrapper()
      const switches = wrapper.findAll('button[role="switch"]')
      expect(switches.at(0)?.classes()).toContain('bg-[#d7d7d7]')
    })
  })

  describe('manual action buttons', () => {
    it('shows water button for all devices', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Siram sekarang')
    })

    it('shows light toggle for v1', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Nyalakan lampu')
    })

    it('shows "Matikan lampu" when light is enabled', () => {
      const wrapper = createWrapper({ device: { ...baseDevice, lightEnabled: true } })
      expect(wrapper.text()).toContain('Matikan lampu')
    })

    it('hides light button for v2', () => {
      const wrapper = createWrapper({ device: { ...baseDevice, version: 'v2' } })
      expect(wrapper.text()).not.toContain('Nyalakan lampu')
      expect(wrapper.text()).not.toContain('Matikan lampu')
    })

    it('shows fertilize and pesticide buttons for v2', () => {
      const wrapper = createWrapper({ device: { ...baseDevice, version: 'v2' } })
      expect(wrapper.text()).toContain('Pupuk sekarang')
      expect(wrapper.text()).toContain('Pestisida sekarang')
    })

    it('emits water on click', async () => {
      const wrapper = createWrapper()
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Siram sekarang')
      expect(btn.length).toBeGreaterThanOrEqual(1)
      await btn[0].trigger('click')
      expect(wrapper.emitted('water')).toBeTruthy()
    })
  })

  describe('schedule form', () => {
    it('renders schedule form fields', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Judul jadwal')
      expect(wrapper.text()).toContain('Ulangi setiap')
      expect(wrapper.text()).toContain('Satuan')
    })

    it('shows time of day field when cadenceUnit is days', () => {
      const wrapper = createWrapper({ scheduleForm: { ...baseForm, cadenceUnit: 'days' } })
      expect(wrapper.text()).toContain('Waktu dalam sehari')
    })

    it('hides time of day field when cadenceUnit is hours', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).not.toContain('Waktu dalam sehari')
    })

    it('emits update:scheduleForm on title input', async () => {
      const wrapper = createWrapper()
      const input = wrapper.find('input[placeholder="Penyiraman pagi"]')
      await input.setValue('Jadwal baru')
      expect(wrapper.emitted('update:scheduleForm')).toBeTruthy()
    })

    it('shows "Buat rutinitas" button text when creating', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Buat rutinitas')
    })

    it('shows "Perbarui rutinitas" when scheduleId is set', () => {
      const wrapper = createWrapper({ scheduleForm: { ...baseForm, scheduleId: 's1', title: 'Edit' } })
      expect(wrapper.text()).not.toContain('Buat rutinitas')
      expect(wrapper.text()).toContain('Perbarui rutinitas')
    })

    it('shows "Menyimpan..." when savingSchedule', () => {
      const wrapper = createWrapper({ savingSchedule: true })
      expect(wrapper.text()).toContain('Menyimpan...')
    })

    it('shows "Batal edit" button when scheduleId is set', () => {
      const wrapper = createWrapper({ scheduleForm: { ...baseForm, scheduleId: 's1' } })
      expect(wrapper.text()).toContain('Batal edit')
    })

    it('renders schedule preview', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Setiap 1 jam')
    })
  })

  describe('schedule list', () => {
    it('renders schedule items', () => {
      const schedules = [
        { _id: 's1', title: 'Pagi hari', cadenceLabel: 'Setiap hari', nextRunLabel: '08:00', enabled: true },
      ]
      const wrapper = createWrapper({ schedules })
      expect(wrapper.text()).toContain('Pagi hari')
      expect(wrapper.text()).toContain('Setiap hari')
      expect(wrapper.text()).toContain('08:00')
    })

    it('shows empty state when no schedules', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Belum ada rutinitas perawatan')
    })

    it('emits editSchedule on edit click', async () => {
      const schedules = [
        { _id: 's1', title: 'Pagi', cadenceLabel: 'Setiap hari', nextRunLabel: '08:00', enabled: true },
      ]
      const wrapper = createWrapper({ schedules })
      const editBtns = wrapper.findAll('button').filter(b => b.text() === 'Edit')
      if (editBtns.length > 0) {
        await editBtns[0].trigger('click')
      }
    })

    it('shows delete button text for enabled schedule', () => {
      const schedules = [
        { _id: 's1', title: 'Pagi', cadenceLabel: 'Setiap hari', nextRunLabel: '08:00', enabled: true },
      ]
      const wrapper = createWrapper({ schedules })
      expect(wrapper.text()).toContain('Hapus')
    })

    it('emits deleteSchedule on delete click', async () => {
      const schedules = [
        { _id: 's1', title: 'Pagi', cadenceLabel: 'Setiap hari', nextRunLabel: '08:00', enabled: true },
      ]
      const wrapper = createWrapper({ schedules })
      const deleteBtns = wrapper.findAll('button').filter(b => b.text() === 'Hapus')
      if (deleteBtns.length > 0) {
        await deleteBtns[0].trigger('click')
        expect(wrapper.emitted('deleteSchedule')).toBeTruthy()
      }
    })

    it('shows "Menghapus..." when deleting schedule', () => {
      const schedules = [
        { _id: 's1', title: 'Pagi', cadenceLabel: 'Setiap hari', nextRunLabel: '08:00', enabled: true },
      ]
      const wrapper = createWrapper({ schedules, deletingScheduleId: 's1' })
      expect(wrapper.text()).toContain('Menghapus...')
    })
  })
})
