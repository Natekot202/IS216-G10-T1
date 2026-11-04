import { Router } from 'express'
import mongoose from 'mongoose'
import Availability, { sgtMidnight, toSgtDateString } from '../models/Availability.js'
import Booking from '../models/bookingModel.js'
import { requireSitter } from '../middleware/authMiddleware.js'
import User from '../models/UserModel.js'
import { listedFilter } from '../controllers/sitterController.js'
import { BOOKED_STATUSES, busyRanges, slotsOf, DAY_START_MIN, START_TIME_RE, END_TIME_RE, toMinutes, searchFreeDays } from '../utils/bookingTimes.js'
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
//   slots = the free half-hours that day, 420 (7am) to 1410 (11:30pm) (none = blocked). Without slots, status 'available' means the whole day (7am to 12am).
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
      // Free half-hours: whole numbers, 420 (7am) to 1410 (11:30pm), in 30-minute steps, no repeats
      const ok = Array.isArray(slots) && slots.every((m) => Number.isInteger(m) && m >= DAY_START_MIN && m <= 1410 && m % 30 === 0)
      if (!ok || new Set(slots).size !== slots.length) {
        return res.status(400).json({ message: 'Free time can only be between 7:00 am and 12:00 am, in half-hour steps, with no repeats.' })
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
    dayTimes: b.dayTimes, // the hours for each day (empty for old bookings, which use startTime/endTime every day)
    overnight: b.overnight, // only old bookings: they ran non-stop through the night (new ones use the same hours each day)
    status: b.status,
    ownerName: b.ownerId?.username || 'Pet owner',
    petNames: b.petIds.map((pet) => pet.name),
    pets: b.petIds.map((pet) => ({ name: pet.name, photo: pet.photo?.url || '' })), // for the pictures on the calendar's hover card
    notes: b.notes,
    totalPrice: b.totalPrice
  })))
}))

// GET /api/availability/search?from=2026-11-05&to=2026-11-08&start=09:00&end=17:00
// Public: for the owner's sitter search. Which of those days each listed sitter is free (start/end are optional, the hours for every day).
// Optional sitterIds=id1,id2 to check only those sitters.
// Out: [{ sitterId, freeDays: ['2026-11-05', ...], blockedDays: { '2026-11-06': 'Booked 2:00 pm – 4:00 pm' } }, ...]
// (must stay above /:sitterId, or "search" would be read as a sitter id)
router.get('/search', asyncHandler(async (req, res) => {
  const { from, to, start, end, sitterIds } = req.query
  const today = toSgtDateString(new Date())
  if (!sgtMidnight(from) || !sgtMidnight(to)) return res.status(400).json({ message: 'Choose a start and end date (YYYY-MM-DD).' })
  if (from < today) return res.status(400).json({ message: 'The start date is in the past.' })
  if (to < from) return res.status(400).json({ message: 'The end date is before the start date.' })

  // every day from `from` to `to`
  const days = []
  for (let d = sgtMidnight(from).getTime(); d <= sgtMidnight(to).getTime(); d += 24 * 60 * 60 * 1000) days.push(toSgtDateString(d))
  if (days.length > 60) return res.status(400).json({ message: 'Search at most 60 days at a time.' })

  // times: both or neither
  let startMinutes = null
  let endMinutes = null
  if (start || end) {
    if (typeof start !== 'string' || typeof end !== 'string' || !START_TIME_RE.test(start) || !END_TIME_RE.test(end)) {
      return res.status(400).json({ message: 'Choose both times: From 7:00 am to 11:30 pm, Until up to 12:00 am, in half hours.' })
    }
    startMinutes = toMinutes(start)
    endMinutes = toMinutes(end)
    if (endMinutes <= startMinutes) return res.status(400).json({ message: 'The Until time must be after the From time.' })
    if (sgtMidnight(from).getTime() + startMinutes * 60 * 1000 <= Date.now()) {
      return res.status(400).json({ message: 'That start time has already passed today.' })
    }
  }

  // the sitters to check: the ones the client sent, or everyone shown on the search page
  let ids
  if (sitterIds) {
    ids = String(sitterIds).split(',')
    if (!ids.every((id) => mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'Invalid sitter id' })
  } else {
    ids = await User.distinct('_id', await listedFilter())
  }

  res.json(await searchFreeDays(ids, days, startMinutes, endMinutes))
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
