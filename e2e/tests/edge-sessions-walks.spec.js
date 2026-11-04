// Feature list section 7 (sessions), section 9 (walks), paths P2 (sitter happy path), P7 (sitter starts away from home).
//
// The phone's GPS is replaced by sending the location straight to the API, e.g. { location: HOME, accuracy: 10 }.
// That way the "within 75 m of the home" rules can be tested without walking anywhere.
//
// Uses the seed's two bookings for TODAY with SeedSitter:
//   "Walk test"            confirmed,   Mochi, 8pm–12am (has walk tasks)
//   "Session happening..." in progress, Luna,  8am–8pm
//
// test.describe.serial: these tests run in order and share one session. If one fails, the rest are skipped.
import { test, expect } from '@playwright/test'
import { apiAs, seedData, SEED, HOME, FAR, day, bookingBody, createBooking, cleanUp, expectError } from './helpers.js'

let owner, sitter, sitter2, ids, walkBooking, lunaBooking, visitId, tasks

test.beforeAll(async ({ browser }) => {
  owner = await apiAs(browser, 'owner')
  sitter = await apiAs(browser, 'sitter')
  sitter2 = await apiAs(browser, 'sitter2')
  ids = await seedData(owner.api)
  walkBooking = ids.booking(SEED.walkTestToday)
  lunaBooking = ids.booking(SEED.inProgressToday)
  tasks = (await (await owner.api.get(`/api/bookings/${walkBooking}/care-tasks`)).json()).items
})
test.afterAll(async () => {
  await owner.context.close()
  await sitter.context.close()
  await sitter2.context.close()
})

const start = (who, bookingId, body) => who.api.post(`/api/visits/booking/${bookingId}/start`, { data: body })
const atHome = { location: HOME, accuracy: 10 }
const farAway = { location: FAR, accuracy: 10 }
const task = (match) => tasks.find(match)

