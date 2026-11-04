import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/owner.json' })

test('TC-11 Pay now hands the owner over to Stripe Checkout', async ({ page }) => {
  await page.goto('/owner/bookings?tab=to-pay')
  await page.getByRole('link', { name: 'Pay now' }).first().click()
  await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible()
  await page.getByRole('button', { name: /with Stripe/ }).click()
  await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 15_000 })
})