import { test as setup, expect } from '@playwright/test'

const PASSWORD = 'Password123!'

async function loginAs(page, email, file) {
  await page.goto('/login')
  await page.getByPlaceholder('Email/Username').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page).toHaveURL(/\/home/)
  await page.context().storageState({ path: file }) // saves the session cookie
}

setup('log in as owner', async ({ page }) => {
  await loginAs(page, 'seed.owner@petsociety.com', 'playwright/.auth/owner.json')
})

setup('log in as sitter', async ({ page }) => {
  await loginAs(page, 'seed.sitter@petsociety.com', 'playwright/.auth/sitter.json')
})