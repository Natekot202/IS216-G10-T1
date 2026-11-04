import { test, expect } from '@playwright/test'
import { openSitterProfile, openBookingForm } from './helpers.js'

// every test in this file starts logged in as SeedOwner
test.use({ storageState: 'playwright/.auth/owner.json' })

test.describe('Owner: find a sitter and book', () => {
  test('TC-05 owner finds a sitter and opens the booking form', async ({ page }) => {
    // setup + actions
    await openSitterProfile(page, 'SecondSitter')
    await page.getByRole('link', { name: 'Request Booking' }).click()
    // assert: the booking form (renamed "Book a sitter" in PR #56)
    await expect(page.getByRole('heading', { name: 'Book a sitter' })).toBeVisible()
  })

  test('TC-06 cannot send an empty booking request', async ({ page }) => {
    // setup
    await openBookingForm(page, 'SecondSitter')
    // actions: press Send without filling in anything
    await page.getByRole('button', { name: 'Send Booking Request' }).click()
    // assert: the first rule in bookingRequestRules.js stops it
    // (.first(): the message shows in the Summary box and again in the phone bar)
    await expect(page.getByText('Select at least one pet.').first()).toBeVisible()
  })

  test('TC-07 owner sends a valid booking request', async ({ page }) => {
    // setup: a day 10 days from today (the seed makes SecondSitter available for the next 30 days)
    const today = new Date()
    const target = new Date()
    target.setDate(today.getDate() + 10)
    await openBookingForm(page, 'SecondSitter')

    // actions
    await page.getByRole('button', { name: 'Mochi' }).click() // pick the pet (the card says "Mochi Dog")
    if (target.getMonth() !== today.getMonth()) {
      await page.getByRole('button', { name: 'Next month' }).click() // the day is in next month
    }
    const day = page.getByRole('button', { name: String(target.getDate()), exact: true })
    await day.click() // start date
    await day.click() // same day again = one-day booking
    await page.getByLabel('Start time', { exact: true }).selectOption('09:00')
    await page.getByLabel('End time', { exact: true }).selectOption('12:00')
    await page.getByRole('button', { name: '+ Add task' }).click() // a new task is "Feed" by default
    await page.locator('#task-title-0').fill('Feed Mochi 1 cup of kibble') // the first task's "What to do" box
    await page.getByRole('button', { name: 'Send Booking Request' }).click()

    // assert: the "Request sent!" screen, sent to SecondSitter, waiting for them, at the right price (Feed $8 × 1 a day × 1 day)
    await expect(page.getByRole('heading', { name: 'Request sent!' })).toBeVisible()
    await expect(page.getByText('Your request has been sent to SecondSitter.')).toBeVisible()
    await expect(page.getByText('Pending · waiting for sitter')).toBeVisible()
    await expect(page.getByText('$8', { exact: true })).toBeVisible()
  })
})

test.describe('Owner: manage bookings', () => {
  test('TC-10 owner confirms a booking the sitter accepted', async ({ page }) => {
    // setup: the "To confirm" tab (the seed has one accepted booking from SeedSitter)
    await page.goto('/owner/bookings?tab=to-confirm')
    // actions: press Confirm, then the popup's "Confirm booking" button
    await page.getByRole('button', { name: 'Confirm', exact: true }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm booking' }).click()
    // assert: the app opens that booking's page (24-character booking id), now confirmed
    // (BookingDetail.vue removes ?details=open from the address bar after opening the form)
    await expect(page).toHaveURL(/\/bookings\/[a-f0-9]{24}$/)
    await expect(page.getByRole('heading', { name: 'Booking Detail' })).toBeVisible()
    await expect(page.getByText('Confirmed', { exact: true }).first()).toBeVisible()
  })

  test('TC-12 "Recommended for me" shows sitters that offer what my pets need', async ({ page }) => {
    // setup: the seed owner needs Grooming + Dog walking
    await page.goto('/home')
    // actions: turn on Recommended, and search SeedSitter's name so the card is on page 1
    // (the new seed has more sitters, so a page of 6 can fill up)
    await page.getByRole('button', { name: /Recommended for me/ }).click()
    await page.getByPlaceholder('Search by sitter name').fill('SeedSitter')
    // assert: SeedSitter is shown, with the green "why" tag
    await expect(page.getByRole('heading', { name: 'SeedSitter', exact: true })).toBeVisible()
    await expect(page.getByText(/Offers .*Grooming/).first()).toBeVisible()
  })
})
