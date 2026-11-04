// Feature list section 6: care details (PATCH /api/bookings/:id/care-details), and P6 "care details added later".
// Uses the seed's CONFIRMED booking 5 days from now (Mochi + Luna with SeedSitter).
import { test, expect } from '@playwright/test'
import { AUTH, apiAs, seedData, SEED, day, bookingBody, createBooking, cleanUp, expectError } from './helpers.js'

test.use({ storageState: AUTH.owner })

let ids, bookingId, feed
test.beforeAll(async ({ browser }) => {
  const { context, api } = await apiAs(browser, 'owner')
  ids = await seedData(api)
  bookingId = ids.booking(SEED.confirmedIn5Days)
  const { items } = await (await api.get(`/api/bookings/${bookingId}/care-tasks`)).json()
  feed = items.find((t) => t.category === 'feed') // a Feed task, twice a day
  await context.close()
})

// sends care details for the Feed task only
const saveFeed = (page, details) =>
  page.request.patch(`/api/bookings/${bookingId}/care-details`, { data: { tasks: [{ taskId: feed._id, details }] } })

test.describe('Care details: server rules (API)', () => {
  test('only a confirmed booking can get care details', async ({ page }) => {
    // a fresh pending request
    const pending = await createBooking(page.request, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    const res = await page.request.patch(`/api/bookings/${pending}/care-details`, { data: { tasks: [] } })
    await expectError(res, 400, 'Care details can only be changed on a confirmed booking')
    await cleanUp(page.request, pending)
  })

  test('they are locked once the first session has started (in progress)', async ({ page }) => {
    const res = await page.request.patch(`/api/bookings/${ids.booking(SEED.inProgressToday)}/care-details`, { data: { tasks: [] } })
    await expectError(res, 400, 'Care details can only be changed on a confirmed booking, before the first session starts.')
  })

  test('the list must be a list of up to 20 tasks', async ({ page }) => {
    const url = `/api/bookings/${bookingId}/care-details`
    await expectError(await page.request.patch(url, { data: { tasks: 'nope' } }), 400, 'Send a list of up to 20 tasks.')
    await expectError(await page.request.patch(url, { data: { tasks: Array(21).fill({ taskId: feed._id }) } }), 400, 'Send a list of up to 20 tasks.')
  })

  test('an unknown task → 404', async ({ page }) => {
    const res = await page.request.patch(`/api/bookings/${bookingId}/care-details`, { data: { tasks: [{ taskId: '000000000000000000000000', details: {} }] } })
    await expectError(res, 404, 'Task not found.')
  })

  test('times must be HH:MM, one for each time a day (or none)', async ({ page }) => {
    await expectError(await saveFeed(page, { times: ['8am', '6pm'] }), 400, 'Choose each time as HH:MM.')
    await expectError(await saveFeed(page, { times: ['08:00'] }), 400, `needs ${feed.dailyFrequency} time(s), or none.`)
  })

  test('the food amount must be 0 or more, and the unit one of the list', async ({ page }) => {
    await expectError(await saveFeed(page, { amount: -1 }), 400, 'The amount must be a number, 0 or more.')
    await expectError(await saveFeed(page, { unit: 'bucket' }), 400, 'The unit must be one of:')
  })

  test('instructions up to 1000 characters, other text up to 100', async ({ page }) => {
    await expectError(await saveFeed(page, { instructions: 'x'.repeat(1001) }), 400, 'Instructions can be up to 1000 characters.')
    await expectError(await saveFeed(page, { food: 'x'.repeat(101) }), 400, 'Food, medicine and dosage can be up to 100 characters.')
  })

  test('a sitter or another owner cannot change them', async ({ browser }) => {
    const { context, api } = await apiAs(browser, 'sitter')
    await expectError(await api.patch(`/api/bookings/${bookingId}/care-details`, { data: { tasks: [] } }), 403, 'Owners only.')
    await context.close()
  })

  test('valid details are saved, and the task (and so the price) stays the same', async ({ page }) => {
    const before = await (await page.request.get(`/api/bookings/${bookingId}`)).json()
    const res = await saveFeed(page, { times: Array(feed.dailyFrequency).fill('08:00'), food: 'kibble', amount: 1, unit: 'cup', instructions: 'Top up the water too.' })
    expect(res.status()).toBe(200)
    const saved = await res.json()
    expect(saved.detailsSavedAt).not.toBeNull()
    const task = saved.items.find((t) => t._id === feed._id)
    expect(task.details.food).toBe('kibble')
    expect(task.category).toBe('feed')
    expect(task.dailyFrequency).toBe(feed.dailyFrequency)
    const after = await (await page.request.get(`/api/bookings/${bookingId}`)).json()
    expect(after.totalPrice).toBe(before.totalPrice)
  })
})

test.describe('Care details on the page (P6)', () => {
  test('the Booking Detail page shows the Care details card', async ({ page }) => {
    await page.goto(`/bookings/${bookingId}`)
    await expect(page.getByRole('heading', { name: 'Care details' })).toBeVisible()
  })
})
