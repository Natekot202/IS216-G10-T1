import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/owner.json' })

test.describe('Payment (Stripe)', () => {
  test('TC-11 Pay now hands the owner over to Stripe Checkout', async ({ page }) => {
    // setup: the "To pay" tab (the seed has one completed booking waiting for payment)
    await page.goto('/owner/bookings?tab=to-pay')
    // actions
    await page.getByRole('link', { name: 'Pay now' }).first().click()
    await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible()
    await page.getByRole('button', { name: /with Stripe/ }).click()
    // assert: we are on Stripe's own checkout page.
    // We stop here on purpose: Stripe's page belongs to another company and can change at any time.
    await expect(page).toHaveURL(/checkout\.stripe\.com/, { timeout: 15_000 })
  })
})