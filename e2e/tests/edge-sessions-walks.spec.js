// Feature list section 7 (sessions), section 9 (walks), paths P2 (sitter happy path), P7 (sitter starts away from home).
// Further down: sending the location, who sees it, the 30-minute sharing cutoff, multi-day bookings, task days,
// report photos, going off route, the back-home reminder, and sessions that end by themselves after 6 hours.
// Those use a brand-new owner and sitter each (sessionBooking in helpers.js), so they never clash with the seed's sessions.
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
import {
  apiAs, seedData, SEED, HOME, FAR, FEED, day, bookingBody, createBooking, cleanUp, expectError,
  sessionBooking, startAtHome, testDb, closeDb, oid, moveBooking, endedAgo, runScheduledJobs, notificationsOf, newUser
} from './helpers.js'

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
  await closeDb()
})

const start = (who, bookingId, body) => who.api.post(`/api/visits/booking/${bookingId}/start`, { data: body })
const atHome = { location: HOME, accuracy: 10 }
const farAway = { location: FAR, accuracy: 10 }
const task = (match) => tasks.find(match)

test.describe.serial('A session from start to finish (API)', () => {
  test('only the booking\'s own sitter can start it (owners and other sitters are refused)', async () => {
    await expectError(await start(owner, walkBooking, atHome), 403, 'Sitters only.')
    // a sitter who isn't on this booking is stopped by the first check ("is this booking yours at all?")
    await expectError(await start(sitter2, walkBooking, atHome), 403, 'This booking is not yours.')
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

// ---------- Helpers for the tests below ----------

const sendLocation = (who, visitId, body) => who.api.post(`/api/visits/${visitId}/location`, { data: body })
const endSession = (who, visitId, notes = 'All good today.') => who.api.post(`/api/visits/${visitId}/end`, { data: { notes } })
const todayFor = async (who, bookingId) => (await (await who.api.get('/api/visits/today')).json()).sessions.find((s) => s.booking._id === bookingId)
const bookingStatus = async (b) => (await (await b.owner.api.get(`/api/bookings/${b.bookingId}`)).json()).status
const visitInDb = async (visitId) => (await testDb()).collection('visitsessions').findOne({ _id: oid(visitId) })
const NEAR = [HOME[0] + 0.0003, HOME[1] + 0.0003] // about 45 m from the home: still "at home"
const FREE_WALK = { category: 'walk', title: 'Free walk', dailyFrequency: 2, walkRoute: { mode: 'instructions' } }
const ROUTE_WALK = {
  category: 'walk', title: 'Route walk', dailyFrequency: 1,
  walkRoute: { mode: 'route', name: 'Test loop', path: { type: 'LineString', coordinates: [HOME, [HOME[0] + 0.0005, HOME[1] + 0.0005], HOME] } }
}
const byTitle = (b, title) => b.tasks.find((t) => t.title === title)

// ---------- 1. Sending the location ----------

test.describe.serial('Sending the location (API)', () => {
  let b, visitId
  test.beforeAll(async ({ browser }) => {
    b = await sessionBooking(browser)
    visitId = await startAtHome(b.sitter, b.bookingId)
  })
  test.afterAll(async () => b.close())

  test("only the session's own sitter can send it", async () => {
    await expectError(await sendLocation(b.owner, visitId, { location: HOME, accuracy: 10 }), 403, 'Sitters only.')
    // another sitter's request looks the same as a session that doesn't exist
    await expectError(await sendLocation(sitter2, visitId, { location: HOME, accuracy: 10 }), 404, 'Session not found.')
    const res = await sendLocation(b.sitter, visitId, { location: HOME, accuracy: 10 })
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual({ sharing: true })
  })

  test('a bad location is refused', async () => {
    const bad = [
      {}, // nothing
      { location: HOME }, // no accuracy
      { location: HOME, accuracy: 'very' }, // accuracy that isn't a number
      { location: [103.85], accuracy: 10 }, // one number
      { location: ['a', 'b'], accuracy: 10 }, // not numbers
      { location: '103.85,1.29', accuracy: 10 } // not a [lng, lat] pair
    ]
    for (const body of bad) {
      await expectError(await sendLocation(b.sitter, visitId, body), 400, 'Your location is missing.')
    }
    await expectError(await sendLocation(b.sitter, 'not-an-id', { location: HOME, accuracy: 10 }), 404, 'Session not found.')
  })

  test('sending after the session has ended is refused, and the last location is gone', async () => {
    expect((await endSession(b.sitter, visitId)).status()).toBe(200)
    await expectError(await sendLocation(b.sitter, visitId, { location: HOME, accuracy: 10 }), 400, 'This session is not active.')
    expect((await visitInDb(visitId)).lastLocation).toBeUndefined()
  })
})

// ---------- 2. Who sees the live location ----------

test.describe.serial('Who sees the live location (API)', () => {
  let b, visitId
  test.beforeAll(async ({ browser }) => {
    b = await sessionBooking(browser)
    visitId = await startAtHome(b.sitter, b.bookingId)
    expect((await sendLocation(b.sitter, visitId, { location: NEAR, accuracy: 12 })).status()).toBe(200)
  })
  test.afterAll(async () => b.close())

  test("the booking's owner sees it during the session", async () => {
    const s = await todayFor(b.owner, b.bookingId)
    expect(s.liveLocation).toMatchObject({ state: 'home', position: NEAR })
    expect(s.visit.lastLocation).toBeUndefined() // only through liveLocation, never the raw session field
  })

  test("the sitter's own view never has it", async () => {
    const s = await todayFor(b.sitter, b.bookingId)
    expect(s.visit.status).toBe('active')
    expect(s.liveLocation).toBeUndefined()
    expect(s.visit.lastLocation).toBeUndefined()
    expect(s.sharingEndsAt).toBeTruthy() // the sitter is told when sharing stops instead
  })

  test('another owner never sees it', async ({ browser }) => {
    expect(await todayFor(owner, b.bookingId)).toBeUndefined() // SeedOwner
    const stranger = await newUser(browser, 'owner')
    expect(await todayFor(stranger, b.bookingId)).toBeUndefined()
    await stranger.context.close()
  })

  test('once the session has ended, the owner no longer sees it', async () => {
    expect((await endSession(b.sitter, visitId)).status()).toBe(200)
    const s = await todayFor(b.owner, b.bookingId)
    expect(s.visit.status).toBe('completed')
    expect(s.liveLocation).toBeUndefined()
  })
})

// ---------- 3. The 30-minute sharing cutoff ----------

test.describe.serial('The 30-minute sharing cutoff (API)', () => {
  let b, visitId, readyWalk
  test.beforeAll(async ({ browser }) => {
    b = await sessionBooking(browser, { tasks: [FREE_WALK] })
    visitId = await startAtHome(b.sitter, b.bookingId)
    expect(await (await sendLocation(b.sitter, visitId, { location: HOME, accuracy: 10 })).json()).toEqual({ sharing: true })
    // a walk opened before the cutoff, not started yet
    readyWalk = (await (await b.sitter.api.post('/api/walks', { data: { visitId, taskId: byTitle(b, 'Free walk')._id } })).json())._id
    // the booked end was 40 to 70 minutes ago: past the 30-minute cutoff, well before the 6-hour auto-end
    const ended = endedAgo(40)
    await moveBooking(b.bookingId, [ended], { [visitId]: ended.date })
  })
  test.afterAll(async () => b.close())

  test('sharing stops, and the last location is deleted', async () => {
    expect((await visitInDb(visitId)).lastLocation).toBeTruthy() // still there from before the cutoff
    const res = await sendLocation(b.sitter, visitId, { location: HOME, accuracy: 10 })
    expect(await res.json()).toEqual({ sharing: false })
    expect((await visitInDb(visitId)).lastLocation).toBeUndefined()
    // the owner's card says sharing has ended, with no position
    const s = await todayFor(b.owner, b.bookingId)
    expect(s.liveLocation).toMatchObject({ state: 'paused', ended: true })
    expect(s.liveLocation.position).toBeUndefined()
  })

  test('no new walk can start after it', async () => {
    const message = "The booked time has ended, so a new walk can't start."
    await expectError(await b.sitter.api.post('/api/walks', { data: { visitId, taskId: byTitle(b, 'Free walk')._id } }), 400, message)
    // nor can the walk that was opened before the cutoff
    await expectError(await b.sitter.api.post(`/api/walks/${readyWalk}/start`, { data: { location: HOME } }), 400, message)
  })

  test('the session can still be ended with a report', async () => {
    expect((await endSession(b.sitter, visitId)).status()).toBe(200)
  })
})

// ---------- 4. Multi-day bookings ----------

test.describe('Multi-day bookings (API)', () => {
  test('only the last day completes the booking; ending an earlier day keeps it in progress', async ({ browser }) => {
    const b = await sessionBooking(browser, { days: [0, 1] })
    const firstDay = await startAtHome(b.sitter, b.bookingId)
    expect((await endSession(b.sitter, firstDay)).status()).toBe(200)
    expect(await bookingStatus(b)).toBe('in-progress')
    expect((await notificationsOf(b.owner.api)).some((n) => n.type === 'payment-due')).toBeFalsy()

    // "the next day": move the booking back a day, so today is its last day
    await moveBooking(b.bookingId, [day(-1), day(0)].map((date) => ({ date, startTime: '07:00', endTime: '24:00' })), { [firstDay]: day(-1) })
    const lastDay = await startAtHome(b.sitter, b.bookingId)
    expect((await endSession(b.sitter, lastDay)).status()).toBe(200)
    expect(await bookingStatus(b)).toBe('completed')
    expect((await notificationsOf(b.owner.api)).some((n) => n.type === 'payment-due')).toBeTruthy()
    await b.close()
  })

  test('a session left open past midnight still shows, and can still be ended', async ({ browser }) => {
    const b = await sessionBooking(browser)
    const visitId = await startAtHome(b.sitter, b.bookingId)
    // the booking was yesterday 8 pm to 12 am, and its session is still open
    await moveBooking(b.bookingId, [{ date: day(-1), startTime: '20:00', endTime: '24:00' }], { [visitId]: day(-1) })

    for (const who of [b.sitter, b.owner]) {
      const s = await todayFor(who, b.bookingId)
      expect(s, 'still on the Today list').toBeTruthy()
      expect(s.visit.status).toBe('active')
      expect(s.booking.day).toBe(day(-1)) // shown with the day it was booked for
    }
    expect((await endSession(b.sitter, visitId)).status()).toBe(200)
    expect(await bookingStatus(b)).toBe('completed') // it was the booking's last day
    await b.close()
  })
})

// ---------- 5. Tasks on some days only ----------

test.describe('Tasks that are only on some days (API)', () => {
  test("ticking a task that isn't due today is refused", async ({ browser }) => {
    const b = await sessionBooking(browser, {
      days: [0, 1],
      tasks: [
        { category: 'feed', title: 'Feed', dailyFrequency: 1 }, // every day
        { category: 'groom', title: 'Bath', dailyFrequency: 1, days: [1] }, // tomorrow only
        { ...FREE_WALK, title: 'Beach walk', days: [1] } // tomorrow only
      ]
    })
    const visitId = await startAtHome(b.sitter, b.bookingId)
    const tick = (task) => b.sitter.api.patch(`/api/visits/${visitId}/tasks/${byTitle(b, task)._id}`, { data: { count: 1 } })

    // today's checklist only has today's tasks
    expect((await todayFor(b.sitter, b.bookingId)).items.map((i) => i.title)).toEqual(['Feed'])
    await expectError(await tick('Bath'), 400, 'This task is not scheduled for today.')
    await expectError(await b.sitter.api.post('/api/walks', { data: { visitId, taskId: byTitle(b, 'Beach walk')._id } }), 400, 'This walk is not scheduled for today.')
    expect((await tick('Feed')).status()).toBe(200)
    await b.close()
  })
})

// ---------- 6 and 7. The report's photos, and the start-check note ----------

test.describe('Report photos and the start-check note (API)', () => {
  const endWithPhoto = (b, visitId, photo) => {
    const form = new FormData()
    form.append('notes', 'All good')
    form.append('photos', new Blob([photo.bytes], { type: photo.type }), photo.name)
    return b.sitter.api.post(`/api/visits/${visitId}/end`, { multipart: form })
  }

  test('only JPG, PNG or WebP photos under 2 MB are accepted', async ({ browser }) => {
    const b = await sessionBooking(browser)
    const visitId = await startAtHome(b.sitter, b.bookingId)
    const message = 'Please upload a JPG, PNG or WebP image.'
    await expectError(await endWithPhoto(b, visitId, { bytes: 'hello', type: 'text/plain', name: 'notes.txt' }), 400, message)
    await expectError(await endWithPhoto(b, visitId, { bytes: 'GIF89a', type: 'image/gif', name: 'funny.gif' }), 400, message)
    await expectError(await endWithPhoto(b, visitId, { bytes: 'x', type: 'application/pdf', name: 'vet.pdf' }), 400, message)
    const tooBig = new Uint8Array(2 * 1024 * 1024 + 1) // 1 byte over 2 MB
    await expectError(await endWithPhoto(b, visitId, { bytes: tooBig, type: 'image/png', name: 'huge.png' }), 400, 'Each image must be under 2 MB.')

    // nothing was saved: the session is still open and can end normally
    expect((await visitInDb(visitId)).status).toBe('active')
    expect((await endSession(b.sitter, visitId)).status()).toBe(200)
    await b.close()
  })

  test('a start-check note of exactly 200 characters is accepted, and the owner gets it', async ({ browser }) => {
    // (201 characters being refused is checked in "P7" above)
    const b = await sessionBooking(browser)
    const note = 'n'.repeat(200)
    const res = await b.sitter.api.post(`/api/visits/booking/${b.bookingId}/start`, { data: { location: FAR, accuracy: 10, note } })
    expect(res.status()).toBe(201)
    expect((await res.json()).startCheck).toMatchObject({ reason: 'out-of-range', note })
    expect((await notificationsOf(b.owner.api)).some((n) => n.type === 'session-unverified' && n.message.includes(note))).toBeTruthy()
    await b.close()
  })
})

// ---------- 8. Going off route ----------
// The phone decides when the sitter is past 25 m or 50 m (client/src/utils/useDeviationCheck.js, which has its own
// unit tests) and tells the server: 'warning' past 25 m, 'notify' past 50 m. These check what the server does with that.

test.describe.serial('Going off route (API)', () => {
  let b, visitId, walkId
  const deviation = (data) => b.sitter.api.post(`/api/walks/${walkId}/deviations`, { data })
  const backOnRoute = () => b.sitter.api.post(`/api/walks/${walkId}/back-on-route`, { data: { location: HOME } })
  const ownerNotes = async (type) => (await notificationsOf(b.owner.api)).filter((n) => n.type === type)
  const OFF = [HOME[0] + 0.0006, HOME[1]]

  test.beforeAll(async ({ browser }) => {
    b = await sessionBooking(browser, { tasks: [ROUTE_WALK, FREE_WALK] })
    visitId = await startAtHome(b.sitter, b.bookingId)
    walkId = (await (await b.sitter.api.post('/api/walks', { data: { visitId, taskId: byTitle(b, 'Route walk')._id } })).json())._id
    expect((await b.sitter.api.post(`/api/walks/${walkId}/start`, { data: { location: HOME } })).status()).toBe(200)
  })
  test.afterAll(async () => b.close())

  test('bad reports are refused', async () => {
    await expectError(await deviation({ level: 'panic', location: OFF, distanceM: 30 }), 400, 'Unknown deviation level.')
    await expectError(await deviation({ level: 'warning', location: OFF }), 400, 'The location or distance is missing.')
    await expectError(await deviation({ level: 'warning', distanceM: 30 }), 400, 'The location or distance is missing.')
    await expectError(await sitter2.api.post(`/api/walks/${walkId}/deviations`, { data: { level: 'warning', location: OFF, distanceM: 30 } }), 404, 'Walk not found.')
  })

  test('past 25 m (a warning): recorded, but the owner is not told', async () => {
    const walk = await (await deviation({ level: 'warning', location: OFF, distanceM: 30 })).json()
    expect(walk.deviations).toHaveLength(1)
    expect(walk.deviations[0]).toMatchObject({ maxDistanceM: 30, ownerNotifiedAt: null })
    expect(await ownerNotes('walk-off-route')).toHaveLength(0)
  })

  test('past 50 m: the owner is told once, however far it goes', async () => {
    await deviation({ level: 'notify', location: OFF, distanceM: 60 })
    const walk = await (await deviation({ level: 'notify', location: OFF, distanceM: 85 })).json()
    expect(walk.deviations).toHaveLength(1) // still the same deviation
    expect(walk.deviations[0].maxDistanceM).toBe(85)
    expect(walk.deviations[0].ownerNotifiedAt).toBeTruthy()
    const notes = await ownerNotes('walk-off-route')
    expect(notes).toHaveLength(1)
    expect(notes[0].message).toContain('about 60 m off the route "Test loop"')
  })

  test('back on route: the owner is told, because they were told it went off', async () => {
    const walk = await (await backOnRoute()).json()
    expect(walk.deviations[0].endedAt).toBeTruthy()
    const notes = await ownerNotes('walk-back-on-route')
    expect(notes).toHaveLength(1)
    expect(notes[0].message).toContain('is back on the route "Test loop"')
  })

  test('a deviation that never passed 50 m ends without telling the owner', async () => {
    await deviation({ level: 'warning', location: OFF, distanceM: 35 })
    const walk = await (await backOnRoute()).json()
    expect(walk.deviations).toHaveLength(2)
    expect(walk.deviations[1]).toMatchObject({ maxDistanceM: 35, ownerNotifiedAt: null })
    expect(await ownerNotes('walk-off-route')).toHaveLength(1)
    expect(await ownerNotes('walk-back-on-route')).toHaveLength(1)
  })

  test('a walk without a route has no route to go off', async () => {
    expect((await b.sitter.api.post(`/api/walks/${walkId}/finish`, { data: { path: [HOME, OFF, HOME] } })).status()).toBe(200)
    const free = (await (await b.sitter.api.post('/api/walks', { data: { visitId, taskId: byTitle(b, 'Free walk')._id } })).json())._id
    await b.sitter.api.post(`/api/walks/${free}/start`, { data: { location: HOME } })
    await expectError(await b.sitter.api.post(`/api/walks/${free}/deviations`, { data: { level: 'warning', location: OFF, distanceM: 30 } }), 400, 'This walk has no route to go off.')
    await b.sitter.api.post(`/api/walks/${free}/finish`, { data: { path: [HOME, OFF, HOME] } })
  })

  test("the owner's report shows both times off route, and which one they were told about", async () => {
    expect((await endSession(b.sitter, visitId)).status()).toBe(200)
    const report = await (await b.owner.api.get(`/api/visits/booking/${b.bookingId}/report`)).json()
    const walk = report.days[0].walks.find((w) => w._id === walkId)
    expect(walk.deviations.map((d) => [d.maxDistanceM, !!d.ownerNotifiedAt])).toEqual([[85, true], [35, false]])
  })
})

// ---------- 9. The back-home reminder ----------
// The phone decides when the sitter has been back for 20 minutes (client/src/utils/sessionTracker.js, unit tested),
// then asks the server to remind them. The server sends it only once per walk.

test.describe('The back-home reminder (API)', () => {
  test('is sent to the sitter once per walk, and only during the walk', async ({ browser }) => {
    const b = await sessionBooking(browser, { tasks: [FREE_WALK] })
    const visitId = await startAtHome(b.sitter, b.bookingId)
    const walkId = (await (await b.sitter.api.post('/api/walks', { data: { visitId, taskId: byTitle(b, 'Free walk')._id } })).json())._id
    const remind = (who = b.sitter) => who.api.post(`/api/walks/${walkId}/back-home`)

    await expectError(await remind(), 400, 'This walk is not in progress.') // not started yet
    await b.sitter.api.post(`/api/walks/${walkId}/start`, { data: { location: HOME } })
    await expectError(await remind(b.owner), 403, 'Sitters only.')

    const first = await (await remind()).json()
    const second = await (await remind()).json() // the phone asking again
    expect(first.backHomeRemindedAt).toBeTruthy()
    expect(second.backHomeRemindedAt).toBe(first.backHomeRemindedAt)
    const reminders = (await notificationsOf(b.sitter.api)).filter((n) => n.type === 'walk-back-home')
    expect(reminders).toHaveLength(1)
    expect(reminders[0].message).toContain('remember to end it')
    expect((await notificationsOf(b.owner.api)).some((n) => n.type === 'walk-back-home')).toBeFalsy() // only the sitter

    await b.sitter.api.post(`/api/walks/${walkId}/finish`, { data: { path: [HOME, NEAR, HOME] } })
    await expectError(await remind(), 400, 'This walk is not in progress.')
    await b.close()
  })
})

// ---------- 10 and 11. Sessions and bookings that finish by themselves ----------
// The server checks every few minutes (utils/endForgottenSessions.js). The tests' server has that timer off, and the
// tests run the check themselves (runScheduledJobs) right after moving the booking's times into the past.

test.describe('A forgotten session ends by itself 6 hours after the booked end (API)', () => {
  test('ends the session and any walk, notes the missing report, tells both sides, and completes the last day', async ({ browser }) => {
    const b = await sessionBooking(browser, { tasks: [FEED, FREE_WALK] })
    const visitId = await startAtHome(b.sitter, b.bookingId)
    const walkId = (await (await b.sitter.api.post('/api/walks', { data: { visitId, taskId: byTitle(b, 'Free walk')._id } })).json())._id
    await b.sitter.api.post(`/api/walks/${walkId}/start`, { data: { location: HOME } }) // a walk still going on
    await sendLocation(b.sitter, visitId, { location: HOME, accuracy: 10 })
    const ended = endedAgo(6 * 60 + 40) // booked end 6 h 40 min to 7 h 10 min ago
    await moveBooking(b.bookingId, [ended], { [visitId]: ended.date })

    await runScheduledJobs(b.owner.api)

    const visit = await visitInDb(visitId)
    expect(visit).toMatchObject({ status: 'completed', autoEnded: true, report: { notes: "The sitter didn't submit a report." } })
    expect(visit.lastLocation).toBeUndefined()
    const walk = await (await b.sitter.api.get(`/api/walks/${walkId}`)).json()
    expect(walk).toMatchObject({ status: 'ended-early', endedEarlyReason: 'The session ended automatically before the walk was finished.' })
    for (const who of [b.owner, b.sitter]) {
      expect((await notificationsOf(who.api)).some((n) => n.type === 'session-auto-ended')).toBeTruthy()
    }
    expect(await bookingStatus(b)).toBe('completed')
    expect((await notificationsOf(b.owner.api)).some((n) => n.type === 'payment-due')).toBeTruthy()
    await b.close()
  })

  test('a session less than 6 hours past its booked end is left open', async ({ browser }) => {
    const b = await sessionBooking(browser)
    const visitId = await startAtHome(b.sitter, b.bookingId)
    const ended = endedAgo(5 * 60) // 5 to 5.5 hours ago
    await moveBooking(b.bookingId, [ended], { [visitId]: ended.date })
    await runScheduledJobs(b.owner.api)
    expect((await visitInDb(visitId)).status).toBe('active')
    expect(await bookingStatus(b)).toBe('in-progress')
    await b.close()
  })

  test("a day that isn't the booking's last ends, but the booking stays in progress", async ({ browser }) => {
    const b = await sessionBooking(browser)
    const visitId = await startAtHome(b.sitter, b.bookingId)
    const ended = endedAgo(6 * 60 + 40)
    const nextDay = new Date(Date.parse(`${ended.date}T12:00:00Z`) + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await moveBooking(b.bookingId, [ended, { date: nextDay, startTime: '07:00', endTime: '24:00' }], { [visitId]: ended.date })
    await runScheduledJobs(b.owner.api)
    expect((await visitInDb(visitId)).autoEnded).toBe(true)
    expect(await bookingStatus(b)).toBe('in-progress')
    await b.close()
  })
})

test.describe("A booking whose last day never had a session (API)", () => {
  test('is completed 6 hours after its last booked time, so the owner can pay', async ({ browser }) => {
    const b = await sessionBooking(browser, { days: [0, 1] })
    const firstDay = await startAtHome(b.sitter, b.bookingId)
    expect((await endSession(b.sitter, firstDay)).status()).toBe(200)
    expect(await bookingStatus(b)).toBe('in-progress')
    // the first day was 3 days ago; the last day (no session) ended more than 6 hours ago
    await moveBooking(b.bookingId, [{ date: day(-3), startTime: '09:00', endTime: '12:00' }, endedAgo(6 * 60 + 40)], { [firstDay]: day(-3) })
    await runScheduledJobs(b.owner.api)
    expect(await bookingStatus(b)).toBe('completed')
    expect((await notificationsOf(b.owner.api)).some((n) => n.type === 'payment-due')).toBeTruthy()
    await b.close()
  })

  test('is left in progress until 6 hours have passed', async ({ browser }) => {
    const b = await sessionBooking(browser, { days: [0, 1] })
    const firstDay = await startAtHome(b.sitter, b.bookingId)
    await endSession(b.sitter, firstDay)
    await moveBooking(b.bookingId, [{ date: day(-3), startTime: '09:00', endTime: '12:00' }, endedAgo(60)], { [firstDay]: day(-3) })
    await runScheduledJobs(b.owner.api)
    expect(await bookingStatus(b)).toBe('in-progress')
    await b.close()
  })
})
