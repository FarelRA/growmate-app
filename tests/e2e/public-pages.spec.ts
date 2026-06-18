import { test, expect } from '@playwright/test'

test.describe('Public Pages', () => {
  test('login page loads', async ({ page }) => {
    const response = await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).toBeAttached({ timeout: 5000 })
  })

  test('404 page for unknown route', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist-xyz', { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(response?.status()).toBe(404)
    await expect(page.locator('body')).toBeAttached({ timeout: 5000 })
  })

  test('marketplace page loads', async ({ page }) => {
    const response = await page.goto('/marketplace', { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).toBeAttached({ timeout: 5000 })
  })

  test('blog page loads', async ({ page }) => {
    const response = await page.goto('/blog', { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).toBeAttached({ timeout: 5000 })
  })

  test('plant library page loads', async ({ page }) => {
    const response = await page.goto('/plant-library', { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).toBeAttached({ timeout: 5000 })
  })
})
