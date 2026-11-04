// Feature list section 9: record a route and My Routes (/api/walk-routes).
// A route is sent as points [longitude, latitude]. The phone's GPS is not needed for these.
import { test, expect } from '@playwright/test'
import { AUTH, HOME, FAR, newUser, expectError } from './helpers.js'

const NEAR = [HOME[0] + 0.0005, HOME[1] + 0.0005] // about 80 m from the home
const LOOP = [HOME, NEAR, HOME] // starts and ends at the home

test.use({ storageState: AUTH.owner })

const save = (page, data) => page.request.post('/api/walk-routes', { data })

test.describe('Walk routes: server rules (API)', () => {
  test('a route needs a name', async ({ page }) => {
    await expectError(await save(page, { name: ' ', path: LOOP }), 400, 'Give your route a name.')
  })

  test('a route needs at least 2 valid points', async ({ page }) => {
    await expectError(await save(page, { name: 'Tiny', path: [HOME] }), 400, 'A route needs at least 2 points.')
    // a point must be two numbers (the server does not check they are on Earth, so [999, 999] would pass this check)
    await expectError(await save(page, { name: 'Broken', path: [HOME, ['a', 'b']] }), 400, 'The route contains invalid points.')
  })

  test('a route must start and end at the home', async ({ page }) => {
    await expectError(await save(page, { name: 'From far', path: [FAR, HOME] }), 400, 'A route must start at your home.')
    await expectError(await save(page, { name: 'To far', path: [HOME, FAR] }), 400, 'A route must end at your home.')
  })

  test('an owner with no address saved is told to add one first', async ({ browser }) => {
    const stranger = await newUser(browser)
    await expectError(await stranger.api.post('/api/walk-routes', { data: { name: 'Loop', path: LOOP } }), 400, 'Add your address in Edit Profile before recording a route.')
    await stranger.context.close()
  })

  test('save, rename, refuse another owner, then delete', async ({ page, browser }) => {
    // setup: save a route
    const created = await save(page, { name: 'E2E loop', path: LOOP })
    expect(created.status()).toBe(201)
    const route = await created.json()

    // rename it (an empty name is refused)
    await expectError(await page.request.patch(`/api/walk-routes/${route._id}`, { data: { name: '' } }), 400, 'Give your route a name.')
    const renamed = await page.request.patch(`/api/walk-routes/${route._id}`, { data: { name: 'E2E loop (renamed)' } })
    expect(renamed.status()).toBe(200)
    expect((await renamed.json()).name).toBe('E2E loop (renamed)')

    // another owner can't see or delete it
    const stranger = await newUser(browser)
    await expectError(await stranger.api.get(`/api/walk-routes/${route._id}`), 404, 'Route not found')
    await expectError(await stranger.api.delete(`/api/walk-routes/${route._id}`), 404, 'Route not found')
    await stranger.context.close()

    // delete it
    const removed = await page.request.delete(`/api/walk-routes/${route._id}`)
    expect(removed.status()).toBe(200)
    await expectError(await page.request.get(`/api/walk-routes/${route._id}`), 404, 'Route not found')
  })

  test('a sitter cannot use My Routes', async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTH.sitter })
    await expectError(await context.request.get('/api/walk-routes'), 403, 'Owners only.')
    await context.close()
  })
})

test.describe('My Routes page', () => {
  test("shows the owner's saved route from the seed", async ({ page }) => {
    await page.goto('/owner/routes')
    await expect(page.getByText('SMU loop').first()).toBeVisible()
  })
})
