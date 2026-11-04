import { test, expect } from '@playwright/test'

test.describe('Notifications', () => {
  test('TC-14 owner is notified when the sitter accepts their request', async ({ browser }) => {
    // setup: two separate browsers, each with its own saved login
    const sitterBrowser = await browser.newContext({ storageState: 'playwright/.auth/sitter2.json' })
    const ownerBrowser = await browser.newContext({ storageState: 'playwright/.auth/owner.json' })
    const sitterPage = await sitterBrowser.newPage()
    const ownerPage = await ownerBrowser.newPage()

    // actions: SecondSitter accepts the owner's pending request for Mochi
    await sitterPage.goto('/sitter/requests')
    const mochiRow = sitterPage.getByRole('row').filter({ hasText: 'Mochi' }).first()
    await mochiRow.getByRole('button', { name: 'Accept' }).click()
    await sitterPage.getByRole('alertdialog').getByRole('button', { name: 'Accept' }).click()
    await expect(sitterPage.getByText(/Request accepted/)).toBeVisible()

    // assert: the owner's Notifications page shows it.
    // The notification is sent a moment after the accept, so reload until it appears (up to 15 seconds).
    await ownerPage.goto('/notifications')
    const message = ownerPage.getByText('SecondSitter accepted your booking request. Confirm it to lock it in.')
    await expect(async () => {
      await ownerPage.reload()
      await expect(message.first()).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 15_000 })
    // and the bell shows unread notifications
    await expect(ownerPage.getByRole('link', { name: /Notifications, \d+ unread/ })).toBeVisible()

    // close both browsers
    await sitterBrowser.close()
    await ownerBrowser.close()
  })
})