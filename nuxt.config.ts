import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2026-05-15',
  modules: ['@vite-pwa/nuxt'],
  ssr: true,
  app: {
    head: {
      htmlAttrs: {
        lang: 'id',
      },
      title: 'GrowMate',
      meta: [
        { name: 'application-name', content: 'GrowMate' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'GrowMate' },
        {
          name: 'description',
          content:
            'GrowMate adalah solusi pertanian cerdas berbasis IoT dan AI untuk memantau tanaman, perangkat, dan alur budidaya secara lebih efisien.',
        },
        { name: 'format-detection', content: 'telephone=no' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { property: 'og:title', content: 'GrowMate' },
        {
          property: 'og:description',
          content:
            'GrowMate adalah solusi pertanian cerdas berbasis IoT dan AI untuk memantau tanaman, perangkat, dan alur budidaya secara lebih efisien.',
        },
        { property: 'og:image', content: '/growmate-icon.png' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'GrowMate' },
        { property: 'og:locale', content: 'id_ID' },
        {
          name: 'robots',
          content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
        },
        { name: 'theme-color', content: '#f9f9f9' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', href: '/growmate-icon.png' },
        { rel: 'shortcut icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/growmate-icon.png' },
      ],
    },
  },
  devtools: {
    enabled: false,
  },
  routeRules: {
    '/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': "default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; connect-src 'self' https: wss:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
      },
    },
    '/dashboard': { ssr: false },
    '/assistant': { ssr: false },
    '/profile': { ssr: false },
    '/admin': { ssr: false },
    '/community': { ssr: false },
    '/history': { ssr: false },
    '/devices': { ssr: false },
    '/workspace-marketplace': { ssr: false },
    '/workspace-support': { ssr: false },
    '/claim-device': { ssr: false },
    '/complete-profile': { ssr: false },
    '/select-plant': { ssr: false },
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
      allowedHosts: ['growmate.bond'],
      hmr: {
        protocol: 'wss',
        host: 'growmate.bond',
      },
    },
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'GrowMate',
      short_name: 'GrowMate',
      description:
        'GrowMate helps growers monitor plants, devices, and care workflows from a mobile-friendly dashboard.',
      theme_color: '#f9f9f9',
      background_color: '#f9f9f9',
      display: 'standalone',
      orientation: 'portrait',
      scope: '/',
      start_url: '/dashboard',
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
      navigateFallbackDenylist: [/^\/sitemap\.xml$/, /^\/sitemaps\.xml$/, /^\/robots\.txt$/],
      cleanupOutdatedCaches: true,
      clientsClaim: true,
      skipWaiting: true,
    },
    devOptions: {
      enabled: true,
      suppressWarnings: true,
      navigateFallback: '/',
      navigateFallbackAllowlist: [/^\/$/, /^\/(products|marketplace|plant-library|support|about|blog|stories)(\/.*)?$/],
    },
  },
})
