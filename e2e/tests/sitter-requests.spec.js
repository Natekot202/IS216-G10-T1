import { test, expect } from '@playwright/test'

// every test in this file starts logged in as SeedSitter
test.use({ storageState: 'playwright/.auth/sitter.json' })

test.describe('Sitter: booking requests', () => {
  test('TC-08 sitter accepts a pending request', async ({ page }) => {
    // setup: the "To accept" tab (the seed has a pending request for Luna)
    await page.goto('/sitter/requests')
    // actions: Accept on Luna's row, then Accept in the popup that asks "Accept this request?"
    const lunaRow = page.getByRole('row').filter({ hasText: 'Luna' }).first()
    await lunaRow.getByRole('button', { name: 'Accept' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Accept' }).click()
    // assert: success message, and the request is now waiting for the owner
    await expect(page.getByText(/Request accepted/)).toBeVisible()
    await page.getByRole('button', { name: /Awaiting confirmation/ }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Luna' }).first()).toBeVisible()
  })

  test('TC-09 sitter declines a pending request', async ({ page }) => {
    // setup: the seed has a pending request for Mochi
    await page.goto('/sitter/requests')
    // actions: Decline on Mochi's row, then Decline in the popup
    const mochiRow = page.getByRole('row').filter({ hasText: 'Mochi' }).first()
    await mochiRow.getByRole('button', { name: 'Decline' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Decline' }).click()
    // assert
    await expect(page.getByText('Request declined.')).toBeVisible()
  })
})

test.describe('Sitter: transactions', () => {
  test('TC-13 sitter sees the payment they received', async ({ page }) => {
    // setup: the seed has one successful Visa payment from SeedOwner
    await page.goto('/sitter/transactions')
    // actions: show only successful payments
    await page.getByRole('button', { name: /^Successful/ }).click()
    // assert: exactly one row, from SeedOwner, marked Successful
    const rows = page.getByRole('row').filter({ hasText: 'SeedOwner' })
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Successful')
  })
})