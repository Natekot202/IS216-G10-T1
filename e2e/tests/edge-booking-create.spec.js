// Feature list section 5 "Send a booking request" + section 6 prices + path P12 (several days, different hours).
// TC-06 (no pet) and TC-07 (a valid one-day request) already exist.
//
// Days used here (counted from today), chosen so they never clash with other tests:
//   15 = SecondSitter, for requests that are refused anyway      22 = SecondSitter's seeded pending request
//   24-25 = SecondSitter, several days                            27 = SecondSitter, part-day availability
//    2 = SeedSitter's seeded accepted booking                      40 = after the seed's 30 available days
import { test, expect } from '@playwright/test'
import { AUTH, apiAs, seedData, day, bookingBody, createBooking, cleanUp, expectError, FEED, openBookingForm } from './helpers.js'

test.use({ storageState: AUTH.owner })

// ---------- The page's own checks (before anything is sent) ----------
// (The page shows each message twice: in the Summary box, and in the bar that phones use. .first() is the Summary one.)

test.describe('Booking form: checks on the page', () => {
  // picks a one-day booking 15 days from today, 9am to 12pm
  async function pickDayAndTimes(page) {
    const today = new Date()
    const target = new Date()
    target.setDate(today.getDate() + 15)
    if (target.getMonth() !== today.getMonth()) await page.getByRole('button', { name: 'Next month' }).click()
    const dayButton = page.getByRole('button', { name: String(target.getDate()), exact: true })
    await dayButton.click()
    await dayButton.click()
    await page.getByLabel('Start time', { exact: true }).selectOption('09:00')
    await page.getByLabel('End time', { exact: true }).selectOption('12:00')
  }

  test('no dates → "Choose a start and end date."', async ({ page }) => {
    await openBookingForm(page, 'SecondSitter')
    await page.getByRole('button', { name: 'Mochi' }).click()
    await page.getByRole('button', { name: 'Send Booking Request' }).click()
    await expect(page.getByText('Choose a start and end date.').first()).toBeVisible()
  })

  test('no care tasks → the price needs at least one', async ({ page }) => {
    await openBookingForm(page, 'SecondSitter')
    await page.getByRole('button', { name: 'Mochi' }).click()
    await pickDayAndTimes(page)
    await page.getByRole('button', { name: 'Send Booking Request' }).click()
    await expect(page.getByText('Add at least one care task. The price is based on the tasks.').first()).toBeVisible()
  })

  test('a task without a description is stopped', async ({ page }) => {
    await openBookingForm(page, 'SecondSitter')
    await page.getByRole('button', { name: 'Mochi' }).click()
    await pickDayAndTimes(page)
    await page.getByRole('button', { name: '+ Add task' }).click()
    await page.getByRole('button', { name: 'Send Booking Request' }).click()
    await expect(page.getByText('Give every care task a description, or remove it.').first()).toBeVisible()
  })

  test('a walk task without a route choice is stopped', async ({ page }) => {
    await openBookingForm(page, 'SecondSitter')
    await page.getByRole('button', { name: 'Mochi' }).click()
    await pickDayAndTimes(page)
    await page.getByRole('button', { name: '+ Add task' }).click()
    await page.locator('#task-type-0').selectOption('walk') // the first task's Type (its label is hidden on laptops)
    await page.locator('#task-title-0').fill('Walk around the block') // the first task's "What to do" box
    await page.getByRole('button', { name: 'Send Booking Request' }).click()
    await expect(page.getByText('Choose a route for "Walk around the block"').first()).toBeVisible()
  })

  test('the price preview adds up the tasks (Walk $20 × 2 a day = $40)', async ({ page }) => {
    await openBookingForm(page, 'SecondSitter')
    await page.getByRole('button', { name: 'Mochi' }).click()
    await pickDayAndTimes(page)
    await page.getByRole('button', { name: '+ Add task' }).click()
    await page.locator('#task-type-0').selectOption('walk') // the first task's Type (its label is hidden on laptops)
    await page.getByRole('button', { name: 'More times' }).click() // 1 → 2 times a day
    await expect(page.getByText('Walk: $20 × 2 a day × 1 day')).toBeVisible()
    await expect(page.getByText('$40').first()).toBeVisible()
  })
})

