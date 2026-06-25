// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MetricLineChart from '../../../app/components/MetricLineChart.vue'

describe('MetricLineChart', () => {
  const basePoint = { value: 50, measuredAt: 1000 }
  const twoPoints = [
    { value: 10, measuredAt: 0 },
    { value: 90, measuredAt: 1000 },
  ]

  it('renders an SVG with correct viewBox', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: twoPoints },
    })
    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 240 84')
  })

  it('renders no paths when points array is empty', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: [] },
    })
    expect(wrapper.find('path').exists()).toBe(false)
  })

  it('renders a line path with a single point', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: [basePoint] },
    })
    const line = wrapper.find('path[fill="none"]')
    expect(line.exists()).toBe(true)
    expect(line.attributes('d')).toMatch(/^M \d/)
  })

  it('renders a line path for multiple points', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: twoPoints },
    })
    const line = wrapper.find('path[fill="none"]')
    expect(line.exists()).toBe(true)
    expect(line.attributes('d')).toContain('L ')
  })

  it('renders an area fill path', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: twoPoints },
    })
    const paths = wrapper.findAll('path')
    const fill = paths.filter(p => p.attributes('d')?.match(/ Z$/))
    expect(fill.length).toBeGreaterThanOrEqual(1)
  })

  it('applies custom stroke color', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: twoPoints, stroke: '#ff0000' },
    })
    const line = wrapper.find('path[fill="none"]')
    expect(line.attributes('stroke')).toBe('#ff0000')
  })

  it('applies custom fill color', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: twoPoints, fill: 'red' },
    })
    const fill = wrapper.find('path[fill="red"]')
    expect(fill.exists()).toBe(true)
  })

  it('handles all same values (zero range)', () => {
    const points = [
      { value: 50, measuredAt: 0 },
      { value: 50, measuredAt: 1000 },
      { value: 50, measuredAt: 2000 },
    ]
    const wrapper = mount(MetricLineChart, {
      props: { points },
    })
    const line = wrapper.find('path[fill="none"]')
    expect(line.exists()).toBe(true)
    expect(line.attributes('d')).toMatch(/^M /)
  })

  it('renders area path correctly for two points', () => {
    const wrapper = mount(MetricLineChart, {
      props: { points: twoPoints, width: 100, height: 50 },
    })
    const areaPath = wrapper.findAll('path').filter(p =>
      !p.attributes('fill')?.includes('none') && p.attributes('d')?.includes(' Z')
    )
    expect(areaPath.length).toBeGreaterThanOrEqual(1)
  })
})
