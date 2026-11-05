// Care reports: the owner's "Recently ended" list (GET /api/visits/recent), one booking's reports
// (GET /api/visits/booking/:id/report), the location records a report shows, and View report on the Today card.
// The report window's wording is checked by the component tests (client/src/components/__tests__); these check
// the server rules and that the pages show what the server sends.
import { test, expect } from '@playwright/test'
import {
  AUTH, apiAs, seedData, SEED, HOME, day, expectError, newUser,
  sessionBooking, startAtHome, testDb, closeDb, oid, moveBooking
} from './helpers.js'

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

const DAY_MS = 24 * 60 * 60 * 1000
const recent = async (who) => (await (await who.api.get('/api/visits/recent')).json()).bookings
const endSession = (b, visitId) => b.sitter.api.post(`/api/visits/${visitId}/end`, { data: { notes: 'All good today.' } })
// A finished one-day booking with one session, between a new owner and a new sitter
async function finishedBooking(browser) {
  const b = await sessionBooking(browser)
  const visitId = await startAtHome(b.sitter, b.bookingId)
  expect((await endSession(b, visitId)).status()).toBe(200)
  return { ...b, visitId }
}
// Moves a finished booking and its session to `n` days from today, 9am to 12pm
const moveTo = (b, n) => moveBooking(b.bookingId, [{ date: day(n), startTime: '09:00', endTime: '12:00' }], { [b.visitId]: day(n) })

// ---------- 13. Recently ended ----------

test.describe('Recently ended: GET /api/visits/recent', () => {
  test('owners only', async () => {
    await expectError(await sitter.api.get('/api/visits/recent'), 403, 'Owners only.')
  })

  test("SeedOwner's list: finished bookings from the last 30 days that had a session, newest first", async () => {
    const list = await recent(owner)
    expect(list.length).toBeGreaterThan(0)
    for (const e of list) {
      expect(['completed', 'paid']).toContain(e.booking.status)
      expect(e.endedAt).toBeGreaterThanOrEqual(Date.now() - 30 * DAY_MS)
      expect(e.days.length).toBeGreaterThan(0)
    }
    const ends = list.map((e) => e.endedAt)
    expect(ends).toEqual([...ends].sort((a, b) => b - a))
    // the seed's "Done and paid" and "Done, waiting for payment" bookings never had a session, so they're left out
    const shown = list.map((e) => e.booking._id)
    expect(shown).not.toContain(ids.booking(SEED.paid))
    expect(shown).not.toContain(ids.booking(SEED.completed))
  })

  test('a booking stays on the list for 30 days after it ends, then leaves it', async ({ browser }) => {
    const b = await finishedBooking(browser)
    expect((await recent(b.owner)).map((e) => e.booking._id)).toEqual([b.bookingId])
    await moveTo(b, -29)
    expect(await recent(b.owner)).toHaveLength(1)
    await moveTo(b, -31)
    expect(await recent(b.owner)).toHaveLength(0)
    await b.close()
  })

  test('a finished booking that never had a session is left out', async ({ browser }) => {
    const b = await sessionBooking(browser, { status: 'completed' })
    expect(await recent(b.owner)).toHaveLength(0)
    await b.close()
  })

  test('a booking still in progress is not on it yet', async ({ browser }) => {
    const b = await sessionBooking(browser, { days: [0, 1] })
    const visitId = await startAtHome(b.sitter, b.bookingId)
    await endSession(b, visitId) // day 1 of 2: the booking stays in progress
    expect(await recent(b.owner)).toHaveLength(0)
    await b.close()
  })

  test("another owner's bookings never show", async ({ browser }) => {
    const b = await finishedBooking(browser)
    expect((await recent(owner)).map((e) => e.booking._id)).not.toContain(b.bookingId)
    await b.close()
  })
})

// ---------- 14. One booking's reports ----------

test.describe("A booking's reports: GET /api/visits/booking/:id/report", () => {
  let b
  test.beforeAll(async ({ browser }) => {
    b = await finishedBooking(browser)
  })
  test.afterAll(async () => b.close())
  const report = (who, id = b.bookingId) => who.api.get(`/api/visits/booking/${id}/report`)

  test("the booking's owner gets its reports", async () => {
    const res = await report(b.owner)
    expect(res.status()).toBe(200)
    const entry = await res.json()
    expect(entry.booking._id).toBe(b.bookingId)
    expect(entry.days).toHaveLength(1)
    expect(entry.days[0].visit.report.notes).toBe('All good today.')
  })

  test("the booking's own sitter is refused", async () => {
    await expectError(await report(b.sitter), 403, 'Only the owner of this booking can see its reports.')
  })

  test('other owners and other sitters are refused', async ({ browser }) => {
    await expectError(await report(owner), 403, 'Only the owner of this booking can see its reports.')
    await expectError(await report(sitter), 403, 'Only the owner of this booking can see its reports.')
    const stranger = await newUser(browser, 'owner')
    await expectError(await report(stranger), 403, 'Only the owner of this booking can see its reports.')
    await stranger.context.close()
  })

  test('a bad or unknown booking id → 404', async () => {
    await expectError(await report(b.owner, 'nope'), 404, 'Booking not found.')
    await expectError(await report(b.owner, '000000000000000000000000'), 404, 'Booking not found.')
  })
})

