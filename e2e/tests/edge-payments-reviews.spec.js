// Feature list section 12 (payments, path P10) and section 13 (reviews and ratings).
// TC-11 already checks that Pay now opens Stripe Checkout, and TC-13 the sitter's Transactions page.
import { test, expect } from '@playwright/test'
import { apiAs, newUser, seedData, SEED, day, bookingBody, createBooking, cleanUp, expectError, sessionBooking, moveBooking, closeDb } from './helpers.js'

let owner, sitter, ids
test.beforeAll(async ({ browser }) => {
  owner = await apiAs(browser, 'owner')
  sitter = await apiAs(browser, 'sitter')
  ids = await seedData(owner.api)
})
test.afterAll(async () => {
  await owner.context.close()
  await sitter.context.close()
  await closeDb()
})

test.describe('Payments: server rules (API)', () => {
  const checkout = (who, bookingId) => who.api.post('/api/payments/checkout', { data: { bookingId } })

  test('a booking can only be paid once the sitter has completed it', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    await expectError(await checkout(owner, id), 400, 'You can only pay once the sitter has completed the booking. This one is pending.')
    await cleanUp(owner.api, id)
  })

  test('a paid booking cannot be paid again', async () => {
    await expectError(await checkout(owner, ids.booking(SEED.paid)), 400, 'This one is paid.')
  })

  test("another owner can't pay your booking, and a sitter can't pay at all", async ({ browser }) => {
    const stranger = await newUser(browser)
    await expectError(await checkout(stranger, ids.booking(SEED.completed)), 403, 'This booking is not yours')
    await stranger.context.close()
    await expectError(await checkout(sitter, ids.booking(SEED.completed)), 403, 'Owners only.')
  })

  test('confirming needs a real Stripe session', async () => {
    await expectError(await owner.api.post('/api/payments/confirm', { data: {} }), 400, 'Missing payment session.')
    await expectError(await owner.api.post('/api/payments/confirm', { data: { sessionId: 'cs_test_not_real' } }), 404, 'Payment not found')
    await expectError(await owner.api.post('/api/payments/000000000000000000000000/cancel'), 404, 'Payment not found')
  })
})

