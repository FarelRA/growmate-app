import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: `http://localhost:${Number(process.env.E2E_PORT ?? 3000)}`,
    trace: 'on-first-retry',
    headless: true,
    launchOptions: {
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  },

  webServer: {
    // Build first so `test:e2e` works on a fresh clone without a prior `.output` dir.
    // E2E_PORT sidesteps the live deployment on :3000 — never point this at production.
    command: 'bun run build && node .output/server/index.mjs',
    port: Number(process.env.E2E_PORT ?? 3000),
    env: { PORT: process.env.E2E_PORT ?? '3000' },
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
  },
})
