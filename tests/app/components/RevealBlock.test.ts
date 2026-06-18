/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RevealBlock from '../../../app/components/RevealBlock.vue'

let mockObserve: ReturnType<typeof vi.fn>
let mockDisconnect: ReturnType<typeof vi.fn>

beforeEach(() => {
  mockObserve = vi.fn()
  mockDisconnect = vi.fn()

  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) {
      ;(window as any).__intersectionCallback = callback
    }
    observe = mockObserve
    disconnect = mockDisconnect
    unobserve = vi.fn()
  })

  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })))
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (window as any).__intersectionCallback
})

function triggerIntersection(isIntersecting: boolean) {
  const cb = (window as any).__intersectionCallback as
    | IntersectionObserverCallback
    | undefined
  if (cb) {
    cb(
      [{ isIntersecting, boundingClientRect: {} as DOMRectReadOnly, intersectionRatio: isIntersecting ? 1 : 0, intersectionRect: {} as DOMRectReadOnly, isVisible: false, rootBounds: null, target: document.createElement('div'), time: Date.now() }],
      null as any,
    )
  }
}

describe('RevealBlock', () => {
  it('renders default slot content', () => {
    const wrapper = mount(RevealBlock, {
      slots: { default: 'Hello World' },
    })
    expect(wrapper.text()).toBe('Hello World')
  })

  it('renders with default origin="up"', () => {
    const wrapper = mount(RevealBlock, {
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.classList.contains('gm-reveal')).toBe(true)
    expect(el.classList.contains('gm-reveal-up')).toBe(true)
  })

  it('renders with origin="left"', () => {
    const wrapper = mount(RevealBlock, {
      props: { origin: 'left' },
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.classList.contains('gm-reveal-left')).toBe(true)
  })

  it('renders with origin="right"', () => {
    const wrapper = mount(RevealBlock, {
      props: { origin: 'right' },
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.classList.contains('gm-reveal-right')).toBe(true)
  })

  it('renders with origin="down"', () => {
    const wrapper = mount(RevealBlock, {
      props: { origin: 'down' },
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.classList.contains('gm-reveal-down')).toBe(true)
  })

  it('renders with origin="scale"', () => {
    const wrapper = mount(RevealBlock, {
      props: { origin: 'scale' },
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.classList.contains('gm-reveal-scale')).toBe(true)
  })

  it('applies default transition delay of 0ms', () => {
    const wrapper = mount(RevealBlock, {
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.transitionDelay).toBe('0ms')
  })

  it('applies custom transition delay', () => {
    const wrapper = mount(RevealBlock, {
      props: { delay: 300 },
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.style.transitionDelay).toBe('300ms')
  })

  it('renders with custom HTML tag via "as" prop', () => {
    const wrapper = mount(RevealBlock, {
      props: { as: 'section' },
      slots: { default: 'test' },
    })
    expect(wrapper.element.tagName).toBe('SECTION')
  })

  it('creates an IntersectionObserver and observes the element', () => {
    mount(RevealBlock, {
      slots: { default: 'test' },
    })
    expect(mockObserve).toHaveBeenCalled()
  })

  it('adds is-visible class when intersection occurs', () => {
    const wrapper = mount(RevealBlock, {
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    triggerIntersection(true)
    expect(el.classList.contains('is-visible')).toBe(true)
  })

  it('disconnects observer when once is true and element intersects', () => {
    mount(RevealBlock, {
      props: { once: true },
      slots: { default: 'test' },
    })
    triggerIntersection(true)
    expect(mockDisconnect).toHaveBeenCalled()
  })

  it('removes is-visible class when once is false and element leaves viewport', () => {
    const wrapper = mount(RevealBlock, {
      props: { once: false },
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    triggerIntersection(true)
    expect(el.classList.contains('is-visible')).toBe(true)
    triggerIntersection(false)
    expect(el.classList.contains('is-visible')).toBe(false)
  })

  it('does not disconnect observer when once is false after intersection', () => {
    mount(RevealBlock, {
      props: { once: false },
      slots: { default: 'test' },
    })
    triggerIntersection(true)
    expect(mockDisconnect).not.toHaveBeenCalled()
  })

  it('respects prefers-reduced-motion and immediately sets visible', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    const wrapper = mount(RevealBlock, {
      slots: { default: 'test' },
    })
    const el = wrapper.element as HTMLElement
    expect(el.classList.contains('is-visible')).toBe(true)
  })
})
