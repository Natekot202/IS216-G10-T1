// Feature list section 3: Search sitters and "Recommended for me".
// TC-05 (search + open profile) and TC-12 (Recommended shows SeedSitter) already exist.
import { test, expect } from '@playwright/test'
import { AUTH, registerInBrowser, openBookingForm, expectError } from './helpers.js'

test.describe('Search sitters', () => {
  test.use({ storageState: AUTH.owner })

  test('the name search ignores upper and lower case', async ({ page }) => {
    // setup
    await page.goto('/home')
    // actions
    await page.getByPlaceholder('Search by sitter name').fill('secondsitter')
    // assert: SecondSitter is shown, SeedSitter is not
    await expect(page.getByRole('heading', { name: 'SecondSitter', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'SeedSitter', exact: true })).toHaveCount(0)
  })

  test('the sitter list never includes emails or passwords (API)', async ({ page }) => {
    const sitters = await (await page.request.get('/api/sitters')).json()
    expect(sitters.length).toBeGreaterThan(0)
    for (const s of sitters) {
      expect(s).not.toHaveProperty('email')
      expect(s).not.toHaveProperty('password')
    }
  })
})

test.describe('Search sitters, logged out', () => {
  test('/browse lists sitters with View Profile', async ({ page }) => {
    await page.goto('/browse')
    await expect(page.getByRole('link', { name: 'View Profile' }).first()).toBeVisible()
  })

  test("a sitter's availability needs a valid sitter id (API)", async ({ request }) => {
    await expectError(await request.get('/api/availability/not-an-id'), 400, 'Invalid sitter id')
    await expectError(await request.get('/api/availability/not-an-id/busy'), 400, 'Invalid sitter id')
  })
})

test.describe('A brand-new owner (no pets, no "Services I need")', () => {
  test('"Recommended for me" points them to Edit Profile', async ({ page }) => {
    // setup: sign up a new owner in this browser
    await registerInBrowser(page, 'owner')
    // actions
    await page.getByRole('button', { name: /Recommended for me/ }).click()
    // assert
    await expect(page.getByText("We don't know what your pets need yet.")).toBeVisible()
    await expect(page.getByRole('link', { name: 'Edit Profile' })).toBeVisible()
  })

  test('the booking form says they have no pets yet', async ({ page }) => {
    await registerInBrowser(page, 'owner')
    await openBookingForm(page, 'SecondSitter')
    await expect(page.getByText('You have no pets yet. Add one from your profile first.')).toBeVisible()
  })
})
