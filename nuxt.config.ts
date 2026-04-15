import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-04-14',
  ssr: false,
  devtools: {
    enabled: true,
  },
  css: ['@/assets/main.css', 'vue-sonner/style.css'],
  alias: {
    '@': fileURLToPath(new URL('./app', import.meta.url)),
  },
  devServer: {
    host: '0.0.0.0',
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ['host.containers.internal', 'growmate.farel.is-a.dev'],
    },
  },
})