test.describe.serial('A session from start to finish (API)', () => {
  test('only the booking\'s own sitter can start it', async () => {
    await expectError(await start(owner, walkBooking, atHome), 403, 'Sitters only.')
    await expectError(await start(sitter2, walkBooking, atHome), 403, "Only this booking's sitter can start a session.")
  })

  test("a booking that isn't today, or isn't confirmed, can't be started", async () => {
    await expectError(await start(sitter, ids.booking(SEED.confirmedIn5Days), atHome), 400, 'This booking is not scheduled for today.')
    // a fresh pending request (with SecondSitter, started by SecondSitter)
    const pending = await createBooking(owner.api, bookingBody(ids, { startDate: day(16), endDate: day(16) }))
    await expectError(await start(sitter2, pending, atHome), 400, "This booking is pending, so a session can't be started.")
    await cleanUp(owner.api, pending)
  })

  test('P7: too far from the home → 409 "out-of-range" with the distance', async () => {
    const res = await start(sitter, walkBooking, farAway)
    await expectError(res, 409, 'Your location could not be confirmed.')
    const body = await res.json()
    expect(body.check).toBe('out-of-range')
    expect(body.distanceM).toBeGreaterThan(75)
  })

  test('P7: no location, or GPS vaguer than 100 m, counts as "no-location"', async () => {
    expect((await (await start(sitter, walkBooking, {})).json()).check).toBe('no-location')
    expect((await (await start(sitter, walkBooking, { location: HOME, accuracy: 500 })).json()).check).toBe('no-location')
  })

  test('P7: the "I\'m out of range" note can be at most 200 characters', async () => {
    await expectError(await start(sitter, walkBooking, { ...farAway, note: 'x'.repeat(201) }), 400, 'The note can be up to 200 characters.')
  })

  test('starting at the home works, and the booking becomes in progress', async () => {
    const res = await start(sitter, walkBooking, atHome)
    expect(res.status()).toBe(201)
    visitId = (await res.json())._id
    const booking = await (await owner.api.get(`/api/bookings/${walkBooking}`)).json()
    expect(booking.status).toBe('in-progress')
  })

  test("today's session can't be started twice, and only one session at a time", async () => {
    await expectError(await start(sitter, walkBooking, atHome), 400, "Today's session has already been started.")
    await expectError(await start(sitter, lunaBooking, atHome), 409, 'End your other session before starting this one.')
  })

  test('ticking tasks: 0 to "times a day", and walks are not ticked by hand', async () => {
    const tick = (taskId, count) => sitter.api.patch(`/api/visits/${visitId}/tasks/${taskId}`, { data: { count } })
    const feed = task((t) => t.category === 'feed')
    await expectError(await tick(feed._id, feed.dailyFrequency + 1), 400, `Count must be 0 to ${feed.dailyFrequency}.`)
    expect((await tick(feed._id, feed.dailyFrequency)).status()).toBe(200)
    expect((await tick(feed._id, 0)).status()).toBe(200) // unticking
    const walk = task((t) => t.category === 'walk')
    await expectError(await tick(walk._id, 1), 400, 'Walk tasks are ticked off by doing the walk. Press Start walk.')
  })

  test('a walk: start only at home, one at a time, finish only at home, or end early with a reason', async () => {
    const freeWalk = task((t) => t.walkRoute?.mode === 'instructions') // "Free walk: 15 minutes", once a day
    const routeWalk = task((t) => t.walkRoute?.mode === 'route') // the SMU loop
    const near = [HOME[0] + 0.0005, HOME[1] + 0.0005] // about 80 m from home

    // make the walk
    const made = await sitter.api.post('/api/walks', { data: { visitId, taskId: freeWalk._id } })
    expect(made.ok()).toBeTruthy()
    const walkId = (await made.json())._id

    // start: away from home is refused, at home works, twice is refused
    await expectError(await sitter.api.post(`/api/walks/${walkId}/start`, { data: { location: FAR } }), 400, "Start the walk at the owner's home.")
    expect((await sitter.api.post(`/api/walks/${walkId}/start`, { data: { location: HOME } })).status()).toBe(200)
    await expectError(await sitter.api.post(`/api/walks/${walkId}/start`, { data: { location: HOME } }), 400, 'This walk has already been started.')

    // a second walk while this one is going → 409; ending the session now → refused
    await expectError(await sitter.api.post('/api/walks', { data: { visitId, taskId: routeWalk._id } }), 409, 'Finish the walk you are on before starting another.')
    await expectError(await sitter.api.post(`/api/visits/${visitId}/end`, { data: { notes: 'All good' } }), 400, 'Finish or end the walk you are on before submitting the report.')

    // the owner can't see a walk that hasn't finished
    await expectError(await owner.api.get(`/api/walks/${walkId}`), 404, 'Walk not found.')

    // finish away from home → refused; end early needs a reason (up to 200 characters)
    await expectError(await sitter.api.post(`/api/walks/${walkId}/finish`, { data: { path: [HOME, near, FAR] } }), 400, "Finish the walk at the owner's home, or end it early.")
    await expectError(await sitter.api.post(`/api/walks/${walkId}/end-early`, { data: { path: [HOME, near] } }), 400, 'Tell the owner why the walk ended early.')
    await expectError(await sitter.api.post(`/api/walks/${walkId}/end-early`, { data: { path: [HOME, near], reason: 'x'.repeat(201) } }), 400, 'Keep the reason under 200 characters.')
    const ended = await sitter.api.post(`/api/walks/${walkId}/end-early`, { data: { path: [HOME, near], reason: 'Heavy rain started' } })
    expect(ended.status()).toBe(200)
    expect((await ended.json()).status).toBe('ended-early')

    // that task's 1 walk today is now done (an ended-early walk counts)
    await expectError(await sitter.api.post('/api/walks', { data: { visitId, taskId: freeWalk._id } }), 400, "All 1 of today's walks for this task are done.")

    // now the owner can see it, and was told why it ended early
    expect((await owner.api.get(`/api/walks/${walkId}`)).status()).toBe(200)
    const notes = await (await owner.api.get('/api/notifications')).json()
    expect(notes.some((n) => n.type === 'walk-ended-early' && n.message.includes('Heavy rain started'))).toBeTruthy()
  })

  test('a route walk finished back at home is completed', async () => {
    const routeWalk = task((t) => t.walkRoute?.mode === 'route')
    const made = await sitter.api.post('/api/walks', { data: { visitId, taskId: routeWalk._id } })
    const walkId = (await made.json())._id
    expect((await sitter.api.post(`/api/walks/${walkId}/start`, { data: { location: HOME } })).status()).toBe(200)
    const near = [HOME[0] + 0.0005, HOME[1] + 0.0005]
    const done = await sitter.api.post(`/api/walks/${walkId}/finish`, { data: { path: [HOME, near, HOME] } })
    expect(done.status()).toBe(200)
    expect((await done.json()).status).toBe('completed')
  })

  test('ending the session: notes are required, at most 3 photos, then the booking is completed', async () => {
    const end = (data) => sitter.api.post(`/api/visits/${visitId}/end`, { data })
    await expectError(await end({ notes: '  ' }), 400, 'Please write a short note for the owner.')

    // 4 photos → refused before anything is uploaded (the limit is 3)
    const form = new FormData()
    form.append('notes', 'All good')
    for (let n = 1; n <= 4; n++) form.append('photos', new Blob(['x'], { type: 'image/png' }), `photo${n}.png`)
    await expectError(await sitter.api.post(`/api/visits/${visitId}/end`, { multipart: form }), 400, 'You can attach up to 3 photos.')

    // a real end, with notes and no photos
    expect((await end({ notes: 'All good. Mochi ate well and had a short walk.' })).status()).toBe(200)

    // the session is over, and this was the booking's last day → completed, and the owner is told to pay
    await expectError(await end({ notes: 'again' }), 400, 'This session is not active.')
    const booking = await (await owner.api.get(`/api/bookings/${walkBooking}`)).json()
    expect(booking.status).toBe('completed')
    await expect(async () => {
      const notes = await (await owner.api.get('/api/notifications')).json()
      expect(notes.some((n) => n.type === 'payment-due')).toBeTruthy()
    }).toPass({ timeout: 10_000 })
  })

  test('P7: starting away from home WITH a note works, and the owner is warned', async () => {
    // the other session today (Luna), now that the first one has ended
    const res = await start(sitter, lunaBooking, { ...farAway, note: 'Waiting at the lobby, GPS is weak here' })
    expect(res.status()).toBe(201)
    const lunaVisit = (await res.json())._id
    await expect(async () => {
      const notes = await (await owner.api.get('/api/notifications')).json()
      expect(notes.some((n) => n.type === 'session-unverified' && n.message.includes('Waiting at the lobby'))).toBeTruthy()
    }).toPass({ timeout: 10_000 })
    // clean up: end it
    expect((await sitter.api.post(`/api/visits/${lunaVisit}/end`, { data: { notes: 'Done for today.' } })).status()).toBe(200)
  })
})
