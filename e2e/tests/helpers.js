// Steps and data that several tests share, so they're written once.
import { expect } from '@playwright/test'
import { MongoClient, ObjectId } from 'mongodb'
import { E2E_DB, E2E_MONGO_URI, CRON_SECRET } from '../e2eEnv.js'

// ---------- Logins ----------

// The saved logins made by auth.setup.js
export const AUTH = {
  owner: 'playwright/.auth/owner.json', // SeedOwner (pets Mochi and Luna)
  sitter: 'playwright/.auth/sitter.json', // SeedSitter
  sitter2: 'playwright/.auth/sitter2.json' // SecondSitter
}
export const PASSWORD = 'Password123!'

// A logged-in "API client" for one of the seed users.
// `api.get('/api/pets')` etc. sends the request with that user's login cookie.
// Remember to call `context.close()` when you are done with it.
export async function apiAs(browser, who) {
  const context = await browser.newContext({ storageState: AUTH[who] })
  return { context, api: context.request }
}

// Signs up a brand-new user (a new email every time) and returns a logged-in API client for them.
// Used for "someone else's booking / pet / route" tests, and so tests never change the seed users' passwords.
export async function newUser(browser, role = 'owner') {
  // An EMPTY storageState on purpose. Without it, browser.newContext() copies the file's test.use({ storageState })
  // login, and signing up on that cookie would turn SeedOwner's server session into this new user.
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } }) // starts logged out
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  const user = { username: `e2e_${role}_${unique}`, email: `e2e_${unique}@test.com`, password: PASSWORD }
  const res = await context.request.post('/api/auth/register', {
    data: { ...user, confirmPassword: PASSWORD, role }
  })
  expect(res.status(), await res.text()).toBe(201) // registering also logs this client in
  return { context, api: context.request, ...user }
}

// Checks an API answer: the status code, and that the message contains `text`
export async function expectError(res, status, text) {
  const body = await res.json().catch(() => ({}))
  expect(res.status(), JSON.stringify(body)).toBe(status)
  expect(body.message ?? '').toContain(text)
}

// ---------- Seed data ----------

// SeedOwner's home (SMU) as [longitude, latitude], and a point a few km away
export const HOME = [103.85, 1.2965]
export const FAR = [103.9, 1.35]

// 'YYYY-MM-DD' for n days from today, in Singapore time (the app works in Singapore time)
export function day(n) {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
}

// The ids tests need, read from the API as SeedOwner (ids change every time the seed runs)
export async function seedData(ownerApi) {
  const pets = await (await ownerApi.get('/api/pets')).json()
  const sitters = await (await ownerApi.get('/api/sitters')).json()
  const bookings = await (await ownerApi.get('/api/bookings')).json()
  const me = await (await ownerApi.get('/api/auth/me')).json()

  const petId = (name) => pets.find((p) => p.name === name)._id
  const sitterId = (name) => sitters.find((s) => s.username === name)._id
  return {
    ownerId: me._id,
    mochi: petId('Mochi'),
    luna: petId('Luna'),
    seedSitter: sitterId('SeedSitter'),
    secondSitter: sitterId('SecondSitter'),
    // a seed booking, found by the words in its notes, e.g. booking('Done and paid')
    booking(noteText) {
      const b = bookings.find((x) => x.notes?.includes(noteText))
      if (!b) throw new Error(`No seed booking with notes "${noteText}". Run pnpm seed.`)
      return b._id
    }
  }
}

// The seed bookings these tests use, by the words in their notes
export const SEED = {
  paid: 'Done and paid', // SeedSitter, Mochi, 10 days ago, paid
  completed: 'Done, waiting for payment', // SeedSitter, Mochi, 3 days ago, completed
  confirmedIn5Days: 'Starts in 5 days', // SeedSitter, Mochi + Luna, confirmed
  walkTestToday: 'Walk test', // SeedSitter, Mochi, today 8pm–12am, confirmed
  inProgressToday: 'Session happening today', // SeedSitter, Luna, today 8am–8pm, in progress
  expired: 'Owner did not confirm in time' // SecondSitter, Luna, yesterday, expired
}

// ---------- Bookings ----------

