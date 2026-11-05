// Feature list section 5: accept / decline / confirm / withdraw / cancel, plus paths P3 (declined), P4 (expired), P5 (cancellation).
// TC-08 (accept), TC-09 (decline) and TC-10 (confirm) cover the normal button presses.
//
// Each test makes its OWN fresh booking requests (days 16–19) and cleans them up, so the seeded requests other tests use are never touched.
import { test, expect } from '@playwright/test'
import {
  apiAs, newUser, seedData, SEED, day, bookingBody, createBooking, cleanUp, expectError,
  closeDb, moveBooking, endedAgo, runScheduledJobs, notificationsOf
} from './helpers.js'

let owner, sitter, sitter2, ids

// One logged-in API client per user for the whole file
test.beforeAll(async ({ browser }) => {
  owner = await apiAs(browser, 'owner')
  sitter = await apiAs(browser, 'sitter')
  sitter2 = await apiAs(browser, 'sitter2')
  ids = await seedData(owner.api)
})
test.afterAll(async () => {
  await owner.context.close()
  await sitter.context.close()
  await sitter2.context.close()
  await closeDb()
})

const setStatus = (who, id, status) => who.api.patch(`/api/bookings/${id}/status`, { data: { status } })
const confirm = (who, id) => who.api.patch(`/api/bookings/${id}/confirm`)
const cancel = (who, id, reason) => who.api.patch(`/api/bookings/${id}/cancel`, { data: { reason } })

test.describe('Accept and decline (sitter)', () => {
  test('only a pending request can be accepted; only pending or accepted can be declined', async () => {
    const paid = ids.booking(SEED.paid) // SeedSitter's paid booking
    await expectError(await setStatus(sitter, paid, 'accepted'), 400, 'Only pending bookings can be accepted. This one is paid.')
    await expectError(await setStatus(sitter, paid, 'declined'), 400, 'Only pending or accepted bookings can be declined. This one is paid.')
  })

  test('an owner cannot accept, and the status must be accepted or declined', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    await expectError(await setStatus(owner, id, 'accepted'), 403, 'Only sitters can accept or decline bookings')
    await expectError(await setStatus(sitter2, id, 'maybe'), 400, "Status must be 'accepted' or 'declined'")
    await expectError(await setStatus(sitter, id, 'accepted'), 403, 'This booking is not yours') // a different sitter
    await cleanUp(owner.api, id)
  })

  test('accepting a request that overlaps one you already accepted → 409', async () => {
    // setup: two requests to SecondSitter on day 16: 9am–12pm (Mochi) and 10–11am (Luna)
    const first = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    const second = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16), petIds: [ids.luna], startTime: '10:00', endTime: '11:00' }))
    // actions + assert
    expect((await setStatus(sitter2, first, 'accepted')).status()).toBe(200)
    await expectError(await setStatus(sitter2, second, 'accepted'), 409, "so you can't accept this overlapping request.")
    await cleanUp(owner.api, first, second)
  })

  test('P3: a declined request shows as declined for the owner', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(19), endDate: day(19), startTime: '15:00', endTime: '16:00' }))
    expect((await setStatus(sitter2, id, 'declined')).status()).toBe(200)
    const booking = await (await owner.api.get(`/api/bookings/${id}`)).json()
    expect(booking.status).toBe('declined')
  })

  test('declining a request you already accepted is allowed (until the owner confirms)', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(19), endDate: day(19), startTime: '17:00', endTime: '18:00' }))
    expect((await setStatus(sitter2, id, 'accepted')).status()).toBe(200)
    expect((await setStatus(sitter2, id, 'declined')).status()).toBe(200)
  })
})

