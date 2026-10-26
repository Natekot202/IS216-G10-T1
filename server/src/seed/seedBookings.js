// Fake data for testing Ezekiel's booking pages.
// Run from the server folder with:  pnpm seed
// Safe to run many times: it only deletes the fake data it created itself.

import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcrypt'
import connectDB from '../config/db.js'
import User from '../models/UserModel.js'
import Pet from '../models/petModel.js'
import Booking from '../models/bookingModel.js'
import Payment from '../models/paymentModel.js'

const SEED_OWNER_EMAIL = 'seed.owner@petsociety.com'
const SEED_SITTER_EMAIL = 'seed.sitter@petsociety.com'
const SEED_SITTER2_EMAIL = 'seed.sitter2@petsociety.com'
const SEED_EMAILS = [SEED_OWNER_EMAIL, SEED_SITTER_EMAIL, SEED_SITTER2_EMAIL]
const SEED_PASSWORD = 'Password123!'
const SEED_TAG = '[seed]'
const RATE_PER_HOUR = 20

// Midnight in Singapore, n days from today (negative n = in the past)
function daysFromToday(n) {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000)
  const sgDay = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) // e.g. "2026-10-14"
  return new Date(`${sgDay}T00:00:00+08:00`)
}

// '09:30' -> 570 minutes since midnight
function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// One booking session on a single day: `day` days from today, from startTime to endTime.
// Price = hourly rate × hours. `trip` is optional: { groupId, groupName } for requests sent together.
function makeBooking(owner, sitter, petIds, day, startTime, endTime, status, notes, trip = {}) {
  const hours = (toMinutes(endTime) - toMinutes(startTime)) / 60
  return {
    ownerId: owner._id,
    sitterId: sitter._id,
    petIds,
    startDate: daysFromToday(day),
    endDate: daysFromToday(day),
    startTime,
    endTime,
    notes: `${SEED_TAG} ${notes}`,
    totalPrice: RATE_PER_HOUR * hours,
    status,
    groupId: trip.groupId || null,
    groupName: trip.groupName || ''
  }
}

async function clearOldSeed() {
  const oldUsers = await User.find({ email: { $in: SEED_EMAILS } })
  const oldIds = oldUsers.map((u) => u._id)

  await Payment.deleteMany({ $or: [{ ownerId: { $in: oldIds } }, { sitterId: { $in: oldIds } }] })
  await Booking.deleteMany({ $or: [{ ownerId: { $in: oldIds } }, { sitterId: { $in: oldIds } }] })
  await Pet.deleteMany({ owner: { $in: oldIds } })
  await User.deleteMany({ _id: { $in: oldIds } })
}

async function seed() {
  await connectDB()
  await clearOldSeed()

  const password = await bcrypt.hash(SEED_PASSWORD, 10)
  const sitterProfile = { petsittingRates: RATE_PER_HOUR }

  const owner = await User.create({ username: 'SeedOwner', email: SEED_OWNER_EMAIL, password, role: 'owner' })
  const sitter = await User.create({ username: 'SeedSitter', email: SEED_SITTER_EMAIL, password, role: 'sitter', sitterProfile })
  const sitter2 = await User.create({ username: 'SecondSitter', email: SEED_SITTER2_EMAIL, password, role: 'sitter', sitterProfile })

  const mochi = await Pet.create({ owner: owner._id, name: 'Mochi', species: 'Dog', breed: 'Shiba Inu', ageMonths: 36, description: 'Friendly, loves walks' })
  const luna = await Pet.create({ owner: owner._id, name: 'Luna', species: 'Cat', breed: 'British Shorthair', ageMonths: 24, description: 'Shy at first' })

  // One trip sent to 2 sitters at once (same pets and times, same groupId).
  // The first sitter to accept gets it, and the other request is declined automatically.
  const taiwan = { groupId: 'seed-taiwan-trip', groupName: 'Taiwan Trip' }

  // Flow: pending -> accepted -> in-progress -> completed (owner pays now) -> paid
  const bookings = await Booking.insertMany([
    makeBooking(owner, sitter, [mochi._id, luna._id], 20, '09:00', '17:00', 'pending', 'Taiwan trip, asked 2 sitters', taiwan),
    makeBooking(owner, sitter2, [mochi._id, luna._id], 20, '09:00', '17:00', 'pending', 'Taiwan trip, asked 2 sitters', taiwan),
    makeBooking(owner, sitter, [luna._id], 14, '10:00', '14:00', 'pending', 'New request: afternoon with Luna'),
    makeBooking(owner, sitter, [mochi._id, luna._id], 5, '09:00', '18:00', 'accepted', 'Accepted, starts in 5 days'),
    makeBooking(owner, sitter, [mochi._id], 2, '08:00', '12:00', 'accepted', 'Accepted, morning walk'),
    makeBooking(owner, sitter, [luna._id], 0, '08:00', '20:00', 'in-progress', 'Session happening today'),
    makeBooking(owner, sitter, [mochi._id], -3, '10:00', '16:00', 'completed', 'Done, waiting for payment'),
    makeBooking(owner, sitter, [mochi._id], -10, '09:00', '17:00', 'paid', 'Done and paid'),
    makeBooking(owner, sitter, [luna._id], -5, '10:00', '12:00', 'declined', 'Sitter was not free')
  ])

  // Receipts for the Transactions page:
  // 1) the paid booking was paid successfully
  // 2) the completed booking had one declined card attempt (still waiting to be paid)
  const paid = bookings.find((b) => b.status === 'paid')
  const unpaid = bookings.find((b) => b.status === 'completed')
  await Payment.insertMany([
    { bookingId: paid._id, ownerId: owner._id, sitterId: sitter._id, amount: paid.totalPrice, method: 'visa', cardLast4: '4242', status: 'successful' },
    { bookingId: unpaid._id, ownerId: owner._id, sitterId: sitter._id, amount: unpaid.totalPrice, method: 'visa', cardLast4: '0002', status: 'rejected' }
  ])

  console.log('Seed done ✅')
  console.log(`Owner    login: ${SEED_OWNER_EMAIL} / ${SEED_PASSWORD}`)
  console.log(`Sitter   login: ${SEED_SITTER_EMAIL} / ${SEED_PASSWORD}`)
  console.log(`Sitter 2 login: ${SEED_SITTER2_EMAIL} / ${SEED_PASSWORD}`)
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())