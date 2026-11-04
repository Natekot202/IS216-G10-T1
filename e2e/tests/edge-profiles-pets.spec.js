// Feature list section 2: Edit profile, badges and pets.
// These only send changes the server must REFUSE, so the seed users never change.
// The one real pet is added and then removed again in the same test.
import { test, expect } from '@playwright/test'
import { AUTH, apiAs, newUser, seedData, expectError } from './helpers.js'

test.describe('Edit profile: server rules (API)', () => {
  test.use({ storageState: AUTH.owner })

  const update = (page, data) => page.request.put('/api/users/me', { data })

  test('an empty username is refused', async ({ page }) => {
    await expectError(await update(page, { username: '  ' }), 400, 'Username is required.')
  })

  test('a username with a space or @ is refused', async ({ page }) => {
    await expectError(await update(page, { username: 'Seed Owner' }), 400, "Username can't contain @ or spaces.")
    await expectError(await update(page, { username: 'seed@owner' }), 400, "Username can't contain @ or spaces.")
  })

  test('a username someone else has → 409', async ({ page }) => {
    const res = await update(page, { username: 'SeedSitter' })
    try {
      await expectError(res, 409, 'Username is already taken.')
    } finally {
      // safety net: if the rename ever went through, put the seed owner's name back so other tests still work
      if (res.status() === 200) await update(page, { username: 'SeedOwner' })
    }
  })

  test('an address that was not picked from the suggestions is refused', async ({ page }) => {
    await expectError(await update(page, { username: 'SeedOwner', address: 'typed by hand' }), 400, 'Invalid address.')
    await expectError(await update(page, { username: 'SeedOwner', address: { line1: '81 Victoria Street' } }), 400, 'Please choose an address from the suggestions.')
  })

  test('an address outside Singapore is refused', async ({ page }) => {
    const london = { line1: '10 Downing Street', postalCode: '123456', lat: 51.5034, lng: -0.1276 }
    await expectError(await update(page, { username: 'SeedOwner', address: london }), 400, 'That address is not in Singapore.')
  })
})

test.describe('Edit profile: sitter rules (API)', () => {
  test.use({ storageState: AUTH.sitter2 })

  test('an invalid "Sitting since" date is refused', async ({ page }) => {
    const res = await page.request.put('/api/users/me', {
      data: { username: 'SecondSitter', sitterProfile: { experienceStart: 'not-a-month' } }
    })
    await expectError(res, 400, 'Invalid experience date.')
  })
})

test.describe('Badges (API)', () => {
  test('an owner has no badges', async ({ request, browser }) => {
    const { context, api } = await apiAs(browser, 'owner')
    const ids = await seedData(api)
    await context.close()
    const res = await request.get(`/api/users/${ids.ownerId}/badges`)
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

test.describe('Pets (API)', () => {
  test.use({ storageState: AUTH.owner })

  test('a pet needs a name and a species', async ({ page }) => {
    await expectError(await page.request.post('/api/pets', { data: { species: 'Dog' } }), 400, 'name and species are required')
    await expectError(await page.request.post('/api/pets', { data: { name: 'Biscuit' } }), 400, 'name and species are required')
  })

  test('a pet photo must be a JPG, PNG or WebP under 2 MB', async ({ page }) => {
    // a text file pretending to be a photo
    const notAnImage = await page.request.post('/api/pets', {
      multipart: { name: 'Biscuit', species: 'Dog', photo: { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') } }
    })
    await expectError(notAnImage, 400, 'Please upload a JPG, PNG or WebP image.')
    // a "PNG" that is 3 MB
    const tooBig = await page.request.post('/api/pets', {
      multipart: { name: 'Biscuit', species: 'Dog', photo: { name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(3 * 1024 * 1024) } }
    })
    await expectError(tooBig, 400, 'Image must be under 2 MB.')
  })

  test('add, check the age rules, refuse another owner, then remove', async ({ page, browser }) => {
    // setup: add a pet
    const created = await page.request.post('/api/pets', { data: { name: 'E2E Biscuit', species: 'Dog', ageMonths: 12 } })
    expect(created.status()).toBe(201)
    const pet = await created.json()

    // age must be a whole number of months from 0 to 600
    const edit = (ageMonths) => page.request.put(`/api/pets/${pet._id}`, { data: { name: 'E2E Biscuit', species: 'Dog', ageMonths } })
    await expectError(await edit(601), 400, 'Invalid age.')
    await expectError(await edit(1.5), 400, 'Invalid age.')
    await expectError(await edit(-1), 400, 'Invalid age.')
    expect((await edit(600)).status()).toBe(200)

    // another owner can't edit or delete it
    const stranger = await newUser(browser)
    await expectError(await stranger.api.put(`/api/pets/${pet._id}`, { data: { name: 'Mine now', species: 'Dog' } }), 404, 'Pet not found')
    await expectError(await stranger.api.delete(`/api/pets/${pet._id}`), 404, 'Pet not found')
    await stranger.context.close()

    // remove it (and it's really gone)
    const removed = await page.request.delete(`/api/pets/${pet._id}`)
    expect(removed.status()).toBe(200)
    const pets = await (await page.request.get('/api/pets')).json()
    expect(pets.map((p) => p.name)).not.toContain('E2E Biscuit')
  })
})