test.describe('Confirm (owner)', () => {
  test('only an accepted booking can be confirmed, and only by its owner', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(17), endDate: day(17) }))
    await expectError(await confirm(owner, id), 400, 'Only bookings the sitter has accepted can be confirmed. This one is pending.')
    await expectError(await confirm(sitter2, id), 403, 'Only owners can confirm bookings')
    await cleanUp(owner.api, id)
  })

  test('the same pet cannot be confirmed twice at the same time, but a different pet can', async () => {
    // setup: Mochi with SecondSitter 9am–12pm on day 18, confirmed
    const mochiA = await createBooking(owner.api, bookingBody(ids, { startDate: day(18), endDate: day(18) }))
    expect((await setStatus(sitter2, mochiA, 'accepted')).status()).toBe(200)
    expect((await confirm(owner, mochiA)).status()).toBe(200)

    // Mochi again with SeedSitter 10–11am the same day → 409
    const mochiB = await createBooking(owner.api, bookingBody(ids, { sitterId: ids.seedSitter, startDate: day(18), endDate: day(18), startTime: '10:00', endTime: '11:00' }))
    expect((await setStatus(sitter, mochiB, 'accepted')).status()).toBe(200)
    await expectError(await confirm(owner, mochiB), 409, 'Cancel that one first.')
    await cleanUp(owner.api, mochiB)

    // Luna with SeedSitter at the same time → fine
    const luna = await createBooking(owner.api, bookingBody(ids, { sitterId: ids.seedSitter, petIds: [ids.luna], startDate: day(18), endDate: day(18), startTime: '10:00', endTime: '11:00' }))
    expect((await setStatus(sitter, luna, 'accepted')).status()).toBe(200)
    expect((await confirm(owner, luna)).status()).toBe(200)

    await cleanUp(owner.api, mochiA, luna)
  })
})

test.describe('Withdraw and cancel (P5)', () => {
  test('a reason is required, and at most 300 characters', async () => {
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(19), endDate: day(19) }))
    await expectError(await cancel(owner, id, '   '), 400, 'Please give a reason for cancelling.')
    await expectError(await cancel(owner, id, 'x'.repeat(301)), 400, 'The reason can be at most 300 characters.')
    // a real withdraw
    const res = await cancel(owner, id, 'Plans changed')
    expect(res.status()).toBe(200)
    const booking = await res.json()
    expect(booking.status).toBe('cancelled')
    expect(booking.cancelledBy).toBe('owner')
    expect(booking.cancelReason).toBe('Plans changed')
  })

  test('paid, completed and in-progress bookings cannot be cancelled', async () => {
    await expectError(await cancel(owner, ids.booking(SEED.paid), 'Changed my mind'), 400, 'This one is paid.')
    await expectError(await cancel(owner, ids.booking(SEED.completed), 'Changed my mind'), 400, 'This one is completed.')
  })

  test('another user cannot cancel your booking', async () => {
    await expectError(await cancel(sitter2, ids.booking(SEED.paid), 'Not mine'), 403, 'This booking is not yours.')
  })

  test('the sitter cancels a confirmed booking: the owner sees who cancelled and why', async ({ browser }) => {
    // setup: a confirmed booking with SecondSitter on day 19, 1–2pm
    const id = await createBooking(owner.api, bookingBody(ids, { startDate: day(19), endDate: day(19), startTime: '13:00', endTime: '14:00' }))
    expect((await setStatus(sitter2, id, 'accepted')).status()).toBe(200)
    expect((await confirm(owner, id)).status()).toBe(200)
    // actions
    const res = await cancel(sitter2, id, 'I am unwell that day')
    expect(res.status()).toBe(200)
    expect((await res.json()).cancelledBy).toBe('sitter')
    // assert on the owner's Booking Detail page: the cancelled banner shows the reason
    const page = await owner.context.newPage()
    await page.goto(`/bookings/${id}`)
    await expect(page.getByText('The sitter cancelled this booking.')).toBeVisible()
    await expect(page.getByText('I am unwell that day')).toBeVisible()
    await page.close()
  })
})

