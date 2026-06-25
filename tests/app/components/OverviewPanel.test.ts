// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import OverviewPanel from '../../../app/components/OverviewPanel.vue'

const baseProps = {
  plant: { name: 'Monstera', species: 'Monstera deliciosa', health: 'good' },
  device: { name: 'Pod #1', deviceId: 'GM-001', isOnline: true },
  reservoirDays: 5,
  alerts: [],
  waterSensor: { value: 75 },
  displayPlantImage: null,
  displaySensors: [],
  iconMap: {},
  accentMap: {},
}

describe('OverviewPanel', () => {
  function createWrapper(overrides = {}) {
    return mount(OverviewPanel, {
      props: { ...baseProps, ...overrides },
      global: {
        stubs: {
          MetricLineChart: true,
          WaterGauge: true,
        },
      },
    })
  }

  describe('plant hero', () => {
    it('renders plant name and species', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Monstera')
      expect(wrapper.text()).toContain('Monstera deliciosa')
    })

    it('renders health badge with formatted label', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('baik')
    })

    it('maps health values correctly', () => {
      const labels: Record<string, string> = {
        excellent: 'sangat baik',
        good: 'baik',
        fair: 'perlu perhatian',
        poor: 'kurang stabil',
      }
      for (const [health, expected] of Object.entries(labels)) {
        const wrapper = createWrapper({ plant: { ...baseProps.plant, health } })
        expect(wrapper.text()).toContain(expected)
      }
    })

    it('renders plant image when displayPlantImage is set', () => {
      const wrapper = createWrapper({ displayPlantImage: '/plants/monstera.jpg' })
      const img = wrapper.find('img')
      expect(img.exists()).toBe(true)
      expect(img.attributes('src')).toBe('/plants/monstera.jpg')
    })

    it('does not render img when displayPlantImage is null', () => {
      const wrapper = createWrapper()
      expect(wrapper.find('img').exists()).toBe(false)
    })

    it('renders placeholder when plant is null', () => {
      const wrapper = createWrapper({ plant: null })
      expect(wrapper.text()).toContain('')
    })
  })

  describe('sensors', () => {
    it('renders sensor cards', () => {
      const displaySensors = [
        { _id: 's1', kind: 'moisture', value: 60, unit: '%', label: 'Kelembapan', status: 'baik', target: '40-70%', accent: 'green', history: [{ value: 60, measuredAt: 1000 }] },
        { _id: 's2', kind: 'temperature', value: 28, unit: '°C', label: 'Suhu', status: 'tinggi', target: '20-26°C', accent: 'red', history: [] },
      ]
      const wrapper = createWrapper({ displaySensors, iconMap: { moisture: 'water_drop', temperature: 'device_thermostat' }, accentMap: { green: 'bg-green-100 text-green-700', red: 'bg-red-100 text-red-700' } })
      expect(wrapper.text()).toContain('60')
      expect(wrapper.text()).toContain('%')
      expect(wrapper.text()).toContain('Kelembapan')
      expect(wrapper.text()).toContain('28')
      expect(wrapper.text()).toContain('°C')
      expect(wrapper.text()).toContain('Suhu')
    })

    it('renders MetricLineChart for each sensor', () => {
      const displaySensors = [
        { _id: 's1', kind: 'moisture', value: 60, unit: '%', label: 'Kelembapan', status: 'baik', target: '40-70%', accent: 'green', history: [{ value: 60, measuredAt: 1000 }] },
      ]
      const wrapper = createWrapper({ displaySensors })
      expect(wrapper.findComponent({ name: 'MetricLineChart' }).exists()).toBe(true)
    })
  })

  describe('quick actions', () => {
    it('shows water button for v1 devices', () => {
      const wrapper = createWrapper({ isV2: false })
      expect(wrapper.text()).toContain('Siram sekarang')
    })

    it('shows combined water+fertilize button for v2', () => {
      const wrapper = createWrapper({ isV2: true })
      expect(wrapper.text()).toContain('Siram + Pupuk')
    })

    it('shows light buttons for v1', () => {
      const wrapper = createWrapper({ isV2: false })
      expect(wrapper.text()).toContain('Nyalakan lampu')
      expect(wrapper.text()).toContain('Matikan lampu')
    })

    it('hides light buttons for v2', () => {
      const wrapper = createWrapper({ isV2: true })
      expect(wrapper.text()).not.toContain('Nyalakan lampu')
      expect(wrapper.text()).not.toContain('Matikan lampu')
    })

    it('shows fertilize and pesticide buttons for v2', () => {
      const wrapper = createWrapper({ isV2: true })
      expect(wrapper.text()).toContain('Beri pupuk')
      expect(wrapper.text()).toContain('Pestisida')
    })

    it('hides fertilize and pesticide for v1', () => {
      const wrapper = createWrapper({ isV2: false })
      expect(wrapper.text()).not.toContain('Beri pupuk')
      expect(wrapper.text()).not.toContain('Pestisida')
    })

    it('emits water event on water button click', async () => {
      const wrapper = createWrapper()
      const btn = wrapper.findAll('button').filter(b => b.text().includes('Siram sekarang'))
      expect(btn.length).toBeGreaterThanOrEqual(1)
      await btn[0].trigger('click')
      expect(wrapper.emitted('water')).toBeTruthy()
    })
  })

  describe('water gauge / reservoir', () => {
    it('renders WaterGauge for v2', () => {
      const wrapper = createWrapper({ isV2: true, waterSensor: { value: 60 } })
      expect(wrapper.findComponent({ name: 'WaterGauge' }).exists()).toBe(true)
    })

    it('renders reservoir card for v1', () => {
      const wrapper = createWrapper({ isV2: false, waterSensor: { value: 80 }, reservoirDays: 7 })
      expect(wrapper.text()).toContain('80%')
      expect(wrapper.text()).toContain('7 hari')
    })

    it('shows correct reservoir percentage', () => {
      const wrapper = createWrapper({ isV2: false, waterSensor: { value: 45 } })
      expect(wrapper.text()).toContain('45%')
    })
  })

  describe('device info', () => {
    it('renders device name and ID', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Pod #1')
      expect(wrapper.text()).toContain('GM-001')
    })

    it('shows online status', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Terhubung')
    })

    it('shows offline status', () => {
      const wrapper = createWrapper({ device: { ...baseProps.device, isOnline: false } })
      expect(wrapper.text()).toContain('Tidak terhubung')
    })

    it('shows firmware version when provided', () => {
      const wrapper = createWrapper({ device: { ...baseProps.device, firmwareVersion: '2.1.0' } })
      expect(wrapper.text()).toContain('Firmware 2.1.0')
    })

    it('emits setPanel on manage device button click', async () => {
      const wrapper = createWrapper()
      const btn = wrapper.findAll('button').filter(b => b.text() === 'Kelola perangkat')
      expect(btn.length).toBeGreaterThanOrEqual(1)
      await btn[0].trigger('click')
      expect(wrapper.emitted('setPanel')).toBeTruthy()
    })
  })

  describe('alerts', () => {
    it('shows alert messages', () => {
      const alerts = [{ type: 'critical', message: 'Suhu terlalu tinggi' }]
      const wrapper = createWrapper({ alerts })
      expect(wrapper.text()).toContain('Suhu terlalu tinggi')
    })

    it('shows stable message when no alerts', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Semua dalam kondisi stabil saat ini')
    })

    it('shows at most 3 alerts', () => {
      const alerts = [
        { type: 'critical', message: 'A1' },
        { type: 'warning', message: 'A2' },
        { type: 'info', message: 'A3' },
        { type: 'critical', message: 'A4' },
      ]
      const wrapper = createWrapper({ alerts })
      expect(wrapper.text()).not.toContain('A4')
    })
  })

  describe('battery panel (v2)', () => {
    it('renders battery SoC', () => {
      const wrapper = createWrapper({ isV2: true, batterySoC: 85, batteryIcon: 'battery_full' })
      expect(wrapper.text()).toContain('85%')
    })

    it('renders charging state', () => {
      const wrapper = createWrapper({ isV2: true, batterySoC: 50, batteryCurrent: 120, batteryIcon: 'battery_charging', timeToFull: '2 jam lagi' })
      expect(wrapper.text()).toContain('+120mA')
      expect(wrapper.text()).toContain('2 jam lagi')
    })

    it('renders discharging state', () => {
      const wrapper = createWrapper({ isV2: true, batterySoC: 30, batteryCurrent: -50, batteryIcon: 'battery_low', timeToEmpty: '5 jam lagi' })
      expect(wrapper.text()).toContain('-50mA')
      expect(wrapper.text()).toContain('5 jam lagi')
    })

    it('shows modem indicator', () => {
      const wrapper = createWrapper({ isV2: true, hasModem: true })
      expect(wrapper.text()).toContain('Modem terpasang')
    })

    it('shows solar panel indicator with wattage', () => {
      const wrapper = createWrapper({ isV2: true, hasSolarPanel: true, solarPanelWatts: 50 })
      expect(wrapper.text()).toContain('Panel surya 50W')
    })

    it('does not show battery panel for v1', () => {
      const wrapper = createWrapper({ isV2: false, batterySoC: 85, batteryIcon: 'battery_full' })
      expect(wrapper.text()).not.toContain('battery_full')
      expect(wrapper.text()).not.toContain('Baterai')
    })
  })

  describe('switches panel (v2)', () => {
    it('shows tank switch open state', () => {
      const wrapper = createWrapper({ isV2: true, tankSwitchOpen: true })
      expect(wrapper.text()).toContain('Tutup tangki terbuka')
    })

    it('shows tank switch closed state', () => {
      const wrapper = createWrapper({ isV2: true, tankSwitchOpen: false })
      expect(wrapper.text()).toContain('Tutup tangki tertutup')
    })

    it('shows drawer switch open state', () => {
      const wrapper = createWrapper({ isV2: true, drawerSwitchOpen: true })
      expect(wrapper.text()).toContain('Laci terbuka')
    })

    it('shows drawer switch closed state', () => {
      const wrapper = createWrapper({ isV2: true, drawerSwitchOpen: false })
      expect(wrapper.text()).toContain('Laci tertutup')
    })

    it('does not show switches panel for v1', () => {
      const wrapper = createWrapper({ isV2: false })
      expect(wrapper.text()).not.toContain('Sakelar')
    })
  })
})
