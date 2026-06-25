// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatPanel from '../../../app/components/ChatPanel.vue'

const thread = {
  _id: 't1',
  productTitle: 'Tomat segar',
  participantName: 'Budi',
  role: 'seller',
  sellerUnreadCount: 2,
  buyerUnreadCount: 0,
  lastMessagePreview: 'Masih ada?',
}

const message = { _id: 'm1', body: 'Halo, masih ada?', mine: false, createdAtLabel: '1 jam lalu' }

describe('ChatPanel', () => {
  function createWrapper(overrides: Record<string, unknown> = {}) {
    return mount(ChatPanel, {
      props: {
        threads: [],
        selectedThread: null,
        selectedThreadId: null,
        replyMessage: '',
        sendingReply: false,
        ...overrides,
      },
    })
  }

  describe('thread list', () => {
    it('renders thread items', () => {
      const wrapper = createWrapper({ threads: [thread] })
      expect(wrapper.text()).toContain('Tomat segar')
      expect(wrapper.text()).toContain('Budi')
      expect(wrapper.text()).toContain('Masih ada?')
    })

    it('shows unread count for seller role', () => {
      const wrapper = createWrapper({ threads: [thread] })
      expect(wrapper.text()).toContain('2')
    })

    it('shows unread count for buyer role', () => {
      const buyerThread = { ...thread, role: 'buyer', sellerUnreadCount: 0, buyerUnreadCount: 3 }
      const wrapper = createWrapper({ threads: [buyerThread] })
      expect(wrapper.text()).toContain('3')
    })

    it('highlights selected thread', () => {
      const wrapper = createWrapper({ threads: [thread], selectedThreadId: 't1' })
      const btn = wrapper.findAll('button').at(0)
      expect(btn?.classes()).toContain('bg-gm-primary/5')
    })

    it('does not highlight non-selected thread', () => {
      const wrapper = createWrapper({ threads: [thread] })
      const btn = wrapper.findAll('button').at(0)
      expect(btn?.classes()).toContain('bg-[#fafafa]')
    })

    it('emits selectThread on thread click', async () => {
      const wrapper = createWrapper({ threads: [thread] })
      await wrapper.find('button').trigger('click')
      expect(wrapper.emitted('selectThread')).toBeTruthy()
      expect(wrapper.emitted('selectThread')![0]).toEqual(['t1'])
    })

    it('shows empty state when no threads', () => {
      const wrapper = createWrapper()
      expect(wrapper.text()).toContain('Belum ada percakapan marketplace')
    })
  })

  describe('selected thread area', () => {
    it('shows selected thread info', () => {
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat segar', participantName: 'Budi', messages: [message] },
      })
      expect(wrapper.text()).toContain('Tomat segar')
      expect(wrapper.text()).toContain('Budi')
    })

    it('renders messages', () => {
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat', participantName: 'Budi', messages: [message] },
      })
      expect(wrapper.text()).toContain('Halo, masih ada?')
      expect(wrapper.text()).toContain('1 jam lalu')
    })

    it('aligns mine messages to the right', () => {
      const myMsg = { ...message, mine: true }
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat', participantName: 'Budi', messages: [myMsg] },
      })
      const msgContainer = wrapper.find('.justify-end')
      expect(msgContainer.exists()).toBe(true)
    })

    it('aligns other messages to the left', () => {
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat', participantName: 'Budi', messages: [message] },
      })
      const msgContainer = wrapper.find('.justify-start')
      expect(msgContainer.exists()).toBe(true)
    })

    it('shows reply input and send button', () => {
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat', participantName: 'Budi', messages: [] },
      })
      expect(wrapper.text()).toContain('Kirim')
      expect(wrapper.find('input').exists()).toBe(true)
    })

    it('emits replyThread on send button click', async () => {
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat', participantName: 'Budi', messages: [] },
        replyMessage: 'Ya, masih',
      })
      await wrapper.findAll('button').filter(b => b.text() === 'Kirim')[0].trigger('click')
      expect(wrapper.emitted('replyThread')).toBeTruthy()
    })

    it('emits update:replyMessage on input', async () => {
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat', participantName: 'Budi', messages: [] },
      })
      const input = wrapper.find('input')
      await input.setValue('Halo')
      expect(wrapper.emitted('update:replyMessage')).toBeTruthy()
    })

    it('disables send button while sending', () => {
      const wrapper = createWrapper({
        selectedThread: { _id: 't1', productTitle: 'Tomat', participantName: 'Budi', messages: [] },
        sendingReply: true,
      })
      expect(wrapper.text()).toContain('Mengirim...')
    })
  })

  describe('no thread selected', () => {
    it('shows placeholder when no thread selected', () => {
      const wrapper = createWrapper({ threads: [thread] })
      expect(wrapper.text()).toContain('Pilih percakapan untuk mengelola pertanyaan listing')
    })
  })
})
