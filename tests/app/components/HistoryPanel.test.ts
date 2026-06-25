// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HistoryPanel from '../../../app/components/HistoryPanel.vue'

vi.mock('@/lib/images', () => ({
  getImageUrl: vi.fn(() => '/mock-image.jpg'),
}))

function makeHistoryData(overrides = {}) {
  return {
    timeline: [],
    currentPlant: null,
    imageHistory: [],
    archivedPlants: [],
    recordings: undefined,
    ...overrides,
  }
}

const emptyMetricCards: {
  key: string
  label: string
  unit: string
  stroke: string
  fill: string
  points: { value: number; measuredAt: number }[]
  latest: number | undefined
}[] = []

const baseRecording = {
  _id: 'r1',
  fileName: '20260624_143000.h264',
  path: 'dev-1/stream/20260624_143000.h264',
  size: 2048,
  durationMs: 60000,
  capturedAt: Date.now(),
  capturedAtLabel: '24 Jun 14:30',
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('not mocked'))
})

function clickTab(wrapper: ReturnType<typeof mount>, label: string) {
  const buttons = wrapper.findAll('.flex.gap-1 button')
  return buttons.find((b) => b.text().trim() === label)
}

describe('HistoryPanel', () => {
  describe('tab rendering', () => {
    it('renders Rekaman tab for v2 device', () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData(),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const tabTexts = wrapper.findAll('.flex.gap-1 button').map((b) => b.text())
      expect(tabTexts).toContain('Rekaman')
    })

    it('hides Rekaman tab for v1 device', () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData(),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v1',
        },
      })
      const tabTexts = wrapper.findAll('.flex.gap-1 button').map((b) => b.text())
      expect(tabTexts).not.toContain('Rekaman')
    })

    it('renders all basic tabs for v2', () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData(),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const tabTexts = wrapper.findAll('.flex.gap-1 button').map((b) => b.text())
      expect(tabTexts).toContain('Metrik')
      expect(tabTexts).toContain('Log')
      expect(tabTexts).toContain('Timeline')
      expect(tabTexts).toContain('Gambar')
    })
  })

  describe('recordings tab content', () => {
    it('shows empty state when no recordings', async () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('Belum ada rekaman')
    })

    it('renders recording list', async () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [baseRecording] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('20260624_143000.h264')
    })

    it('displays recording metadata (duration, size)', async () => {
      const rec = { ...baseRecording, fileName: 'test.h264', size: 2048, durationMs: 60000, capturedAtLabel: '25 Jun 10:00' }
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [rec] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('test.h264')
      expect(wrapper.text()).toContain('25 Jun 10:00')
      expect(wrapper.text()).toContain('01:00')
      expect(wrapper.text()).toContain('2.0 KB')
    })

    it('shows Putar button for each recording', async () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [baseRecording] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('▶')
    })

    it('calls recordings API when Putar is clicked', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({
          recordings: [{ _id: 'r1', path: 'dev-1/stream/test.h264', fileName: 'test.h264', size: 100, durationMs: 30000, capturedAt: Date.now(), downloadUrl: 'https://s3.example.com/test.h264' }],
        }), { headers: { 'content-type': 'application/json' } }),
      )
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [baseRecording] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
        global: { stubs: { Teleport: false, PastRecordingViewer: true } },
      })
      const rekBtn = clickTab(wrapper, 'Rekaman')
      if (rekBtn) await rekBtn.trigger('click')

      await vi.dynamicImportSettled?.()
      const putarBtn = wrapper.findAll('button').find((b) => b.text().includes('▶'))
      if (putarBtn) await putarBtn.trigger('click')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/recordings/dev-1'),
      )
    })
  })

  describe('formatBytes', () => {
    it('renders bytes label', async () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [{ ...baseRecording, _id: 'r1', fileName: 't.h264', size: 500 }] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('500 B')
    })

    it('renders KB label', async () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [{ ...baseRecording, _id: 'r1', fileName: 't.h264', size: 2048 }] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('2.0 KB')
    })

    it('renders MB label', async () => {
      const wrapper = mount(HistoryPanel, {
        props: {
          historyData: makeHistoryData({ recordings: [{ ...baseRecording, _id: 'r1', fileName: 't.h264', size: 3 * 1024 * 1024 }] }),
          historyMetricCards: emptyMetricCards,
          deviceVersion: 'v2',
        },
      })
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('3.0 MB')
    })
  })
})
