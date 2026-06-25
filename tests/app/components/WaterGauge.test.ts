// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WaterGauge from '../../../app/components/WaterGauge.vue'

describe('WaterGauge', () => {
  it('renders label, percentage and capacity text', () => {
    const wrapper = mount(WaterGauge, {
      props: { level: 75, label: 'Kelembapan', capacity: 10 },
    })
    expect(wrapper.text()).toContain('Kelembapan')
    expect(wrapper.text()).toContain('75%')
    expect(wrapper.text()).toContain('Kapasitas 10L')
  })

  it('shows low level warning when level <= minLevel', () => {
    const wrapper = mount(WaterGauge, {
      props: { level: 15, label: 'Air', capacity: 5, minLevel: 20 },
    })
    expect(wrapper.text()).toContain('Level rendah')
  })

  it('hides low level warning when level > minLevel', () => {
    const wrapper = mount(WaterGauge, {
      props: { level: 60, label: 'Air', capacity: 5, minLevel: 20 },
    })
    expect(wrapper.text()).not.toContain('Level rendah')
  })

  it('hides low level warning when minLevel is undefined', () => {
    const wrapper = mount(WaterGauge, {
      props: { level: 5, label: 'Air', capacity: 5 },
    })
    expect(wrapper.text()).not.toContain('Level rendah')
  })

  it('uses emerald styling when minLevel is defined', () => {
    const wrapper = mount(WaterGauge, {
      props: { level: 50, label: 'Air', capacity: 5, minLevel: 20 },
    })
    const label = wrapper.find('p.text-xs')
    expect(label.classes()).toContain('text-emerald-700')
  })

  it('uses blue styling when minLevel is undefined', () => {
    const wrapper = mount(WaterGauge, {
      props: { level: 50, label: 'Air', capacity: 5 },
    })
    const label = wrapper.find('p.text-xs')
    expect(label.classes()).toContain('text-[#006493]')
  })

  it('renders water fill with correct height percentage', () => {
    const wrapper = mount(WaterGauge, {
      props: { level: 42, label: 'Test', capacity: 10 },
    })
    const bar = wrapper.find('.absolute.bottom-0')
    expect(bar.attributes('style')).toContain('height: 42%')
  })
})