// A simple care task (Feed $8 × 1 a day)
export const FEED = { category: 'feed', title: 'Feed 1 cup of kibble', dailyFrequency: 1 }

// The body for POST /api/bookings: one day, 9am–12pm, one Feed task, unless you change it
export function bookingBody(ids, overrides = {}) {
  const date = overrides.startDate ?? day(15)
  return {
    sitterId: ids.secondSitter,
    petIds: [ids.mochi],
    startDate: date,
    endDate: date,
    startTime: '09:00',
    endTime: '12:00',
    tasks: [FEED],
    notes: 'E2E test booking',
    ...overrides
  }
}

// Creates a booking request as the owner and returns its id
export async function createBooking(ownerApi, body) {
  const res = await ownerApi.post('/api/bookings', { data: body })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json())._id
}

// Withdraws / cancels a booking as the owner, so a test leaves nothing behind for other tests
export async function cleanUp(ownerApi, ...ids) {
  for (const id of ids) {
    await ownerApi.patch(`/api/bookings/${id}/cancel`, { data: { reason: 'E2E clean-up' } })
  }
}

// ---------- Pages ----------

// Owner home → search the sitter by name → View Profile
export async function openSitterProfile(page, sitterName) {
  await page.goto('/home')
  await page.getByPlaceholder('Search by sitter name').fill(sitterName)
  // wait until that sitter's card is showing, then open their profile
  await expect(page.getByRole('heading', { name: sitterName, exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'View Profile' }).first().click()
  await expect(page).toHaveURL(/\/users\//)
}

// ...then press Request Booking, which opens the booking form (its heading is "Book a sitter" since PR #56)
export async function openBookingForm(page, sitterName) {
  await openSitterProfile(page, sitterName)
  await page.getByRole('link', { name: 'Request Booking' }).click()
  await expect(page.getByRole('heading', { name: 'Book a sitter' })).toBeVisible()
}

// Signs up through the Register page (a new user every time) and lands on Home
export async function registerInBrowser(page, role = 'owner') {
  const unique = `${Date.now()}${Math.floor(Math.random() * 1000)}`
  await page.goto(`/register?role=${role}`)
  await page.getByPlaceholder('Username').fill(`e2e_${role}_${unique}`)
  await page.getByPlaceholder('Email').fill(`e2e_${unique}@test.com`)
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD)
  await page.getByPlaceholder('Confirm password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign up' }).click()
  await expect(page).toHaveURL(/\/home/)
}

// ---------- The test database and the scheduled checks ----------
// Some rules depend on the clock (sharing stops 30 minutes after the booked end, a forgotten session ends 6 hours
// after it, a request expires at its start time). Tests can't wait hours, so they move a booking's times into the
// past in the tests' own database (petsociety_e2e, never the demo data), then run the server's checks straight away.

let client = null
// The tests' own database. Call closeDb() in afterAll.
export async function testDb() {
  if (!client) client = await MongoClient.connect(E2E_MONGO_URI)
  const db = client.db()
  if (db.databaseName !== E2E_DB) throw new Error(`Refusing to change "${db.databaseName}": tests only change ${E2E_DB}`)
  return db
}
export async function closeDb() {
  await client?.close()
  client = null
}
export const oid = (id) => new ObjectId(String(id))