// ---------- The server's checks (each sends a request the server must refuse) ----------

test.describe('Booking request: server rules (API)', () => {
  let ids
  test.beforeAll(async ({ browser }) => {
    const { context, api } = await apiAs(browser, 'owner')
    ids = await seedData(api)
    await context.close()
  })

  const send = (page, body) => page.request.post('/api/bookings', { data: body })

  test('a sitter calling this → 403 "Owners only."', async ({ browser }) => {
    const { context, api } = await apiAs(browser, 'sitter')
    await expectError(await api.post('/api/bookings', { data: bookingBody(ids) }), 403, 'Owners only.')
    await context.close()
  })

  test('an invalid sitter id → "Choose a sitter."', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { sitterId: 'abc' })), 400, 'Choose a sitter.')
  })

  test('a user who is not a sitter → "Sitter not found."', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { sitterId: ids.ownerId })), 404, 'Sitter not found.')
  })

  test('no pets → "Select at least one pet."', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { petIds: [] })), 400, 'Select at least one pet.')
  })

  test('a pet that is not yours is refused', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { petIds: ['000000000000000000000000'] })), 400, 'You can only book for your own pets.')
  })

  test('a start date in the past is refused', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { startDate: day(-1), endDate: day(-1) })), 400, 'Start date cannot be in the past.')
  })

  test('an end date before the start date is refused', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { startDate: day(15), endDate: day(14) })), 400, 'End date must be on or after the start date.')
  })

  test('notes to the sitter can be up to 1000 characters', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { notes: 'n'.repeat(1001) })), 400, 'Notes to the sitter can be up to 1000 characters.')
    // exactly 1000 is fine (then withdrawn again)
    const id = await createBooking(page.request, bookingBody(ids, { notes: 'n'.repeat(1000) }))
    await cleanUp(page.request, id)
  })

  test('a start time that has already passed today is refused', async ({ page }) => {
    // 7:00–7:30 am today is in the past from 7:00 am Singapore time on
    const sgHour = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', hour12: false }))
    test.skip(sgHour < 8, 'Only meaningful after 8 am Singapore time')
    await expectError(await send(page, bookingBody(ids, { startDate: day(0), startTime: '07:00', endTime: '07:30' })), 400, 'The start time has already passed.')
  })

  for (const [label, startTime, endTime] of [
    ['before 7:00 am', '06:00', '09:00'],
    ['not on the half-hour', '09:15', '10:00'],
    ['ending at 7:00 am', '07:00', '07:00']
  ]) {
    test(`a time ${label} is refused`, async ({ page }) => {
      await expectError(await send(page, bookingBody(ids, { startTime, endTime })), 400, 'Choose a start and end time between 7:00 am and 12:00 am')
    })
  }

  test('an end time that is not after the start time is refused', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { startTime: '12:00', endTime: '10:00' })), 400, 'the end time must be after the start time.')
  })

  test('the hours must cover every day of the booking', async ({ page }) => {
    const body = bookingBody(ids, { startDate: day(24), endDate: day(25), dayTimes: [{ date: day(24), startTime: '09:00', endTime: '12:00' }] })
    await expectError(await send(page, body), 400, 'Choose the hours for each day of the booking.')
  })

  test('a day the sitter is not free → 409 naming the day', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { startDate: day(40), endDate: day(40) })), 409, `The sitter is not available on ${day(40)}.`)
  })

  test('free that day, but not at those hours → 409', async ({ page, browser }) => {
    // setup: SecondSitter is only free 9:00–10:00 on day 27
    const { context, api } = await apiAs(browser, 'sitter2')
    const saved = await api.put('/api/availability/me', { data: { changes: [{ date: day(27), slots: [540, 570] }] } })
    expect(saved.status()).toBe(200)
    await context.close()
    // actions + assert: ask for 1–2 pm
    const body = bookingBody(ids, { startDate: day(27), endDate: day(27), startTime: '13:00', endTime: '14:00' })
    await expectError(await send(page, body), 409, `The sitter is not available at those times on ${day(27)}.`)
  })

  test("clashes with the sitter's accepted booking → 409", async ({ page }) => {
    // SeedSitter has an accepted (later confirmed) booking 2 days from now, 8 am to 12 pm
    const body = bookingBody(ids, { sitterId: ids.seedSitter, startDate: day(2), endDate: day(2), startTime: '09:00', endTime: '10:00' })
    await expectError(await send(page, body), 409, 'The sitter is already booked')
  })

  test("another owner's pending request does NOT block the time", async ({ page }) => {
    // SecondSitter's seeded pending request is on day 22, 8 am to 12 pm: ask for the same time
    const id = await createBooking(page.request, bookingBody(ids, { startDate: day(22), endDate: day(22), startTime: '08:00', endTime: '12:00' }))
    await cleanUp(page.request, id)
  })

  test('0 tasks, more than 20 tasks, and an unknown type are refused', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { tasks: [] })), 400, 'Add at least one care task.')
    await expectError(await send(page, bookingBody(ids, { tasks: Array(21).fill(FEED) })), 400, 'Send at most 20 care tasks.')
    await expectError(await send(page, bookingBody(ids, { tasks: [{ ...FEED, category: 'bath' }] })), 400, '"bath" is not a task type.')
  })

  test('a task needs a description and 1 to 10 times a day', async ({ page }) => {
    await expectError(await send(page, bookingBody(ids, { tasks: [{ ...FEED, title: ' ' }] })), 400, 'Every care task needs a description.')
    for (const dailyFrequency of [0, 11, 1.5]) {
      await expectError(await send(page, bookingBody(ids, { tasks: [{ ...FEED, dailyFrequency }] })), 400, 'Times per day must be a whole number from 1 to 10.')
    }
  })

  test('a task for a pet that is not in the booking is refused', async ({ page }) => {
    // the booking is only for Mochi, the task is for Luna
    await expectError(await send(page, bookingBody(ids, { tasks: [{ ...FEED, petIds: [ids.luna] }] })), 400, 'A care task can only be for a pet in this booking.')
  })

  test('a walk task needs a real route of yours, or "follow my instructions"', async ({ page }) => {
    const walk = { category: 'walk', title: 'Walk around the block', dailyFrequency: 1 }
    await expectError(await send(page, bookingBody(ids, { tasks: [walk] })), 400, 'Choose a route for each walk task')
    await expectError(await send(page, bookingBody(ids, { tasks: [{ ...walk, walkRouteId: '000000000000000000000000' }] })), 400, 'That walking route was not found.')
  })

  test('a task day outside the booking, or a booked day with no task, is refused', async ({ page }) => {
    const twoDays = { startDate: day(24), endDate: day(25) }
    await expectError(await send(page, bookingBody(ids, { ...twoDays, tasks: [{ ...FEED, days: [day(26)] }] })), 400, 'is on a day outside this booking.')
    await expectError(await send(page, bookingBody(ids, { ...twoDays, tasks: [{ ...FEED, days: [day(24)] }] })), 400, `${day(25)} has no tasks.`)
  })

  test('the price is worked out by the server: Walk $20 × 2 + Feed $8 = $48', async ({ page }) => {
    const tasks = [{ category: 'walk', title: 'Free walk', dailyFrequency: 2, walkRouteId: 'instructions' }, FEED]
    const res = await send(page, bookingBody(ids, { tasks, totalPrice: 1 })) // a fake totalPrice from the page is ignored
    expect(res.status()).toBe(201)
    const booking = await res.json()
    expect(booking.totalPrice).toBe(48)
    expect(booking.status).toBe('pending')
    await cleanUp(page.request, booking._id)
  })

  test('P12: several days with different hours each day', async ({ page }) => {
    // day 24: 9am–12pm, day 25: 2pm–6pm. Feed once a day = $8 × 2 days = $16
    const body = bookingBody(ids, {
      startDate: day(24),
      endDate: day(25),
      dayTimes: [
        { date: day(24), startTime: '09:00', endTime: '12:00' },
        { date: day(25), startTime: '14:00', endTime: '18:00' }
      ]
    })
    const res = await send(page, body)
    expect(res.status()).toBe(201)
    const booking = await res.json()
    expect(booking.days).toBe(2)
    expect(booking.dayTimes.map((d) => `${d.startTime}-${d.endTime}`)).toEqual(['09:00-12:00', '14:00-18:00'])
    expect(booking.totalPrice).toBe(16)
    await cleanUp(page.request, booking._id)
  })
})
