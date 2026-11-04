// Run from the server folder with:
//   node src/seed/seedKieranSessions.js remove-seed   -> deletes the seed.* accounts and everything linked to them (same as the clear step of pnpm seed)
//   node src/seed/seedKieranSessions.js inspect       -> read-only: shows the two kieran.test accounts, their pets and today's bookings
//   node src/seed/seedKieranSessions.js seed          -> today's sessions and recent bookings between kieran.test.owner and kieran.test.sitter
import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/UserModel.js'
import Pet from '../models/petModel.js'
import Booking from '../models/bookingModel.js'
import CareChecklist from '../models/CareChecklist.js'
import Payment from '../models/paymentModel.js'
import Review from '../models/reviewModel.js'
import WalkRoute from '../models/walkRouteModel.js'
import Walk from '../models/walkModel.js'
import VisitSession from '../models/VisitSession.js'
import Notification from '../models/notificationModel.js'
import Availability from '../models/Availability.js'
import Message from '../models/Message.js'
import { priceForTasks } from '../utils/servicePrices.js'
import { pathLength } from '../utils/walkGeo.js'

const SEED_EMAILS = ['owner', 'priya', 'marcus', 'hannah', 'daniel', 'sitter', 'sitter2', 'aisha', 'ben', 'chloe', 'ravi']
  .map((k) => `seed.${k}@petsociety.com`)
const KIERAN_OWNER = 'kieran.test.owner@example.com'
const KIERAN_SITTER = 'kieran.test.sitter@example.com'

async function removeSeed() {
  const oldUsers = await User.find({ email: { $in: SEED_EMAILS } })
  const oldIds = oldUsers.map((u) => u._id)
  const oldBookings = await Booking.find({ $or: [{ ownerId: { $in: oldIds } }, { sitterId: { $in: oldIds } }] })
  const oldBookingIds = oldBookings.map((b) => b._id)
  await Review.deleteMany({ $or: [{ owner: { $in: oldIds } }, { sitter: { $in: oldIds } }, { booking: { $in: oldBookingIds } }] })
  await Payment.deleteMany({ $or: [{ ownerId: { $in: oldIds } }, { sitterId: { $in: oldIds } }] })
  await Notification.deleteMany({ recipient: { $in: oldIds } })
  await Walk.deleteMany({ $or: [{ owner: { $in: oldIds } }, { sitter: { $in: oldIds } }] })
  await Message.deleteMany({ booking: { $in: oldBookingIds } })
  await Availability.deleteMany({ sitterId: { $in: oldIds } })
  await WalkRoute.deleteMany({ owner: { $in: oldIds } })
  await VisitSession.deleteMany({ booking: { $in: oldBookingIds } })
  await CareChecklist.deleteMany({ bookingId: { $in: oldBookingIds } })
  await Booking.deleteMany({ _id: { $in: oldBookingIds } })
  await Pet.deleteMany({ owner: { $in: oldIds } })
  await User.deleteMany({ _id: { $in: oldIds } })
  console.log(`Removed the seed.* accounts: ${oldIds.length} users, ${oldBookingIds.length} bookings (and their data)`)
}

async function inspect() {
  for (const email of [KIERAN_OWNER, KIERAN_SITTER]) {
    const u = await User.findOne({ email }).lean()
    if (!u) { console.log(email, 'NOT FOUND'); continue }
    console.log('\n==', email, u.role, String(u._id))
    console.log(JSON.stringify({ ownerProfile: u.ownerProfile, sitterProfile: u.sitterProfile }, null, 1))
    const pets = await Pet.find({ owner: u._id }).lean()
    console.log('pets:', pets.map((p) => `${p.name} (${p.species})`).join(', ') || 'none')
    const b = await Booking.find({ $or: [{ ownerId: u._id }, { sitterId: u._id }] }).lean()
    const counts = {}
    for (const x of b) counts[x.status] = (counts[x.status] ?? 0) + 1
    console.log('bookings:', b.length, counts)
    console.log('tagged [seed]:', b.filter((x) => (x.notes ?? '').startsWith('[seed]')).length)
    console.log('availability docs:', await Availability.countDocuments({ sitterId: u._id }))
    console.log('routes:', await WalkRoute.countDocuments({ owner: u._id }))
  }
}

