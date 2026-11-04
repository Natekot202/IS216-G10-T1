// Feature list section 4: the sitter's availability (PUT /api/availability/me).
// The server checks EVERY change before saving any, so these refused changes never touch the calendar.
import { test, expect } from '@playwright/test'
import { AUTH, day, expectError } from './helpers.js'

const RULE = 'Free time can only be between 7:00 am and 12:00 am, in half-hour steps, with no repeats.'

test.describe('Availability: server rules (API)', () => {
  test.use({ storageState: AUTH.sitter2 })

  const save = (page, changes) => page.request.put('/api/availability/me', { data: { changes } })

  test('an empty change list is refused', async ({ page }) => {
    await expectError(await save(page, []), 400, 'Send at least one change.')
  })

  test('a date that does not exist (30 Feb) is refused', async ({ page }) => {
    await expectError(await save(page, [{ date: '2027-02-30', status: 'available' }]), 400, '"2027-02-30" is not a valid date.')
  })

  test('a day in the past is refused', async ({ page }) => {
    const yesterday = day(-1)
    await expectError(await save(page, [{ date: yesterday, status: 'available' }]), 400, `${yesterday} is in the past.`)
  })

  test('free time before 7:00 am is refused', async ({ page }) => {
    await expectError(await save(page, [{ date: day(28), slots: [390] }]), 400, RULE) // 390 minutes = 6:30 am
  })

  test('free time that is not on the half-hour is refused', async ({ page }) => {
    await expectError(await save(page, [{ date: day(28), slots: [555] }]), 400, RULE) // 9:15 am
  })

  test('the same half-hour twice is refused', async ({ page }) => {
    await expectError(await save(page, [{ date: day(28), slots: [540, 540] }]), 400, RULE)
  })

  test('a status other than available or blocked is refused', async ({ page }) => {
    await expectError(await save(page, [{ date: day(28), status: 'maybe' }]), 400, 'Status must be "available" or "blocked".')
  })

  test('one bad day stops the whole save (nothing half-saved)', async ({ page }) => {
    // a good day and a bad day together
    const res = await save(page, [{ date: day(29), status: 'blocked' }, { date: 'oops', status: 'available' }])
    expect(res.status()).toBe(400)
    // the good day was NOT saved: day 29 is still available (the seed makes the next 30 days available)
    const days = await (await page.request.get('/api/availability/me')).json()
    const day29 = days.find((d) => d.date === day(29))
    expect(day29?.status).toBe('available')
  })
})

test.describe('Availability: owners', () => {
  test.use({ storageState: AUTH.owner })
  test("an owner can't change a calendar → 403", async ({ page }) => {
    await expectError(await page.request.put('/api/availability/me', { data: { changes: [] } }), 403, 'Sitters only.')
  })
})
