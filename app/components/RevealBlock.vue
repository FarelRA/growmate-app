<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    as?: string
    origin?: 'up' | 'down' | 'left' | 'right' | 'scale'
    delay?: number
    once?: boolean
  }>(),
  {
    as: 'div',
    origin: 'up',
    delay: 0,
    once: true,
  },
)

type RevealTarget = HTMLElement | { $el?: HTMLElement | null } | null

const root = ref<RevealTarget>(null)

onMounted(() => {
  const target = root.value
  const el = target instanceof HTMLElement
    ? target
    : target?.$el instanceof HTMLElement
      ? target.$el
      : null
  if (!el) return

  el.classList.add('gm-reveal', `gm-reveal-${props.origin}`)
  el.style.transitionDelay = `${props.delay}ms`

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.classList.add('is-visible')
    return
  }

  const observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry) return

      if (entry.isIntersecting) {
        el.classList.add('is-visible')
        if (props.once) {
          observer.disconnect()
        }
        return
      }

      if (!props.once) {
        el.classList.remove('is-visible')
      }
    },
    {
      threshold: 0.18,
      rootMargin: '0px 0px -12% 0px',
    },
  )

  observer.observe(el)
})
</script>

<template>
  <component :is="as" ref="root">
    <slot />
  </component>
</template>