// ---------- sessions for the two kieran.test accounts ----------
// Everything made here has "[seed]" at the start of the booking notes, so a re-run removes the old copy first.
// Only the two kieran.test accounts' [seed] bookings are ever deleted. Pets are the owner's real ones (Buddy and Whiskers).

const SEED_TAG = '[seed]'
const DAY_MS = 24 * 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const SMU_HOME = [103.8500, 1.2965]
const SMU_LOOP = [SMU_HOME, [103.8508, 1.2972], [103.8500, 1.2980], [103.8492, 1.2973], SMU_HOME]
const PHOTO = (text) => ({ url: `https://placehold.co/600x600/png?text=${encodeURIComponent(text)}` })

// 'YYYY-MM-DD' for the day n days from today in Singapore
const dayString = (n) => new Date(Date.now() + n * DAY_MS).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
const daysFromToday = (n) => new Date(`${dayString(n)}T00:00:00+08:00`)
const at = (n, time) => new Date(`${dayString(n)}T${time}:00+08:00`)
const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3))
const slotsBetween = (from, to) => {
  const slots = []
  for (let m = Math.max(420, toMinutes(from)); m < Math.min(1440, toMinutes(to)); m += 30) slots.push(m)
  return slots
}

async function clearOldKieranSeed(owner, sitter) {
  const old = await Booking.find({
    ownerId: owner._id, sitterId: sitter._id, notes: { $regex: '^\\[seed\\]' }
  })
  const ids = old.map((b) => b._id)
  await Review.deleteMany({ booking: { $in: ids } })
  await Payment.deleteMany({ bookingId: { $in: ids } })
  await Walk.deleteMany({ booking: { $in: ids } })
  await Message.deleteMany({ booking: { $in: ids } })
  await VisitSession.deleteMany({ booking: { $in: ids } })
  await CareChecklist.deleteMany({ bookingId: { $in: ids } })
  await Booking.deleteMany({ _id: { $in: ids } })
  await WalkRoute.deleteMany({ owner: owner._id, name: 'SMU loop' })
  return ids.length
}

