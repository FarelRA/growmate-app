// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatThread from '../../../app/components/ChatThread.vue'
import type { ChatMessage } from '../../../app/components/ChatThread.vue'

const userMsg: ChatMessage = { _id: '1', role: 'user', status: 'done', body: 'Halo, apa kabar?' }
const assistantMsg: ChatMessage = {
  _id: '2',
  role: 'assistant',
  status: 'done',
  body: 'Saya baik. **Tanaman** perlu disiram.',
}
const streamingMsg: ChatMessage = { _id: '3', role: 'assistant', status: 'streaming' }
const errorMsg: ChatMessage = { _id: '4', role: 'assistant', status: 'error', body: 'Maaf, terjadi kesalahan.' }

describe('ChatThread', () => {
  it('renders user message with right alignment', () => {
    const wrapper = mount(ChatThread, {
      props: { messages: [userMsg] },
    })
    const msg = wrapper.find('.justify-end')
    expect(msg.exists()).toBe(true)
    expect(msg.text()).toContain('Halo, apa kabar?')
  })

  it('renders assistant message with left alignment', () => {
    const wrapper = mount(ChatThread, {
      props: { messages: [assistantMsg] },
    })
    const msg = wrapper.find('.justify-start')
    expect(msg.exists()).toBe(true)
  })

  it('sanitizes assistant body and renders formatted HTML', () => {
    const wrapper = mount(ChatThread, {
      props: {
        messages: [assistantMsg],
      },
    })
    const rich = wrapper.find('.assistant-rich')
    expect(rich.exists()).toBe(true)
    expect(rich.html()).toContain('<strong>')
  })

  it('removes <thought> tags from assistant body', () => {
    const msg: ChatMessage = {
      _id: '5',
      role: 'assistant',
      status: 'done',
      body: '<thought>internal reasoning</thought>Visible content',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    expect(wrapper.text()).not.toContain('internal reasoning')
    expect(wrapper.text()).toContain('Visible content')
  })

  it('removes <thinking> tags from assistant body', () => {
    const msg: ChatMessage = {
      _id: '6',
      role: 'assistant',
      status: 'done',
      body: '<thinking>processing</thinking>Hasil akhir',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    expect(wrapper.text()).not.toContain('processing')
    expect(wrapper.text()).toContain('Hasil akhir')
  })

  it('renders headings in assistant messages', () => {
    const msg: ChatMessage = {
      _id: '7',
      role: 'assistant',
      status: 'done',
      body: '# Judul\nIsi paragraf.',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    expect(wrapper.html()).toContain('<h1>')
  })

  it('renders unordered lists in assistant messages', () => {
    const msg: ChatMessage = {
      _id: '8',
      role: 'assistant',
      status: 'done',
      body: '- Item A\n- Item B\n- Item C',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    expect(wrapper.html()).toContain('<ul>')
    expect(wrapper.html()).toContain('<li>')
  })

  it('renders paragraphs in assistant messages', () => {
    const msg: ChatMessage = {
      _id: '9',
      role: 'assistant',
      status: 'done',
      body: 'Paragraf pertama.\n\nParagraf kedua.',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    const ps = wrapper.findAll('p')
    expect(ps.length).toBe(2)
  })

  it('shows streaming indicator when status is streaming', () => {
    const wrapper = mount(ChatThread, {
      props: { messages: [streamingMsg] },
    })
    expect(wrapper.text()).toContain('Sedang memproses')
  })

  it('shows thinking placeholder text when streaming with no body', () => {
    const wrapper = mount(ChatThread, {
      props: { messages: [streamingMsg] },
    })
    expect(wrapper.text()).toContain('Floral Assistant sedang berpikir...')
  })

  it('does not show streaming indicator when status is done', () => {
    const wrapper = mount(ChatThread, {
      props: { messages: [assistantMsg] },
    })
    expect(wrapper.text()).not.toContain('Sedang memproses')
  })

  it('renders multiple messages in order', () => {
    const wrapper = mount(ChatThread, {
      props: { messages: [userMsg, assistantMsg] },
    })
    const items = wrapper.findAll('.flex')
    expect(items.length).toBe(2)
  })

  it('renders empty state with no messages', () => {
    const wrapper = mount(ChatThread, {
      props: { messages: [] },
    })
    expect(wrapper.find('.space-y-4').exists()).toBe(true)
    expect(wrapper.findAll('.flex').length).toBe(0)
  })

  it('renders bold formatting in assistant messages as <strong>', () => {
    const msg: ChatMessage = {
      _id: '10',
      role: 'assistant',
      status: 'done',
      body: 'Ini **teks tebal** dan *teks miring*',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    const html = wrapper.html()
    expect(html).toContain('<strong>teks tebal</strong>')
    expect(html).toContain('<em>teks miring</em>')
  })

  it('escapes HTML in assistant body to prevent XSS', () => {
    const msg: ChatMessage = {
      _id: '11',
      role: 'assistant',
      status: 'done',
      body: '<script>alert("xss")</script>',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    expect(wrapper.html()).not.toContain('<script>')
    expect(wrapper.text()).toContain('<script>alert("xss")</script>')
  })

  it('renders user body as plain text (not HTML)', () => {
    const msg: ChatMessage = {
      _id: '12',
      role: 'user',
      status: 'done',
      body: '<b>not bold</b>',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    expect(wrapper.text()).toContain('<b>not bold</b>')
  })

  it('renders formatted code inline with <code> tag', () => {
    const msg: ChatMessage = {
      _id: '13',
      role: 'assistant',
      status: 'done',
      body: 'Gunakan perintah `npm run dev`',
    }
    const wrapper = mount(ChatThread, {
      props: { messages: [msg] },
    })
    expect(wrapper.html()).toContain('<code>npm run dev</code>')
  })
})