test.describe('Payment page (P10)', () => {
  test('back from Stripe without paying: a message, the address bar is cleaned, and you can try again', async () => {
    // setup: the completed booking, coming back with ?cancelled=<a payment id>
    const page = await owner.context.newPage()
    const bookingId = ids.booking(SEED.completed)
    await page.goto(`/bookings/${bookingId}/pay?cancelled=000000000000000000000000`)
    // assert
    await expect(page.getByText('Payment was cancelled. You can try again.')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/bookings/${bookingId}/pay$`)) // ?cancelled= removed, so a refresh can't cancel twice
    await expect(page.getByRole('button', { name: /with Stripe/ })).toBeEnabled() // still payable
    await page.close()
  })

  test('a paid booking says it has already been paid (no paying twice)', async () => {
    const page = await owner.context.newPage()
    await page.goto(`/bookings/${ids.booking(SEED.paid)}/pay`)
    await expect(page.getByText('This booking has already been paid. Thank you!')).toBeVisible()
    await expect(page.getByRole('button', { name: /with Stripe/ })).toHaveCount(0)
    await page.close()
  })

  test("a booking that isn't completed yet can't be paid", async () => {
    const page = await owner.context.newPage()
    await page.goto(`/bookings/${ids.booking(SEED.confirmedIn5Days)}/pay`)
    await expect(page.getByText('You can pay once the sitter has completed this booking.')).toBeVisible()
    await page.close()
  })
})

test.describe('Reviews (API)', () => {
  const review = (who, data) => who.api.post('/api/reviews', { data })

  test('the rating must be a whole number from 1 to 5', async () => {
    for (const rating of [0, 6, 3.5]) {
      await expectError(await review(owner, { bookingId: ids.booking(SEED.completed), rating }), 400, 'Rating must be 1 to 5.')
    }
  })

  test('a bad booking id, or a booking that is not yours, is refused', async ({ browser }) => {
    await expectError(await review(owner, { bookingId: 'abc', rating: 5 }), 400, 'Invalid booking.')
    const stranger = await newUser(browser)
    await expectError(await review(stranger, { bookingId: ids.booking(SEED.paid), rating: 5 }), 404, 'Booking not found.')
    await expectError(await stranger.api.get(`/api/reviews/booking/${ids.booking(SEED.paid)}`), 403, 'This booking is not yours.')
    await stranger.context.close()
  })

  test('only owners can review', async () => {
    await expectError(await review(sitter, { bookingId: ids.booking(SEED.paid), rating: 5 }), 403, 'Owners only.')
  })

  test('only a completed or paid booking can be reviewed', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    await expectError(await review(owner, { bookingId: id, rating: 5 }), 400, 'You can only review a booking once the sitter has completed it.')
    await cleanUp(owner.api, id)
  })

  test('one review per booking, and the sitter rating updates', async () => {
    // setup: SeedSitter's review count before
    const countBefore = (await (await owner.api.get(`/api/users/${ids.seedSitter}`)).json()).sitterProfile?.ratingCount ?? 0
    // actions: review the completed booking (the seed has no review on it; it already reviews the paid one)
    const first = await review(owner, { bookingId: ids.booking(SEED.completed), rating: 5, comment: 'Mochi loved it (E2E test)' })
    expect(first.status()).toBe(201)
    // assert: a second review is refused, the sitter has one more rating, and both sides can read it
    await expectError(await review(owner, { bookingId: ids.booking(SEED.completed), rating: 4 }), 409, 'You have already reviewed this booking.')
    await expect(async () => {
      const after = (await (await owner.api.get(`/api/users/${ids.seedSitter}`)).json()).sitterProfile?.ratingCount ?? 0
      expect(after).toBe(countBefore + 1)
    }).toPass({ timeout: 10_000 })
    const seen = await (await sitter.api.get(`/api/reviews/booking/${ids.booking(SEED.completed)}`)).json()
    expect(JSON.stringify(seen)).toContain('Mochi loved it (E2E test)')
  })
})

// ---------- Reviews close 30 days after the booking ends ----------
// Each test uses a brand-new owner's completed booking, moved back in time in the test database.

test.describe('Reviews close 30 days after the booking ends', () => {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  // a time in milliseconds -> '5 Oct', in Singapore time (how the pages write dates)
  const shortDate = (ms) => {
    const d = new Date(ms + 8 * 60 * 60 * 1000)
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`
  }
  // A completed one-day booking that ended `n` days ago at 12 pm
  async function endedDaysAgo(browser, n) {
    const b = await sessionBooking(browser, { status: 'completed' })
    await moveBooking(b.bookingId, [{ date: day(-n), startTime: '09:00', endTime: '12:00' }])
    return b
  }
  const review = (b) => b.owner.api.post('/api/reviews', { data: { bookingId: b.bookingId, rating: 4, comment: 'E2E' } })

  test('31 days after the end, a review is refused, and Booking Detail says when reviews closed', async ({ browser }) => {
    const b = await endedDaysAgo(browser, 31)
    await expectError(await review(b), 400, 'Reviews close 30 days after a booking ends, so this booking can no longer be reviewed.')

    const { reviewOpenUntil } = await (await b.owner.api.get(`/api/bookings/${b.bookingId}`)).json()
    expect(reviewOpenUntil).toBe(Date.parse(`${day(-31)}T12:00:00+08:00`) + 30 * 24 * 60 * 60 * 1000)
    const page = await b.owner.context.newPage()
    await page.goto(`/bookings/${b.bookingId}`)
    await expect(page.getByText(`Reviews for this booking closed on ${shortDate(reviewOpenUntil)}.`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit review' })).toHaveCount(0)
    await page.close()
    await b.close()
  })

  test('29 days after the end, Booking Detail shows the closing date and the review is accepted', async ({ browser }) => {
    const b = await endedDaysAgo(browser, 29)
    const { reviewOpenUntil } = await (await b.owner.api.get(`/api/bookings/${b.bookingId}`)).json()
    const page = await b.owner.context.newPage()
    await page.goto(`/bookings/${b.bookingId}`)
    await expect(page.getByText(`You can review until ${shortDate(reviewOpenUntil)}.`)).toBeVisible()
    await page.close()
    expect((await review(b)).status()).toBe(201)
    await b.close()
  })
})
