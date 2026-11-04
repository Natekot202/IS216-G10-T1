import { test, expect } from '@playwright/test'
import { openSitterProfile, openBookingForm } from './helpers.js'

// every test in this file starts logged in as SeedOwner
test.use({ storageState: 'playwright/.auth/owner.json' })

test.describe('Owner: find a sitter and book', () => {
  test('TC-05 owner finds a sitter and opens the booking form', async ({ page }) => {
    // setup + actions
    await openSitterProfile(page, 'SecondSitter')
    await page.getByRole('link', { name: 'Request Booking' }).click()
    // assert
    await expect(page.getByRole('heading', { name: 'New Booking Request' })).toBeVisible()
  })

  test('TC-06 cannot send an empty booking request', async ({ page }) => {
    // setup
    await openBookingForm(page, 'SecondSitter')
    // actions: press Send without filling in anything
    await page.getByRole('button', { name: 'Send Booking Request' }).click()
    // assert: the first rule in bookingRequestRules.js stops it
    await expect(page.getByText('Select at least one pet.')).toBeVisible()
  })

  test('TC-07 owner sends a valid booking request', async ({ page }) => {
    // setup: a day 10 days from today (the seed makes SecondSitter available for the next 30 days)
    const today = new Date()
    const target = new Date()
    target.setDate(today.getDate() + 10)
    await openBookingForm(page, 'SecondSitter')

    // actions
    await page.getByRole('button', { name: 'Mochi' }).click() // pick the pet
    if (target.getMonth() !== today.getMonth()) {
      await page.getByRole('button', { name: 'Next month' }).click() // the day is in next month
    }
    const day = page.getByRole('button', { name: String(target.getDate()), exact: true })
    await day.click() // start date
    await day.click() // same day again = one-day booking
    await page.getByLabel('Start time', { exact: true }).selectOption('09:00')
    await page.getByLabel('End time', { exact: true }).selectOption('12:00')
    await page.getByRole('button', { name: '+ Add task' }).click() // a new task is "Feed" by default
    await page.getByPlaceholder('e.g. Feed 1 cup kibble at 8am').fill('Feed Mochi 1 cup of kibble')
    await page.getByRole('button', { name: 'Send Booking Request' }).click()

    // assert: the "Request sent" screen, at the right price (Feed $8 × 1 a day × 1 day), waiting for the sitter
    await expect(page.getByRole('heading', { name: 'Request sent to SecondSitter' })).toBeVisible()
    await expect(page.getByText(/\$8\b/)).toBeVisible()
    await expect(page.getByText('pending', { exact: true })).toBeVisible()
  })
})

test.describe('Owner: manage bookings', () => {
  test('TC-10 owner confirms a booking the sitter accepted', async ({ page }) => {
    // setup: the "To confirm" tab (the seed has one accepted booking from SeedSitter)
    await page.goto('/owner/bookings?tab=to-confirm')
    // actions: press Confirm, then the popup's "Confirm booking" button
    await page.getByRole('button', { name: 'Confirm', exact: true }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm booking' }).click()
    // assert: the app opens that booking's page with the care details form
    await expect(page).toHaveURL(/\/bookings\/\w+\?details=open/)
  })

  test('TC-12 "Recommended for me" shows sitters that offer what my pets need', async ({ page }) => {
    // setup: the seed owner needs Grooming + Dog walking
    await page.goto('/home')
    // actions
    await page.getByRole('button', { name: /Recommended for me/ }).click()
    // assert: SeedSitter is shown, with the green "why" tag
    await expect(page.getByRole('heading', { name: 'SeedSitter', exact: true })).toBeVisible()
    await expect(page.getByText(/Offers .*Grooming/).first()).toBeVisible()
  })
})