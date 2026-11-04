// Logs in as each seed user ONCE and saves the login cookie to a file.
// Spec files then start already logged in with:  test.use({ storageState: 'playwright/.auth/owner.json' })
// The users come from server/src/seed/seedBookings.js (all use the same password).
import { test as setup, expect } from '@playwright/test'

const PASSWORD = 'Password123!'

async function loginAndSave(page, email, file) {
  await page.goto('/login')
  await page.getByPlaceholder('Email/Username').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page).toHaveURL(/\/home/) // logged in
  await page.context().storageState({ path: file }) // save the cookie
}

setup('log in as owner (SeedOwner)', async ({ page }) => {
  await loginAndSave(page, 'seed.owner@petsociety.com', 'playwright/.auth/owner.json')
})

setup('log in as sitter (SeedSitter)', async ({ page }) => {
  await loginAndSave(page, 'seed.sitter@petsociety.com', 'playwright/.auth/sitter.json')
})

setup('log in as second sitter (SecondSitter)', async ({ page }) => {
  await loginAndSave(page, 'seed.sitter2@petsociety.com', 'playwright/.auth/sitter2.json')
})