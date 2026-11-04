// Feature list section 11: notifications.
// TC-14 already checks that the owner is notified when a sitter accepts.
import { test, expect } from '@playwright/test'
import { apiAs, newUser, seedData, SEED, day, bookingBody, createBooking, cleanUp, expectError, registerInBrowser } from './helpers.js'

let owner, ids
test.beforeAll(async ({ browser }) => {
  owner = await apiAs(browser, 'owner')
  ids = await seedData(owner.api)
})
test.afterAll(async () => {
  await owner.context.close()
})

const notify = (who, data) => who.api.post('/api/notifications', { data })

test.describe('Sending a notification: server rules (API)', () => {
  test('an unknown type is refused', async () => {
    await expectError(await notify(owner, { bookingId: ids.booking(SEED.paid), type: 'party-time', message: 'hi' }), 400, 'Unknown or unsupported booking notification type')
  })

  test('an empty or over-300-character message is refused', async () => {
    const base = { bookingId: ids.booking(SEED.paid), type: 'booking-requested' }
    await expectError(await notify(owner, { ...base, message: '  ' }), 400, 'Message is required')
    await expectError(await notify(owner, { ...base, message: 'x'.repeat(301) }), 400, 'Message must be 300 characters or fewer')
  })

  test('a bad booking id is refused', async () => {
    await expectError(await notify(owner, { bookingId: 'abc', type: 'booking-requested', message: 'hi' }), 400, 'A valid bookingId is required')
  })

  test('someone who is not on the booking → 403', async ({ browser }) => {
    const stranger = await newUser(browser)
    await expectError(await notify(stranger, { bookingId: ids.booking(SEED.paid), type: 'booking-requested', message: 'hi' }), 403, 'You are not part of this booking')
    await stranger.context.close()
  })

  test("a type that doesn't match the booking's status → 409 (a notification can't be faked)", async () => {
    // the OWNER claiming "the sitter accepted" on a pending request
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    await expectError(await notify(owner, { bookingId: id, type: 'booking-accepted', message: 'Accepted!' }), 409, 'That notification does not match the booking state.')
    await cleanUp(owner.api, id)
  })

  test('a payment notification needs a completed or paid booking', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    await expectError(await owner.api.post('/api/notifications/payment', { data: { bookingId: id } }), 400, 'No payment notification for a pending booking')
    await cleanUp(owner.api, id)
  })
})

test.describe('Reading notifications', () => {
  test("you can't mark someone else's notification as read → 404", async () => {
    await expectError(await owner.api.patch('/api/notifications/000000000000000000000000/read'), 404, 'Notification not found')
  })

  test('Mark all as read sets the unread count to 0 (API)', async () => {
    expect((await owner.api.patch('/api/notifications/read-all')).status()).toBe(200)
    const { count } = await (await owner.api.get('/api/notifications/unread-count')).json()
    expect(count).toBe(0)
  })

  test('a new user sees "No notifications yet." and both buttons are off', async ({ page }) => {
    await registerInBrowser(page, 'owner')
    await page.goto('/notifications')
    await expect(page.getByText('No notifications yet.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark all as read' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeDisabled()
  })

  test('the owner is told when their request was sent (booking-request-sent)', async () => {
    // setup: a new request, and the "requested" notification the page sends after it
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    const res = await notify(owner, { bookingId: id, type: 'booking-requested', message: 'SeedOwner sent you a booking request.' })
    expect(res.status()).toBe(201)
    // assert: the owner got the confirmation copy
    const list = await (await owner.api.get('/api/notifications')).json()
    const sent = list.find((n) => n.type === 'booking-request-sent' && String(n.booking?._id ?? n.booking) === id)
    expect(sent?.message).toBe('Your booking request was sent to the sitter.')
    // sending it twice doesn't make a second one
    const again = await notify(owner, { bookingId: id, type: 'booking-requested', message: 'SeedOwner sent you a booking request.' })
    expect(again.status()).toBe(200)
    await cleanUp(owner.api, id)
  })
})
