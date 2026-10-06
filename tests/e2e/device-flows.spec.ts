import { test, expect } from '@playwright/test'

/**
 * Device flows: login → claim-device → dashboard.
 *
 * Runnable scope (no backend seed required):
 * - Unauthenticated users bounce to /login on every step of the flow.
 * - Login page renders a usable form and never leaves /login without input.
 *
 * Full happy path (login → verify device → claim → dashboard) needs seeded
 * backend state that does not exist in the `playwright.config.ts` webServer
 * env (live Convex + seeded user + unclaimed device). It is written below as
 * `describe.skip` with env-driven credentials so it can run un-skipped once
 * seeding exists. See the skip reason on the block.
 */
test.describe('Device flow guards (no session)', () => {
  test('dashboard without session redirects to login', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('claim-device without session redirects to login', async ({ page }) => {
    await page.goto('/claim-device', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('claim-device manual linking without session redirects to login', async ({ page }) => {
    await page.goto('/claim-device?manual=1', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('select-plant without session redirects to login', async ({ page }) => {
    await page.goto('/select-plant', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('profile without session redirects to login', async ({ page }) => {
    await page.goto('/profile', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })
})

test.describe('Login page', () => {
  test('renders email + password form', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button[type="submit"]')).toContainText('Masuk')
  })

  test('empty submit stays on login (client-side validation)', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.locator('button[type="submit"]').click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })

  test('register link goes to /register', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.getByRole('link', { name: 'Buat akun' }).click()
    await expect(page).toHaveURL(/\/register/, { timeout: 15000 })
  })
})

// Requires: live Convex backend + seeded user (E2E_TEST_EMAIL/E2E_TEST_PASSWORD)
// + unclaimed device (E2E_DEVICE_ID, e.g. ESP32_DEMO_001). The configured
// webServer (`bun run build && node .output/server/index.mjs`) provides none
// of these, so this block stays skipped until e2e seeding exists.
test.describe.skip('Device happy path (seeded backend required)', () => {
  const email = process.env.E2E_TEST_EMAIL ?? ''
  const password = process.env.E2E_TEST_PASSWORD ?? ''
  const deviceId = process.env.E2E_DEVICE_ID ?? 'ESP32_DEMO_001'

  test('login → claim-device → dashboard', async ({ page }) => {
    // 1. Login.
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[type="password"]').fill(password)
    await page.locator('button[type="submit"]').click()
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30000 })

    // 2. Claim the device: verify first (claim button stays disabled until
    // the device lookup succeeds), then submit.
    await page.goto('/claim-device', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await page.locator('input[placeholder="ESP32_DEMO_001"]').fill(deviceId)
    await page.getByRole('button', { name: 'Verifikasi' }).click()
    await expect(page.getByText('Terverifikasi')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Hubungkan Perangkat dan Lanjutkan' }).click()
    await expect(page).toHaveURL(/\/select-plant/, { timeout: 30000 })

    // 3. Dashboard is reachable for a claimed device once setup completes.
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 })
  })
})
