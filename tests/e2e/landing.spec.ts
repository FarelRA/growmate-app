import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test('loads and returns 200', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 })
    expect(response?.ok()).toBeTruthy()
    await expect(page.locator('body')).toBeAttached({ timeout: 5000 })
  })

  test('page title mentions GrowMate', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 })
    const title = await page.title()
    expect(title.toLowerCase()).toContain('growmate')
  })
})
