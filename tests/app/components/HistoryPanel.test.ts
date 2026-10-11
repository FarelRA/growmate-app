// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref, nextTick } from 'vue'
import HistoryPanel from '../../../app/components/HistoryPanel.vue'

vi.mock('@/utils/images', () => ({
  getImageUrl: vi.fn(() => '/mock-image.jpg'),
}))

vi.mock('@/utils/auth', () => ({
  getAuthToken: vi.fn(async () => 'test-token'),
}))

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const { galleryMock } = vi.hoisted(() => ({
  galleryMock: {
    calls: [] as Array<{ fn: unknown; args: unknown }>,
    rows: [] as Array<Record<string, unknown>>,
  },
}))

// Mirrors the pattern in tests/app/composables/*: useConvexQuery resolves to a
// ref. Rows are read at call time so each test sets galleryMock.rows before
// mounting; the captured args ref lets tests assert the growing limit.
vi.mock('@convex-vue/core', () => ({
  useConvexQuery: (fn: unknown, args: unknown) => {
    galleryMock.calls.push({ fn, args })
    return { data: ref(galleryMock.rows) }
  },
}))

function makeHistoryData(overrides = {}) {
  return {
    timeline: [],
    currentPlant: null,
    imageHistory: [],
    archivedPlants: { page: [], isDone: true, continueCursor: '' },
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

function galleryRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    _id: `g${i + 1}`,
    imageUrl: `snap-${i + 1}.jpg`,
    source: 'camera',
    capturedAt: 1700000000000 + i * 1000,
    capturedAtLabel: `label-${i + 1}`,
  }))
}

function recRow(i: number, overrides: Record<string, unknown> = {}) {
  return {
    _id: `r${i}`,
    fileName: `20260624_14300${i}.h264`,
    path: `dev-1/stream/20260624_14300${i}.h264`,
    size: 2048,
    durationMs: 60000,
    capturedAt: Date.now(),
    capturedAtLabel: `24 Jun 14:3${i}`,
    downloadUrl: `https://signed.example/r${i}`,
    ...overrides,
  }
}

function recPayload(recs: unknown[]) {
  return new Response(JSON.stringify({ recordings: recs }), {
    headers: { 'content-type': 'application/json' },
  })
}

function mountPanel(opts: {
  deviceId?: string
  historyData?: ReturnType<typeof makeHistoryData>
  historyMetricCards?: typeof emptyMetricCards
  deviceVersion?: string
  galleryRows?: Array<Record<string, unknown>>
} = {}) {
  galleryMock.rows = opts.galleryRows ?? []
  galleryMock.calls.length = 0
  return mount(HistoryPanel, {
    props: {
      deviceId: opts.deviceId ?? 'dev-1',
      historyData: opts.historyData ?? makeHistoryData(),
      historyMetricCards: opts.historyMetricCards ?? emptyMetricCards,
      deviceVersion: opts.deviceVersion ?? 'v2',
    },
    global: {
      stubs: {
        Teleport: { template: '<div class="teleport-stub"><slot /></div>' },
        PastRecordingViewer: true,
        MetricLineChart: true,
      },
    },
  })
}

function galleryArgs() {
  expect(galleryMock.calls).toHaveLength(1)
  return (galleryMock.calls[0]!.args ?? {}) as { value: { deviceId?: string; limit: number } }
}

async function flush() {
  for (let i = 0; i < 3; i++) {
    await new Promise((r) => setTimeout(r, 0))
    await nextTick()
  }
}

function clickTab(wrapper: ReturnType<typeof mount>, label: string) {
  const buttons = wrapper.findAll('.flex.gap-1 button')
  return buttons.find((b) => b.text().trim() === label)
}

function findButton(wrapper: ReturnType<typeof mount>, text: string) {
  return wrapper.findAll('button').find((b) => b.text().includes(text))
}

beforeEach(() => {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error('not mocked'))
})

