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

const SEED_OWNER_EMAIL = 'seed.owner@petsociety.com'
const SEED_SITTER_EMAIL = 'seed.sitter@petsociety.com'
const SEED_SITTER2_EMAIL = 'seed.sitter2@petsociety.com'
const SEED_EMAILS = [SEED_OWNER_EMAIL, SEED_SITTER_EMAIL, SEED_SITTER2_EMAIL]
const SEED_PASSWORD = 'Password123!'
const SEED_TAG = '[seed]'
const RATE_PER_DAY = 40

// Midnight in Singapore, n days from today (negative n = in the past)
function daysFromToday(n) {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000)
  const sgDay = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' }) // e.g. "2026-10-14"
  return new Date(`${sgDay}T00:00:00+08:00`)
}

// One booking: starts in `start` days, lasts `days` days.
// `trip` is optional: { groupId, groupName } for requests sent together for one trip.
function makeBooking(owner, sitter, petIds, start, days, status, notes, trip = {}) {
  return {
    ownerId: owner._id,
    sitterId: sitter._id,
    petIds,
    startDate: daysFromToday(start),
    endDate: daysFromToday(start + days - 1),
    notes: `${SEED_TAG} ${notes}`,
    totalPrice: RATE_PER_DAY * days,
    status,
    groupId: trip.groupId || null,
    groupName: trip.groupName || ''
  }
}

async function clearOldSeed() {
  const oldUsers = await User.find({ email: { $in: SEED_EMAILS } })
  const oldIds = oldUsers.map((u) => u._id)

  await Booking.deleteMany({ $or: [{ ownerId: { $in: oldIds } }, { sitterId: { $in: oldIds } }] })
  await Pet.deleteMany({ owner: { $in: oldIds } })
  await User.deleteMany({ _id: { $in: oldIds } })
}

async function seed() {
  await connectDB()
  await clearOldSeed()

  const password = await bcrypt.hash(SEED_PASSWORD, 10)

  const owner = await User.create({ username: 'Seed Owner', email: SEED_OWNER_EMAIL, password, role: 'owner' })
  const sitter = await User.create({ username: 'Seed Sitter', email: SEED_SITTER_EMAIL, password, role: 'sitter' })
  const sitter2 = await User.create({ username: 'Second Sitter', email: SEED_SITTER2_EMAIL, password, role: 'sitter' })

  const mochi = await Pet.create({ owner: owner._id, name: 'Mochi', species: 'Dog', breed: 'Shiba Inu', age: 3, description: 'Friendly, loves walks' })
  const luna = await Pet.create({ owner: owner._id, name: 'Luna', species: 'Cat', breed: 'British Shorthair', age: 2, description: 'Shy at first' })

  // One trip sent to 2 sitters at once (same pets and dates, same groupId)
  const taiwan = { groupId: 'seed-taiwan-trip', groupName: 'Taiwan Trip' }

  await Booking.insertMany([
    makeBooking(owner, sitter, [mochi._id, luna._id], 20, 4, 'pending', 'Taiwan trip, asked 2 sitters', taiwan),
    makeBooking(owner, sitter2, [mochi._id, luna._id], 20, 4, 'accepted', 'Taiwan trip, asked 2 sitters', taiwan),
    makeBooking(owner, sitter, [luna._id], 14, 2, 'pending', 'New request: weekend for Luna'),
    makeBooking(owner, sitter, [mochi._id, luna._id], 5, 4, 'accepted', 'Accepted, waiting for payment'),
    makeBooking(owner, sitter, [mochi._id], 2, 2, 'paid', 'Paid, starts soon'),
    makeBooking(owner, sitter, [luna._id], 0, 1, 'in-progress', 'Session happening today'),
    makeBooking(owner, sitter, [mochi._id], -10, 3, 'completed', 'Finished last week'),
    makeBooking(owner, sitter, [luna._id], -5, 2, 'declined', 'Sitter was not free')
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