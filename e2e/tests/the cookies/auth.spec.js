import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('TC-01 logs in with valid credentials', async ({ page }) => {
    // setup
    await page.goto('/login')
    // actions
    await page.getByPlaceholder('Email/Username').fill('seed.owner@petsociety.com')
    await page.getByPlaceholder('Password', { exact: true }).fill('Password123!')
    await page.getByRole('button', { name: 'Log In' }).click()
    // assert
    await expect(page).toHaveURL(/\/home/)
  })

  test('TC-02 shows an error for a wrong password', async ({ page }) => {
    await page.goto('/login')
    await page.getByPlaceholder('Email/Username').fill('seed.owner@petsociety.com')
    await page.getByPlaceholder('Password', { exact: true }).fill('WrongPass1!')
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page.getByRole('alert')).toBeVisible()   // after adding role="alert"
    await expect(page).toHaveURL(/\/login/)
  })

  test('TC-03 registers a new owner', async ({ page }) => {
    const unique = Date.now()                              // new email every run → repeatable
    await page.goto('/register?role=owner')
    await page.getByPlaceholder('Username').fill(`e2e_owner_${unique}`)
    await page.getByPlaceholder('Email').fill(`e2e_${unique}@test.com`)
    await page.getByPlaceholder('Password', { exact: true }).fill('Password123!')
    await page.getByPlaceholder('Confirm password').fill('Password123!')
    await page.getByRole('button', { name: 'Sign up' }).click()
    await expect(page).not.toHaveURL(/\/register/)         // replace with where signup really lands
  })

  test('TC-04 blocks a logged-out user from My Bookings', async ({ page }) => {
    await page.goto('/owner/bookings')
    await expect(page).toHaveURL(/\/login|\/browse|\/$/)  // check what your guard actually does
  })
})