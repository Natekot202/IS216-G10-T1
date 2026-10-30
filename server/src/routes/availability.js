import { Router } from 'express'
import mongoose from 'mongoose'
import Availability, { sgtMidnight, toSgtDateString } from '../models/Availability.js'
import Booking from '../models/bookingModel.js'
import { requireSitter } from '../middleware/authMiddleware.js'
import { BOOKED_STATUSES, busyRanges, slotsOf } from '../utils/bookingTimes.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()


// What the API sends for one day: the date, the status, and the free half-hours (minutes after midnight).
function dayJson(d) {
  return { date: toSgtDateString(d.date), status: d.status, slots: slotsOf(d) }
}

// GET /api/availability/me
// The logged-in sitter's days, e.g. [{ date: '2026-10-20', status: 'available', slots: [540, 570, ...] }]
router.get('/me', requireSitter, asyncHandler(async (req, res) => {
  const days = await Availability.find({ sitterId: req.session.userId }).sort({ date: 1 })
  res.json(days.map(dayJson))
}))

// PUT /api/availability/me
// Body: { changes: [{ date: '2026-10-20', slots: [540, 570, ...] }, { date: '2026-10-21', status: 'blocked' }, ...] }
//   slots = the free half-hours that day (none = blocked). Without slots, status 'available' means the whole day.
router.put('/me', requireSitter, asyncHandler(async (req, res) => {
  const { changes } = req.body
  if (!Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ message: 'Send at least one change.' })
  }

  const today = toSgtDateString(new Date())
  const updates = [] // what to save, once every change has been checked
  for (const { date, status, slots } of changes) {
    if (!sgtMidnight(date)) return res.status(400).json({ message: `"${date}" is not a valid date.` })
    if (date < today) return res.status(400).json({ message: `${date} is in the past.` })

    if (slots !== undefined) {
      // Free half-hours: whole numbers, 0 to 1410, in 30-minute steps, no repeats
      const ok = Array.isArray(slots) && slots.every((m) => Number.isInteger(m) && m >= 0 && m <= 1410 && m % 30 === 0)
      if (!ok || new Set(slots).size !== slots.length) {
        return res.status(400).json({ message: 'Slots must be half-hour start times between 0 and 1410, with no repeats.' })
      }
      const sorted = [...slots].sort((a, b) => a - b)
      updates.push({ date, set: { status: sorted.length ? 'available' : 'blocked', slots: sorted } })
    } else if (status === 'available' || status === 'blocked') {
      updates.push({ date, set: { status }, unset: { slots: '' } }) // a whole day: no list of half-hours
    } else {
      return res.status(400).json({ message: 'Status must be "available" or "blocked".' })
    }
  }

  // Create the day if it doesn't exist yet, otherwise update it ("upsert").
  for (const { date, set, unset } of updates) {
    await Availability.updateOne(
      { sitterId: req.session.userId, date: sgtMidnight(date) },
      unset ? { $set: set, $unset: unset } : { $set: set },
      { upsert: true }
    )
  }
  res.json({ message: `Saved ${changes.length} day(s).` })
}))

// GET /api/availability/me/bookings
// Read-only: the sitter's accepted / confirmed / paid / in-progress bookings, to show on the calendar
// (with the owner's name, the pets' names, notes and price, so a clicked day can list them).
router.get('/me/bookings', requireSitter, asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ sitterId: req.session.userId, status: { $in: BOOKED_STATUSES } })
    .populate('ownerId', 'username') // swap the owner's id for their name
    .populate('petIds', 'name photo') // swap the pet ids for their names and pictures
  res.json(bookings.map((b) => ({
    _id: b._id,
    startDate: toSgtDateString(b.startDate),
    startTime: b.startTime, // undefined for old all-day bookings
    endDate: toSgtDateString(b.endDate),
    endTime: b.endTime,
    status: b.status,
    ownerName: b.ownerId?.username || 'Pet owner',
    petNames: b.petIds.map((pet) => pet.name),
    pets: b.petIds.map((pet) => ({ name: pet.name, photo: pet.photo?.url || '' })), // for the pictures on the calendar's hover card
    notes: b.notes,
    totalPrice: b.totalPrice
  })))
}))

// GET /api/availability/:sitterId
// Public: a sitter's days from today on, e.g. [{ date: '2026-10-21', status: 'available', slots: [540, 570, ...] }].
// A day with a booking stays 'available': other times that day may be free (see /busy).
router.get('/:sitterId', asyncHandler(async (req, res) => {
  const { sitterId } = req.params
  if (!mongoose.isValidObjectId(sitterId)) return res.status(400).json({ message: 'Invalid sitter id' })

  const today = sgtMidnight(toSgtDateString(new Date()))
  const days = await Availability.find({ sitterId, date: { $gte: today } }).sort({ date: 1 })
  res.json(days.map(dayJson))
}))

// GET /api/availability/:sitterId/busy
// Public: the times the sitter is already booked (accepted / confirmed / paid / in-progress), so the booking form can grey them out.
// Out: [{ start: '2026-10-21T01:00:00.000Z', end: '2026-10-21T04:00:00.000Z' }, ...]
router.get('/:sitterId/busy', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sitterId)) return res.status(400).json({ message: 'Invalid sitter id' })
  res.json(await busyRanges(req.params.sitterId))
}))

export default router
