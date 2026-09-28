import { test, expect } from '@playwright/test'

test.describe('Auth redirects', () => {
  test('protected route without session redirects to login', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded', timeout: 15000 })
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 })
  })
})
