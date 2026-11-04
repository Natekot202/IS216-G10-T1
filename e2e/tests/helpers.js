// Steps and data that several tests share, so they're written once.
import { expect } from '@playwright/test'

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
