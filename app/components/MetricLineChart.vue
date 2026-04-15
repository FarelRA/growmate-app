<script setup lang="ts">
import { computed } from 'vue'

type Point = {
  value: number
  measuredAt: number
}

const props = withDefaults(defineProps<{
  points: Point[]
  height?: number
  stroke?: string
  fill?: string
}>(), {
  height: 84,
  stroke: '#00a86b',
  fill: 'rgba(0, 168, 107, 0.12)',
})

const width = 240
const padding = 8

const normalizedPoints = computed(() => {
  if (props.points.length === 0) return []

  const values = props.points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return props.points.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(props.points.length - 1, 1)
    const y = props.height - padding - ((point.value - min) / range) * (props.height - padding * 2)
    return `${x},${y}`
  })
})

const linePath = computed(() => {
  if (normalizedPoints.value.length === 0) return ''
  return normalizedPoints.value.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point}`).join(' ')
})

const areaPath = computed(() => {
  if (normalizedPoints.value.length === 0) return ''

  const first = normalizedPoints.value[0]?.split(',')
  const last = normalizedPoints.value[normalizedPoints.value.length - 1]?.split(',')
  if (!first || !last) return ''

  return `${linePath.value} L ${last[0]},${props.height - padding} L ${first[0]},${props.height - padding} Z`
})
</script>

<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="h-full w-full" preserveAspectRatio="none" aria-hidden="true">
    <path v-if="areaPath" :d="areaPath" :fill="fill" />
    <path
      v-if="linePath"
      :d="linePath"
      :stroke="stroke"
      fill="none"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="3"
    />
  </svg>
</template>
