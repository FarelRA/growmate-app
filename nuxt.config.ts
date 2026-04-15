import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-04-14',
  modules: ['@vite-pwa/nuxt'],
  ssr: true,
  app: {
    head: {
      htmlAttrs: {
        lang: 'en',
      },
      title: 'GrowMate',
      titleTemplate: (titleChunk) => titleChunk && titleChunk !== 'GrowMate' ? `${titleChunk} | GrowMate` : 'GrowMate',
      meta: [
        { name: 'application-name', content: 'GrowMate' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'GrowMate' },
        { name: 'description', content: 'GrowMate helps growers monitor plants, devices, and care workflows from a mobile-friendly dashboard.' },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { property: 'og:title', content: 'GrowMate' },
        { property: 'og:description', content: 'GrowMate helps growers monitor plants, devices, and care workflows from a mobile-friendly dashboard.' },
        { property: 'og:type', content: 'website' },
        { name: 'theme-color', content: '#f9f9f9' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
      ],
    },
  },
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
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'GrowMate',
      short_name: 'GrowMate',
      description: 'GrowMate helps growers monitor plants, devices, and care workflows from a mobile-friendly dashboard.',
      theme_color: '#f9f9f9',
      background_color: '#f9f9f9',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/',
      icons: [
        {
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
        },
        {
          src: '/icons/icon-512-maskable.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
      navigateFallback: '/',
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
    },
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallback: '/',
    },
  },
})
