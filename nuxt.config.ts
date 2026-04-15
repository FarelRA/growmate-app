import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-04-14',
  ssr: false,
  devtools: {
    enabled: false,
  },
  sourcemap: {
    client: false,
    server: false,
  },
  runtimeConfig: {
    public: {
      convexUrl: process.env.NUXT_PUBLIC_CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? '',
    },
  },
  css: ['@/assets/main.css', 'vue-sonner/style.css'],
  alias: {
    '@': fileURLToPath(new URL('./app', import.meta.url)),
  },
  devServer: {
    host: '0.0.0.0',
  },
  vite: {
    logLevel: 'error',
    plugins: [tailwindcss()],
    build: {
      modulePreload: {
        polyfill: false,
      },
    },
    server: {
      allowedHosts: ['host.containers.internal', 'growmate.farel.is-a.dev'],
    },
  },
})
