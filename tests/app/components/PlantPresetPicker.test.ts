// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import PlantPresetPicker from '../../../app/components/PlantPresetPicker.vue'
import type { PlantPreset } from '../../../app/lib/plants'

function preset(overrides: Partial<PlantPreset> = {}): PlantPreset {
  return {
    key: 'basil',
    name: 'Basil',
    species: 'Ocimum basilicum',
    growthStage: 'seed_dormancy',
    imageUrl: null,
    description: 'Herb',
    location: 'Indoor',
    category: 'herb',
    difficulty: 'easy',
    wateringThreshold: 34,
    lightingThreshold: 30,
    lifecycleProfile: {
      seedDormancyDays: 1,
      germinationDays: 2,
      seedlingDevelopmentDays: 3,
      vegetativeGrowthDays: 4,
      floweringReproductionDays: 5,
      maturitySenescenceDays: 6,
    },
    ...overrides,
  }
}

const gridStub = {
  props: ['presets', 'filteredPresets', 'selectedPresetKey', 'categoryFilter', 'librarySearch'],
  emits: ['update:selectedPresetKey', 'update:categoryFilter', 'update:librarySearch'],
  template: '<div />',
}

describe('PlantPresetPicker', () => {
  it('emits select with the resolved preset once the library loads', async () => {
    const wrapper = mount(PlantPresetPicker, {
      props: { presets: [] },
      global: { stubs: { PlantCatalogGrid: gridStub } },
    })
    expect(wrapper.emitted('select')).toBeFalsy()

    await wrapper.setProps({ presets: [preset()] })
    await nextTick()

    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0][0]).toMatchObject({ key: 'basil', name: 'Basil' })
  })

  it('forwards search state to the catalog grid', async () => {
    const wrapper = mount(PlantPresetPicker, {
      props: { presets: [preset()] },
      global: { stubs: { PlantCatalogGrid: gridStub } },
    })
    await nextTick()

    const grid = wrapper.findComponent(gridStub)
    expect(grid.exists()).toBe(true)
    expect(grid.props('presets')).toHaveLength(1)
    expect(grid.props('filteredPresets')).toHaveLength(1)
  })
})
