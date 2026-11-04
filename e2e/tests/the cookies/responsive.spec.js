import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/owner.json' })

test('TC-15 My Bookings tabs become a dropdown on phones', async ({ page }) => {
  await page.goto('/owner/bookings')
  const select = page.getByLabel('Show')                     // BookingTabs' phone dropdown
  await expect(select).toBeVisible()
  await select.selectOption('to-pay')
  await expect(page.getByRole('link', { name: 'Pay now' }).first()).toBeVisible()
})