describe('HistoryPanel', () => {
  describe('tab rendering', () => {
    it('renders Rekaman tab for v2 device', () => {
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      const tabTexts = wrapper.findAll('.flex.gap-1 button').map((b) => b.text())
      expect(tabTexts).toContain('Rekaman')
    })

    it('hides Rekaman tab for v1 device', () => {
      const wrapper = mountPanel({ deviceVersion: 'v1' })
      const tabTexts = wrapper.findAll('.flex.gap-1 button').map((b) => b.text())
      expect(tabTexts).not.toContain('Rekaman')
    })

    it('renders all basic tabs for v2', () => {
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      const tabTexts = wrapper.findAll('.flex.gap-1 button').map((b) => b.text())
      expect(tabTexts).toContain('Metrik')
      expect(tabTexts).toContain('Log')
      expect(tabTexts).toContain('Timeline')
      expect(tabTexts).toContain('Gambar')
    })
  })

  describe('metrics tab', () => {
    it('renders metric cards with label and latest value', async () => {
      const wrapper = mountPanel({
        historyMetricCards: [
          {
            key: 'soil',
            label: 'Kelembaban Tanah',
            unit: '%',
            stroke: '#000',
            fill: '#fff',
            points: [{ value: 42, measuredAt: 1 }],
            latest: 42,
          },
        ],
      })
      expect(wrapper.text()).toContain('Kelembaban Tanah')
      expect(wrapper.text()).toContain('42')
    })
  })

  describe('timeline tab', () => {
    it('renders timeline events and the current plant', async () => {
      const wrapper = mountPanel({
        historyData: makeHistoryData({
          timeline: [
            {
              _id: 'e1',
              title: 'Penyiraman otomatis',
              detail: 'Pompa 8 detik',
              timestampLabel: '10:00',
              relativeTime: '2 jam lalu',
            },
          ],
          currentPlant: { name: 'Cabai', species: 'Capsicum annuum' },
        }),
      })
      const btn = clickTab(wrapper, 'Timeline')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('Penyiraman otomatis')
      expect(wrapper.text()).toContain('Cabai')
    })

    it('shows only the first 4 imageHistory previews', async () => {
      const wrapper = mountPanel({
        historyData: makeHistoryData({
          currentPlant: { name: 'Cabai', species: 'Capsicum annuum' },
          imageHistory: Array.from({ length: 6 }, (_, i) => ({
            _id: `img${i}`,
            imageUrl: `snap-${i}.jpg`,
            capturedAtLabel: `preview-${i}`,
          })),
        }),
      })
      const btn = clickTab(wrapper, 'Timeline')
      if (btn) await btn.trigger('click')
      // Timeline preview slice uses historyData.imageHistory (not the gallery query).
      expect(wrapper.findAll('img')).toHaveLength(4)
      expect(wrapper.text()).toContain('preview-0')
      expect(wrapper.text()).not.toContain('preview-5')
    })
  })

  describe('images tab (gallery query)', () => {
    it('shows empty state when the gallery query returns no rows', async () => {
      const wrapper = mountPanel({ galleryRows: [] })
      const btn = clickTab(wrapper, 'Gambar')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('Belum ada gambar yang tersedia.')
      expect(findButton(wrapper, 'Muat lagi')).toBeUndefined()
    })

    it('renders a grid from the mocked gallery query with capturedAtLabel', async () => {
      const wrapper = mountPanel({ galleryRows: galleryRows(3) })
      const btn = clickTab(wrapper, 'Gambar')
      if (btn) await btn.trigger('click')
      expect(wrapper.findAll('img')).toHaveLength(3)
      expect(wrapper.text()).toContain('label-1')
      expect(wrapper.text()).toContain('label-3')
    })

    it('ignores historyData.imageHistory for the gallery grid', async () => {
      const wrapper = mountPanel({
        galleryRows: galleryRows(2),
        historyData: makeHistoryData({
          imageHistory: [{ _id: 'legacy', imageUrl: 'legacy.jpg', capturedAtLabel: 'legacy-label' }],
        }),
      })
      const btn = clickTab(wrapper, 'Gambar')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('label-2')
      expect(wrapper.text()).not.toContain('legacy-label')
    })

    it('shows Muat lagi with 24 rows and grows convex args to limit 48', async () => {
      const wrapper = mountPanel({ galleryRows: galleryRows(24) })
      expect(galleryArgs().value).toMatchObject({ deviceId: 'dev-1', limit: 24 })
      const btn = clickTab(wrapper, 'Gambar')
      if (btn) await btn.trigger('click')
      const loadMore = findButton(wrapper, 'Muat lagi')
      expect(loadMore?.text()).toContain('24 ditampilkan')
      if (loadMore) await loadMore.trigger('click')
      expect(galleryArgs().value).toMatchObject({ deviceId: 'dev-1', limit: 48 })
    })

    it('hides Muat lagi when fewer rows than requested were returned', async () => {
      const wrapper = mountPanel({ galleryRows: galleryRows(5) })
      const btn = clickTab(wrapper, 'Gambar')
      if (btn) await btn.trigger('click')
      expect(wrapper.findAll('img')).toHaveLength(5)
      expect(findButton(wrapper, 'Muat lagi')).toBeUndefined()
    })
  })

  describe('recordings tab content', () => {
    it('fetches the list on mount with Bearer auth and ?limit=20', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload([]))
      mountPanel({ deviceVersion: 'v2' })
      await flush()
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2/recordings/dev-1'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      )
      const url = String(vi.mocked(fetch).mock.calls[0]?.[0])
      expect(url).toContain('limit=20')
    })

    it('shows empty state when no recordings', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload([]))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('Belum ada rekaman')
    })

    it('renders recording list from the fetch response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload([recRow(1)]))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('20260624_143001.h264')
    })

    it('displays recording metadata (duration, size)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        recPayload([{ ...recRow(1), fileName: 'test.h264', size: 2048, durationMs: 60000 }]),
      )
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('test.h264')
      expect(wrapper.text()).toContain('01:00')
      expect(wrapper.text()).toContain('2.0 KB')
    })

    it('shows Putar button for each recording', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload([recRow(1)]))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('▶')
    })

    it('Muat lagi refetches with limit=40', async () => {
      const rows = Array.from({ length: 20 }, (_, i) => recRow(i + 1))
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload(rows))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const rekBtn = clickTab(wrapper, 'Rekaman')
      if (rekBtn) await rekBtn.trigger('click')
      const loadMore = findButton(wrapper, 'Muat lagi')
      expect(loadMore?.text()).toContain('20 ditampilkan')
      if (loadMore) await loadMore.trigger('click')
      await flush()
      expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(2)
      const secondUrl = String(vi.mocked(fetch).mock.calls[1]?.[0])
      expect(secondUrl).toContain('limit=40')
    })

    it('switching deviceId resets the list and refetches', async () => {
      globalThis.fetch = vi.fn(async (url: unknown) => {
        if (String(url).includes('dev-2')) return recPayload([])
        return recPayload([recRow(1)])
      })
      const wrapper = mountPanel({ deviceId: 'dev-1', deviceVersion: 'v2' })
      await flush()
      const rekBtn = clickTab(wrapper, 'Rekaman')
      if (rekBtn) await rekBtn.trigger('click')
      expect(wrapper.text()).toContain('20260624_143001.h264')

      await wrapper.setProps({ deviceId: 'dev-2' })
      await flush()
      const urls = vi.mocked(fetch).mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('/api/v2/recordings/dev-2') && u.includes('limit=20'))).toBe(
        true,
      )
      expect(wrapper.text()).toContain('Belum ada rekaman')
      expect(wrapper.text()).not.toContain('20260624_143001.h264')
    })

    it('Putar on an item WITH downloadUrl does NOT fetch again', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload([recRow(1)]))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      expect(fetch).toHaveBeenCalledTimes(1)
      const rekBtn = clickTab(wrapper, 'Rekaman')
      if (rekBtn) await rekBtn.trigger('click')
      const putarBtn = wrapper.findAll('button').find((b) => b.text().includes('▶'))
      if (putarBtn) await putarBtn.trigger('click')
      await flush()
      // Direct playback from the item's signed downloadUrl: no second fetch.
      expect(fetch).toHaveBeenCalledTimes(1)
      expect(wrapper.find('past-recording-viewer-stub').exists()).toBe(true)
    })

    it('Putar without downloadUrl falls back to refetch-then-find with Bearer', async () => {
      const { downloadUrl: _dropped, ...noUrl } = recRow(1)
      globalThis.fetch = vi.fn(async (url: unknown) => {
        if (String(url).includes('limit=')) return recPayload([noUrl])
        return recPayload([recRow(1)])
      })
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const rekBtn = clickTab(wrapper, 'Rekaman')
      if (rekBtn) await rekBtn.trigger('click')
      const putarBtn = wrapper.findAll('button').find((b) => b.text().includes('▶'))
      if (putarBtn) await putarBtn.trigger('click')
      await flush()
      expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThanOrEqual(2)
      expect(fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/api/v2/recordings/dev-1'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
        }),
      )
      expect(wrapper.find('past-recording-viewer-stub').exists()).toBe(true)
    })
  })

  describe('formatBytes', () => {
    it('renders bytes label', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload([{ ...recRow(1), size: 500 }]))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('500 B')
    })

    it('renders KB label', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(recPayload([{ ...recRow(1), size: 2048 }]))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('2.0 KB')
    })

    it('renders MB label', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValue(recPayload([{ ...recRow(1), size: 3 * 1024 * 1024 }]))
      const wrapper = mountPanel({ deviceVersion: 'v2' })
      await flush()
      const btn = clickTab(wrapper, 'Rekaman')
      if (btn) await btn.trigger('click')
      expect(wrapper.text()).toContain('3.0 MB')
    })
  })
})
