import { test, expect } from '@playwright/test'

test.use({ storageState: 'playwright/.auth/owner.json' })

test.describe('Owner bookings', () => {
  test('TC-06 cannot send an empty booking request', async ({ page }) => {
    await page.goto('/home')
    await page.getByText('SecondSitter').first().click()            // open the sitter's profile
    await page.getByRole('link', { name: 'Request Booking' }).click()
    await page.getByRole('button', { name: 'Send Booking Request' }).click()
    await expect(page.getByText('Select at least one pet.')).toBeVisible()
  })

  test('TC-10 owner confirms a booking the sitter accepted', async ({ page }) => {
    await page.goto('/owner/bookings?tab=to-confirm')
    await page.getByRole('button', { name: 'Confirm' }).first().click()
    await page.getByRole('button', { name: /^Upcoming/ }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Mochi' }).first()).toBeVisible()
  })

  // TC-07: record this one — pick Mochi, choose dates in the date picker, + Add task (Walk ×2),
  // Send → assert "Request sent to SecondSitter", then My Bookings › Pending has the row.
})