// Runs the server's scheduled checks now (expire old requests, end forgotten sessions), as Vercel Cron does
export async function runScheduledJobs(api) {
  const res = await api.get('/api/cron/daily', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
  expect(res.status(), await res.text()).toBe(200)
}

const MINUTE_MS = 60 * 1000
const sgtMidnight = (date) => new Date(`${date}T00:00:00+08:00`)
const hhmm = (minutes) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// The day and half-hour (Singapore time) that was `minutesAgo` minutes ago, rounded down to the half-hour,
// with a start time 1 hour before it on the same day: { date: 'YYYY-MM-DD', startTime, endTime }
export function endedAgo(minutesAgo) {
  const sg = new Date(Date.now() - minutesAgo * MINUTE_MS + 8 * 60 * MINUTE_MS) // Singapore wall clock, read as UTC
  const end = Math.floor((sg.getUTCHours() * 60 + sg.getUTCMinutes()) / 30) * 30
  return { date: sg.toISOString().slice(0, 10), startTime: hhmm(Math.max(0, end - 60)), endTime: hhmm(end) }
}

// Moves a booking (and its session, if given) to new days and hours in the test database.
// dayTimes: [{ date, startTime, endTime }, ...]. visitDates: { [visitId]: 'YYYY-MM-DD' }
export async function moveBooking(bookingId, dayTimes, visitDates = {}) {
  const db = await testDb()
  await db.collection('bookings').updateOne({ _id: oid(bookingId) }, {
    $set: {
      dayTimes,
      startDate: sgtMidnight(dayTimes[0].date),
      endDate: sgtMidnight(dayTimes.at(-1).date),
      startTime: dayTimes[0].startTime,
      endTime: dayTimes.at(-1).endTime
    }
  })
  for (const [visitId, date] of Object.entries(visitDates)) {
    await db.collection('visitsessions').updateOne({ _id: oid(visitId) }, { $set: { date } })
  }
}

// A booking between a brand-new owner and a brand-new sitter, written straight into the test database,
// so a test can start sessions on it without clashing with the seed users' sessions (a sitter has one at a time).
// The owner lives at HOME and has one pet, Biscuit.
//   days:   day offsets from today, e.g. [0, 1] = today and tomorrow (all 7am to 12am)
//   tasks:  the care checklist (`days` on a task are day offsets too). Default: Feed once a day.
//   status: default 'confirmed', ready to start
// Returns { owner, sitter, ownerId, sitterId, petId, bookingId, tasks, close() }
export async function sessionBooking(browser, { days = [0], tasks = [FEED], status = 'confirmed' } = {}) {
  const owner = await newUser(browser, 'owner')
  const sitter = await newUser(browser, 'sitter')
  const ownerId = (await (await owner.api.get('/api/auth/me')).json())._id
  const sitterId = (await (await sitter.api.get('/api/auth/me')).json())._id
  const pet = await owner.api.post('/api/pets', { multipart: { name: 'Biscuit', species: 'Dog' } })
  expect(pet.status(), await pet.text()).toBe(201)
  const petId = (await pet.json())._id

  const db = await testDb()
  await db.collection('users').updateOne({ _id: oid(ownerId) }, {
    $set: { 'ownerProfile.address': { line1: '81 Victoria Street', postalCode: '188065', location: { type: 'Point', coordinates: HOME } } }
  })
  const dayTimes = days.map((n) => ({ date: day(n), startTime: '07:00', endTime: '24:00' }))
  const now = new Date()
  const { insertedId: bookingId } = await db.collection('bookings').insertOne({
    ownerId: oid(ownerId), sitterId: oid(sitterId), petIds: [oid(petId)],
    startDate: sgtMidnight(dayTimes[0].date), endDate: sgtMidnight(dayTimes.at(-1).date),
    startTime: '07:00', endTime: '24:00', dayTimes,
    notes: 'E2E session booking', totalPrice: 50, status, createdAt: now, updatedAt: now
  })
  const items = tasks.map((t) => ({
    _id: new ObjectId(), petIds: [oid(petId)], ...t,
    ...(t.days ? { days: t.days.map((n) => day(n)) } : {})
  }))
  await db.collection('carechecklists').insertOne({ bookingId, items, detailsSavedAt: now, createdAt: now, updatedAt: now })

  return {
    owner, sitter, ownerId, sitterId, petId,
    bookingId: String(bookingId),
    tasks: items.map((t) => ({ ...t, _id: String(t._id) })),
    async close() {
      await owner.context.close()
      await sitter.context.close()
    }
  }
}

// Starts today's session at the home as the booking's sitter, and returns the session (visit) id
export async function startAtHome(sitter, bookingId) {
  const res = await sitter.api.post(`/api/visits/booking/${bookingId}/start`, { data: { location: HOME, accuracy: 10 } })
  expect(res.status(), await res.text()).toBe(201)
  return (await res.json())._id
}

// The notifications one user has, newest first
export async function notificationsOf(api) {
  return (await api.get('/api/notifications')).json()
}
