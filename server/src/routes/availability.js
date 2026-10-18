import { Router } from 'express'
import mongoose from 'mongoose'
import Availability, { sgtMidnight, toSgtDateString } from '../models/Availability.js'
import Booking from '../models/bookingModel.js'
import { requireSitter } from '../middleware/authMiddleware.js'
import { BOOKED_STATUSES, busyRanges } from '../utils/bookingTimes.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()


// GET /api/availability/me
// The logged-in sitter's days, e.g. [{ date: '2026-10-20', status: 'available' }]
router.get('/me', requireSitter, asyncHandler(async (req, res) => {
  const days = await Availability.find({ sitterId: req.session.userId }).sort({ date: 1 })
  res.json(days.map((d) => ({ date: toSgtDateString(d.date), status: d.status })))
}))

// PUT /api/availability/me
// Body: { changes: [{ date: '2026-10-20', status: 'available' | 'blocked' }, ...] }
router.put('/me', requireSitter, asyncHandler(async (req, res) => {
  const { changes } = req.body
  if (!Array.isArray(changes) || changes.length === 0) {
    return res.status(400).json({ message: 'Send at least one change.' })
  }

  const today = toSgtDateString(new Date())
  for (const { date, status } of changes) {
    if (!sgtMidnight(date)) return res.status(400).json({ message: `"${date}" is not a valid date.` })
    if (date < today) return res.status(400).json({ message: `${date} is in the past.` })
    if (status !== 'available' && status !== 'blocked') {
      return res.status(400).json({ message: 'Status must be "available" or "blocked".' })
    }
  }

  // Create the day if it doesn't exist yet, otherwise update it ("upsert").
  for (const { date, status } of changes) {
    await Availability.updateOne(
      { sitterId: req.session.userId, date: sgtMidnight(date) },
      { status },
      { upsert: true }
    )
  }
  res.json({ message: `Saved ${changes.length} day(s).` })
}))

// GET /api/availability/me/bookings
// Read-only: the sitter's accepted / paid / in-progress bookings, to show on the calendar
// (with the owner's name, the pets' names, notes and price, so a clicked day can list them).
router.get('/me/bookings', requireSitter, asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ sitterId: req.session.userId, status: { $in: BOOKED_STATUSES } })
    .populate('ownerId', 'username') // swap the owner's id for their name
    .populate('petIds', 'name') // swap the pet ids for their names
  res.json(bookings.map((b) => ({
    _id: b._id,
    startDate: toSgtDateString(b.startDate),
    startTime: b.startTime, // undefined for old all-day bookings
    endDate: toSgtDateString(b.endDate),
    endTime: b.endTime,
    status: b.status,
    ownerName: b.ownerId?.username || 'Pet owner',
    petNames: b.petIds.map((pet) => pet.name),
    notes: b.notes,
    totalPrice: b.totalPrice
  })))
}))

// GET /api/availability/:sitterId
// Public: a sitter's days from today on, e.g. [{ date: '2026-10-21', status: 'available' }].
// A day with a booking stays 'available': other times that day may be free (see /busy).
router.get('/:sitterId', asyncHandler(async (req, res) => {
  const { sitterId } = req.params
  if (!mongoose.isValidObjectId(sitterId)) return res.status(400).json({ message: 'Invalid sitter id' })

  const today = sgtMidnight(toSgtDateString(new Date()))
  const days = await Availability.find({ sitterId, date: { $gte: today } }).sort({ date: 1 })
  res.json(days.map((d) => ({ date: toSgtDateString(d.date), status: d.status })))
}))

// GET /api/availability/:sitterId/busy
// Public: the times the sitter is already booked (accepted / paid / in-progress), so the booking form can grey them out.
// Out: [{ start: '2026-10-21T01:00:00.000Z', end: '2026-10-21T04:00:00.000Z' }, ...]
router.get('/:sitterId/busy', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.sitterId)) return res.status(400).json({ message: 'Invalid sitter id' })
  res.json(await busyRanges(req.params.sitterId))
}))

export default router
