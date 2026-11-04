// Feature list section 10: chat between owner and sitter (/api/bookings/:id/messages).
// Uses the seed's CONFIRMED booking 5 days from now (SeedOwner + SeedSitter).
import { test, expect } from '@playwright/test'
import { apiAs, seedData, SEED, expectError } from './helpers.js'

let owner, sitter, sitter2, ids, bookingId
test.beforeAll(async ({ browser }) => {
  owner = await apiAs(browser, 'owner')
  sitter = await apiAs(browser, 'sitter')
  sitter2 = await apiAs(browser, 'sitter2')
  ids = await seedData(owner.api)
  bookingId = ids.booking(SEED.confirmedIn5Days)
})
test.afterAll(async () => {
  await owner.context.close()
  await sitter.context.close()
  await sitter2.context.close()
})

const send = (who, id, text) => who.api.post(`/api/bookings/${id}/messages`, { data: { text } })

test.describe('Chat (API)', () => {
  test('an empty message is refused', async () => {
    await expectError(await send(owner, bookingId, '   '), 400, 'Please type a message.')
  })

  test('a message over 500 characters is refused', async () => {
    await expectError(await send(owner, bookingId, 'x'.repeat(501)), 400, 'Messages can be at most 500 characters.')
  })

  test('the owner sends a message and the sitter can read it', async () => {
    const text = `Hello from the E2E test ${Date.now()}`
    const res = await send(owner, bookingId, text)
    expect(res.status()).toBe(201)
    const list = await (await sitter.api.get(`/api/bookings/${bookingId}/messages`)).json()
    expect(JSON.stringify(list)).toContain(text)
  })

  test('someone who is not on the booking cannot read or send', async () => {
    await expectError(await sitter2.api.get(`/api/bookings/${bookingId}/messages`), 403, 'This booking is not yours.')
    await expectError(await send(sitter2, bookingId, 'hi'), 403, 'This booking is not yours.')
  })

  test('an invalid "after" time is refused', async () => {
    await expectError(await owner.api.get(`/api/bookings/${bookingId}/messages?after=not-a-time`), 400, 'Invalid "after" time.')
  })

  test('the chat is read-only once the booking has ended (paid)', async () => {
    await expectError(await send(owner, ids.booking(SEED.paid), 'Thanks!'), 400, 'Messages are only open while a booking is confirmed or in progress. This one is paid.')
  })
})
