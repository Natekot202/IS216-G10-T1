// Steps several tests share, so they're written once.
import { expect } from '@playwright/test'

// Owner home → search the sitter by name → View Profile
export async function openSitterProfile(page, sitterName) {
  await page.goto('/home')
  await page.getByPlaceholder('Search by sitter name').fill(sitterName)
  // wait until that sitter's card is showing, then open their profile
  await expect(page.getByRole('heading', { name: sitterName, exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'View Profile' }).first().click()
  await expect(page).toHaveURL(/\/users\//)
}

// ...then press Request Booking, which opens the New Booking Request form
export async function openBookingForm(page, sitterName) {
  await openSitterProfile(page, sitterName)
  await page.getByRole('link', { name: 'Request Booking' }).click()
  await expect(page.getByRole('heading', { name: 'New Booking Request' })).toBeVisible()
}