// ---------- 16. The location records a report shows ----------

test.describe.serial('Left home without a walk, and location gaps', () => {
  let b, visitId
  const AWAY = [HOME[0], HOME[1] + 0.002] // about 220 m from the home
  const send = (body) => b.sitter.api.post(`/api/visits/${visitId}/location`, { data: body })

  test.beforeAll(async ({ browser }) => {
    b = await sessionBooking(browser)
    visitId = await startAtHome(b.sitter, b.bookingId)
  })
  test.afterAll(async () => b.close())

  test('the server records them from the location updates', async () => {
    // 3 updates in a row away from the home, not on a walk, then back
    for (let i = 0; i < 3; i++) await send({ location: AWAY, accuracy: 10 })
    await send({ location: HOME, accuracy: 10 })
    // the app was closed for 5 minutes: move the last update back in the database, then send the next one
    const db = await testDb()
    await db.collection('visitsessions').updateOne({ _id: oid(visitId) }, { $set: { 'lastLocation.at': new Date(Date.now() - 5 * 60 * 1000) } })
    await send({ location: HOME, accuracy: 10 })
    // location switched off, then on again
    await send({ blocked: true })
    await send({ location: HOME, accuracy: 10 })

    expect((await endSession(b, visitId)).status()).toBe(200)
    const entry = await (await b.owner.api.get(`/api/visits/booking/${b.bookingId}/report`)).json()
    const visit = entry.days[0].visit
    expect(visit.awayEpisodes).toHaveLength(1)
    expect(visit.awayEpisodes[0].maxDistanceM).toBeGreaterThan(200)
    expect(visit.awayEpisodes[0].endedAt).toBeTruthy()
    expect(visit.locationGaps.map((g) => [g.reason, g.resumedAtHome])).toEqual([['stopped', true], ['blocked', true]])
    // the report never sends the sitter's position or the home
    expect(visit.lastLocation).toBeUndefined()
    expect(visit.home).toBeUndefined()
  })

  test("the owner's report window shows them", async () => {
    const page = await b.owner.context.newPage()
    await page.goto('/session')
    await page.getByRole('button', { name: /Day 1/ }).first().click() // the day's row under Recently ended
    const report = page.getByRole('dialog')
    await expect(report.getByText('Left home, not on a walk').first()).toBeVisible()
    await expect(report.getByText(/Location gap · \d+ min/).first()).toBeVisible()
    await page.close()
  })
})

// ---------- 15. View report on the owner's Today card ----------

test.describe("View report on the owner's Today card", () => {
  test.use({ storageState: AUTH.owner })

  // The seed's "Mornings for three days" (SeedSitter, Mochi, 9am to 12pm): today is day 2 of 3 and its session has finished.
  // SeedOwner has several sessions today, so it's picked from the "Session 1 of 4" list first.
  async function openMornings(page) {
    await page.goto('/session')
    await page.getByRole('button', { name: /^Session \d+ of \d+/ }).click()
    await page.getByRole('list', { name: "Today's sessions" }).getByRole('button').filter({ hasText: '09:00 – 12:00' }).click()
    await expect(page.getByText('Day 2 of 3').first()).toBeVisible()
  }

  test("opens today's report, and Prev shows the earlier day's report", async ({ page }) => {
    await openMornings(page)
    await page.getByRole('button', { name: 'View report' }).click()
    const report = page.getByRole('dialog')
    await expect(report.getByRole('heading', { level: 2 })).toContainText('Day 2')
    await expect(report.getByText('Mochi skipped her second meal.')).toBeVisible()

    await report.getByRole('button', { name: /Prev/ }).click()
    await expect(report.getByRole('heading', { level: 2 })).toContainText('Day 1')
    await expect(report.getByText('Good morning.')).toBeVisible()
    await expect(report.getByRole('button', { name: /Prev/ })).toBeDisabled() // day 1 is the first

    await report.getByRole('button', { name: 'Close report' }).first().press('Escape')
    await expect(report).toBeHidden()
  })

  test("a finished day that isn't the booking's last shows Completed, with View report", async ({ page }) => {
    await openMornings(page)
    await expect(page.getByText('Completed').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'View report' })).toBeVisible()
  })
})
