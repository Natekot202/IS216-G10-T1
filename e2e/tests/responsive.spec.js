import { test, expect } from '@playwright/test'

// Runs only in the 'iphone-6' project (see playwright.config.js)
test.use({ storageState: 'playwright/.auth/owner.json' })

test.describe('Responsive design', () => {
  test('TC-15 My Bookings tabs become a dropdown on a phone', async ({ page }) => {
    // setup
    await page.goto('/owner/bookings')
    // actions: on a phone the tabs are replaced by a "Show" dropdown
    const dropdown = page.getByLabel('Show')
    await expect(dropdown).toBeVisible()
    await dropdown.selectOption('to-pay')
    // assert: the To pay list is showing
    await expect(page.getByRole('link', { name: 'Pay now' }).first()).toBeVisible()
  })
})