import { Router } from 'express'
import mongoose from 'mongoose'
import Availability, { sgtMidnight, toSgtDateString } from '../models/Availability.js'
import Booking from '../models/bookingModel.js'
import { requireSitter } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

// Bookings with these statuses take up the sitter's days.
const BOOKED_STATUSES = ['accepted', 'paid', 'in-progress']

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
// Read-only: the sitter's accepted / paid / in-progress bookings, to show on the calendar.
router.get('/me/bookings', requireSitter, asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ sitterId: req.session.userId, status: { $in: BOOKED_STATUSES } })
  res.json(bookings.map((b) => ({
    _id: b._id,
    startDate: toSgtDateString(b.startDate),
    endDate: toSgtDateString(b.endDate),
    status: b.status
  })))
}))

// GET /api/availability/:sitterId
// Public: a sitter's days from today on. Days taken by a booking come back as 'booked'.
router.get('/:sitterId', asyncHandler(async (req, res) => {
  const { sitterId } = req.params
  if (!mongoose.isValidObjectId(sitterId)) return res.status(400).json({ message: 'Invalid sitter id' })

  const today = sgtMidnight(toSgtDateString(new Date()))
  const days = await Availability.find({ sitterId, date: { $gte: today } }).sort({ date: 1 })
  const bookings = await Booking.find({ sitterId, status: { $in: BOOKED_STATUSES }, endDate: { $gte: today } })

  const isBooked = (date) => bookings.some((b) => b.startDate <= date && date <= b.endDate)
  res.json(days.map((d) => ({
    date: toSgtDateString(d.date),
    status: isBooked(d.date) ? 'booked' : d.status
  })))
}))

export default router
