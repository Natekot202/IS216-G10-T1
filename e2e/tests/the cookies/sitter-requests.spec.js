import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/sitter.json' })

test.describe('Booking requests (sitter)', () => {
  test('TC-08 sitter accepts a pending request', async ({ page }) => {
    await page.goto('/sitter/requests')
    const row = page.getByRole('row').filter({ hasText: 'Luna' }).first()
    await row.getByRole('button', { name: 'Accept' }).click()
    // (if a confirm dialog pops up, click its confirm button here)
    await page.getByRole('button', { name: /Awaiting confirmation/ }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Luna' }).first()).toBeVisible()
  })

  test('TC-09 sitter declines a pending request', async ({ page }) => {
    await page.goto('/sitter/requests')
    const row = page.getByRole('row').filter({ hasText: 'Mochi' }).first()
    await row.getByRole('button', { name: 'Decline' }).click()
    await page.getByRole('button', { name: /^Past/ }).click()
    await expect(page.getByText('declined', { exact: false }).first()).toBeVisible()
  })
})