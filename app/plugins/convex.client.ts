import type { Plugin } from 'vue'
import { convexPlugin } from '@/lib/convex'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(convexPlugin as unknown as Plugin)
})
