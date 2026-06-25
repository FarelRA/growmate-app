// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '../../../app/components/ChatInput.vue'

describe('ChatInput', () => {
  it('renders textarea with current value', () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: 'hello', sending: false, disabled: false },
    })
    const textarea = wrapper.find('textarea')
    expect(textarea.exists()).toBe(true)
    expect(textarea.element.value).toBe('hello')
  })

  it('renders send button', () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: '', sending: false, disabled: false },
    })
    const btn = wrapper.find('button')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('send')
  })

  it('disables textarea and button when sending', () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: '', sending: true, disabled: false },
    })
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('disables textarea and button when disabled prop is true', () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: '', sending: false, disabled: true },
    })
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('shows hourglass icon when sending', () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: '', sending: true, disabled: false },
    })
    expect(wrapper.text()).toContain('hourglass_top')
    expect(wrapper.text()).not.toContain('send')
  })

  it('emits update:modelValue on textarea input', async () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: '', sending: false, disabled: false },
    })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('new text')
    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')![0]).toEqual(['new text'])
  })

  it('emits send on button click', async () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: 'hello', sending: false, disabled: false },
    })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('send')).toBeTruthy()
  })

  it('emits send on Enter key', async () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: 'hello', sending: false, disabled: false },
    })
    await wrapper.find('textarea').trigger('keyup.enter')
    expect(wrapper.emitted('send')).toBeTruthy()
  })

  it('does not emit send on Enter when sending', async () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: 'hello', sending: true, disabled: false },
    })
    await wrapper.find('textarea').trigger('keyup.enter')
    expect(wrapper.emitted('send')).toBeFalsy()
  })

  it('does not emit send on Enter when disabled', async () => {
    const wrapper = mount(ChatInput, {
      props: { modelValue: 'hello', sending: false, disabled: true },
    })
    await wrapper.find('textarea').trigger('keyup.enter')
    expect(wrapper.emitted('send')).toBeFalsy()
  })
})