async function seedKieran() {
  const owner = await User.findOne({ email: KIERAN_OWNER })
  const sitter = await User.findOne({ email: KIERAN_SITTER })
  if (!owner || !sitter) throw new Error('kieran.test.owner or kieran.test.sitter was not found')

  const cleared = await clearOldKieranSeed(owner, sitter)
  console.log(`Removed ${cleared} earlier [seed] bookings between the two accounts`)

  // Home address (asked for by the owner): SMU, 81 Victoria Street. Only the address is changed.
  await User.updateOne({ _id: owner._id }, {
    $set: { 'ownerProfile.address': { line1: '81 Victoria Street', postalCode: '188065', location: { type: 'Point', coordinates: SMU_HOME } } }
  })

  const pets = await Pet.find({ owner: owner._id })
  const buddy = pets.find((p) => p.name === 'Buddy')
  const whiskers = pets.find((p) => p.name === 'Whiskers')
  if (!buddy || !whiskers) throw new Error('Buddy or Whiskers was not found on the owner')

  const home = { type: 'Point', coordinates: SMU_HOME }
  const route = await WalkRoute.create({ owner: owner._id, name: 'SMU loop', path: { type: 'LineString', coordinates: SMU_LOOP }, distanceM: pathLength(SMU_LOOP) })

  // ----- care tasks (only services the sitter offers: feeding, medication, dog walking) -----
  const FEED_TWICE = { category: 'feed', title: 'Feed 1 cup kibble', dailyFrequency: 2 }
  const FEED_ONCE = { category: 'feed', title: 'Top up the dry food and water', dailyFrequency: 1 }
  const MEDS = { category: 'medication', title: 'Half a tablet with food', dailyFrequency: 1, details: { medicationName: 'Joint supplement', dosage: 'Half a tablet', withFood: true } }
  const WALK_ROUTE = {
    category: 'walk', title: 'Walk the SMU loop on the lead', dailyFrequency: 2, pets: [buddy],
    walkRoute: { mode: 'route', route: route._id, name: route.name, path: route.path, distanceM: route.distanceM }
  }
  const WALK_FREE = { category: 'walk', title: 'Free walk: 15 minutes, anywhere quiet', dailyFrequency: 1, pets: [buddy], walkRoute: { mode: 'instructions' } }

  // A booking and its checklist. hours: [start, end] every day. Returns { booking, task(title) }.
  async function book(petList, day, hours, status, notes, tasks, length = 1) {
    const dayTimes = Array.from({ length }, (_, i) => ({ date: dayString(day + i), startTime: hours[0], endTime: hours[1] }))
    const booking = await Booking.create({
      ownerId: owner._id, sitterId: sitter._id, petIds: petList.map((p) => p._id),
      startDate: daysFromToday(day), endDate: daysFromToday(day + length - 1),
      startTime: hours[0], endTime: hours[1], dayTimes,
      notes: `${SEED_TAG} ${notes}`, totalPrice: priceForTasks(tasks, length), status
    })
    const items = tasks.map(({ pets: taskPets, ...t }) => ({ ...t, petIds: (taskPets ?? petList).map((p) => p._id) }))
    const list = await CareChecklist.create({ bookingId: booking._id, items, detailsSavedAt: items.some((t) => t.details) ? new Date() : null })
    // the sitter must be free on every day of the booking
    for (const dt of dayTimes) {
      await Availability.updateOne(
        { sitterId: sitter._id, date: new Date(`${dt.date}T00:00:00+08:00`) },
        { $set: { status: 'available' }, $addToSet: { slots: { $each: slotsBetween(dt.startTime, dt.endTime) } } },
        { upsert: true }
      )
    }
    return { booking, task: (title) => list.items.find((t) => t.title === title) }
  }

  async function session(b, n, start, end, { ticks = [], notes = '', photos = [], active = false } = {}) {
    return VisitSession.create({
      booking: b.booking._id, sitter: sitter._id, date: dayString(n),
      status: active ? 'active' : 'completed',
      startedAt: typeof start === 'string' ? at(n, start) : start,
      endedAt: active ? undefined : at(n, end),
      home: SMU_HOME,
      completedTasks: ticks.map(([title, time]) => ({ task: b.task(title)._id, title, at: at(n, time) })),
      report: active ? undefined : { notes, photos }
    })
  }
  const chat = (b, lines) => Message.insertMany(lines.map(([from, text]) => ({ booking: b.booking._id, sender: from._id, text })))

  // 1. Today, morning: already finished and reported, so the owner can open "View report"
  const t1 = await book([buddy], 0, ['07:00', '09:30'], 'in-progress', 'Today: morning visit, already finished', [FEED_ONCE, MEDS])
  await session(t1, 0, '07:05', '09:20', { ticks: [['Top up the dry food and water', '07:15'], ['Half a tablet with food', '07:20']], notes: 'Buddy ate everything and took the tablet with cheese.', photos: [PHOTO('Buddy')] })

  // 2. Today, now: the last of 3 days, session active, a walk under way, a chat
  const t2 = await book([buddy, whiskers], -2, ['10:00', '19:00'], 'in-progress', 'Three days, today is the last', [FEED_TWICE, WALK_ROUTE, { ...FEED_ONCE, title: 'Whiskers wet food', pets: [whiskers] }], 3)
  for (const n of [-2, -1]) {
    await session(t2, n, '10:03', '18:30', { ticks: [['Feed 1 cup kibble', '10:15'], ['Feed 1 cup kibble', '17:00'], ['Whiskers wet food', '10:20']], notes: 'All good today.' })
  }
  const now = Date.now()
  const liveStart = new Date(Math.max(at(0, '10:05').getTime(), now - 90 * MINUTE_MS))
  const live = await session(t2, 0, liveStart, null, { active: true })
  live.completedTasks.push({ task: t2.task('Feed 1 cup kibble')._id, title: 'Feed 1 cup kibble', at: new Date(Math.max(liveStart.getTime(), now - 60 * MINUTE_MS)) })
  live.lastLocation = { coordinates: SMU_LOOP[2], accuracy: 12, at: new Date(now) }
  await live.save()
  await Walk.create({
    owner: owner._id, sitter: sitter._id, booking: t2.booking._id, visit: live._id, task: t2.task('Walk the SMU loop on the lead')._id,
    mode: 'route', route: route._id, routeName: route.name, plannedPath: route.path, home, instructions: 'Walk the SMU loop on the lead',
    status: 'in-progress', startedAt: new Date(now - 12 * MINUTE_MS), liveDistanceM: 600
  })
  await chat(t2, [[owner, 'Thanks for coming! Buddy loves the loop.'], [sitter, 'On our walk now']])

  // 3. Today, evening: confirmed, for testing "Start session" then "Start walk"
  await book([buddy], 0, ['20:00', '24:00'], 'confirmed', 'Walk test: start the session, then Start walk at SMU', [
    { ...WALK_ROUTE, details: { times: ['20:30', '22:00'], instructions: 'The leash is on the hook by the door.' } }, WALK_FREE,
    { ...FEED_TWICE, details: { times: ['20:15', '23:00'], food: 'kibble', amount: 1, unit: 'cup' } }
  ])

  // 4. Recently ended: finished a few days ago, waiting for payment
  const r1 = await book([buddy, whiskers], -4, ['09:00', '12:00'], 'completed', 'Done, waiting for payment', [FEED_TWICE, WALK_FREE])
  const rs = await session(r1, -4, '09:02', '11:50', { ticks: [['Feed 1 cup kibble', '09:10'], ['Feed 1 cup kibble', '11:30']], notes: 'Both fed. Buddy pulled a bit on the walk.', photos: [PHOTO('Walk')] })
  await Walk.create({
    owner: owner._id, sitter: sitter._id, booking: r1.booking._id, visit: rs._id, task: r1.task('Free walk: 15 minutes, anywhere quiet')._id,
    mode: 'instructions', instructions: 'Free walk', home, status: 'completed',
    startedAt: at(-4, '10:00'), endedAt: at(-4, '10:30'), walkedPath: { type: 'LineString', coordinates: SMU_LOOP },
    distanceM: pathLength(SMU_LOOP), durationS: 1800, deviations: []
  })
  await chat(r1, [[owner, 'Thank you!'], [sitter, 'Anytime']])

  // 5. Recently ended: paid, with a receipt on Transactions (no review, so the sitter's rating is untouched)
  const r2 = await book([whiskers], -9, ['10:00', '13:00'], 'paid', 'Done and paid', [FEED_ONCE])
  await session(r2, -9, '10:00', '12:45', { ticks: [['Top up the dry food and water', '10:10']], notes: 'Whiskers was relaxed.' })
  await Payment.create({ bookingId: r2.booking._id, ownerId: owner._id, sitterId: sitter._id, amount: r2.booking.totalPrice, method: 'visa', cardLast4: '4242', status: 'successful' })

  console.log('Seeded 5 bookings with sessions for kieran.test.owner and kieran.test.sitter:')
  console.log('  today morning (finished, report), today now (active session + walk + chat), today 8pm-12am (confirmed, walk test),')
  console.log('  4 days ago (completed, waiting for payment), 9 days ago (paid)')
  console.log('Owner home address set to 81 Victoria Street (SMU).')
}

const mode = process.argv[2]
connectDB()
  .then(async () => {
    if (mode === 'remove-seed') await removeSeed()
    else if (mode === 'inspect') await inspect()
    else if (mode === 'seed') await seedKieran()
    else console.log('Use: remove-seed | inspect | seed')
  })
  .catch((err) => {
    console.error('Failed:', err.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