// A brand-new owner with one pet, and a request of theirs to SecondSitter (day 16, 9am to 12pm).
// Used by tests that move a booking's start into the past, so SeedOwner's bookings and pets are never touched.
async function newOwnerRequest(browser) {
  const newOwner = await newUser(browser, 'owner')
  const pet = await newOwner.api.post('/api/pets', { multipart: { name: 'Pepper', species: 'Dog' } })
  const petId = (await pet.json())._id
  const id = await createBooking(newOwner.api, bookingBody(ids, { petIds: [petId], startDate: day(16), endDate: day(16) }))
  return { newOwner, id }
}
// Moves the booking's hours into the past in the test database: it started 1.5 to 2 hours ago
const startedAlready = (id) => moveBooking(id, [endedAgo(30)])

test.describe('After the start time has passed', () => {
  test('an accepted request can no longer be confirmed or cancelled', async ({ browser }) => {
    const { newOwner, id } = await newOwnerRequest(browser)
    expect((await setStatus(sitter2, id, 'accepted')).status()).toBe(200)
    await startedAlready(id)
    await expectError(await confirm(newOwner, id), 400, 'The start time has already passed, so this booking can no longer be confirmed.')
    await expectError(await cancel(newOwner, id, 'Too late'), 400, 'This booking has already started, so it can no longer be cancelled.')
    await newOwner.context.close()
  })

  test('a confirmed booking can no longer be cancelled, by the owner or the sitter', async ({ browser }) => {
    const { newOwner, id } = await newOwnerRequest(browser)
    expect((await setStatus(sitter2, id, 'accepted')).status()).toBe(200)
    expect((await confirm(newOwner, id)).status()).toBe(200)
    await startedAlready(id)
    await expectError(await cancel(newOwner, id, 'Changed my mind'), 400, 'This booking has already started, so it can no longer be cancelled.')
    await expectError(await cancel(sitter2, id, 'Feeling unwell'), 400, 'This booking has already started, so it can no longer be cancelled.')
    await newOwner.context.close()
  })
})

test.describe('Expired requests (P4)', () => {
  // The server checks for these every 5 minutes. The tests' server has that timer off, so these tests move a request's
  // start into the past in the test database, then run the check themselves (runScheduledJobs).
  test('a pending request whose start time passes expires, and the owner is told', async ({ browser }) => {
    const { newOwner, id } = await newOwnerRequest(browser)
    await startedAlready(id)
    await runScheduledJobs(newOwner.api)
    expect((await (await newOwner.api.get(`/api/bookings/${id}`)).json()).status).toBe('expired')
    const notes = await notificationsOf(newOwner.api)
    expect(notes.some((n) => n.type === 'booking-expired' && n.booking === id)).toBeTruthy()
    await newOwner.context.close()
  })

  test('an accepted request the owner never confirmed expires too', async ({ browser }) => {
    const { newOwner, id } = await newOwnerRequest(browser)
    expect((await setStatus(sitter2, id, 'accepted')).status()).toBe(200)
    await startedAlready(id)
    await runScheduledJobs(newOwner.api)
    expect((await (await newOwner.api.get(`/api/bookings/${id}`)).json()).status).toBe('expired')
    await newOwner.context.close()
  })

  test('a request whose start is still to come, and a confirmed booking, do not expire', async ({ browser }) => {
    const later = await newOwnerRequest(browser) // day 16: still to come
    const started = await newOwnerRequest(browser)
    expect((await setStatus(sitter2, started.id, 'accepted')).status()).toBe(200)
    expect((await confirm(started.newOwner, started.id)).status()).toBe(200)
    await startedAlready(started.id) // confirmed, and started: the sitter starts the session from here
    await runScheduledJobs(later.newOwner.api)
    expect((await (await later.newOwner.api.get(`/api/bookings/${later.id}`)).json()).status).toBe('pending')
    expect((await (await started.newOwner.api.get(`/api/bookings/${started.id}`)).json()).status).toBe('confirmed')
    await cleanUp(later.newOwner.api, later.id)
    await later.newOwner.context.close()
    await started.newOwner.context.close()
  })

  test('an expired booking shows as Expired', async () => {
    const page = await owner.context.newPage()
    await page.goto(`/bookings/${ids.booking(SEED.expired)}`)
    await expect(page.getByText('This booking is no longer valid: its start time has passed.')).toBeVisible()
    await page.close()
  })
})
