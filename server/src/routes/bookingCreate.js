import { Router } from 'express'
import mongoose from 'mongoose'
import Availability, { sgtMidnight, toSgtDateString } from '../models/Availability.js'
import Booking from '../models/bookingModel.js'
import CareChecklist, { CATEGORIES, FOOD_UNITS, taskIsOn } from '../models/CareChecklist.js'
import Pet from '../models/petModel.js'
import User from '../models/UserModel.js'
import WalkRoute from '../models/walkRouteModel.js'
import { requireOwner, requireLogin } from '../middleware/authMiddleware.js'
import { uploadPhoto } from '../middleware/upload.js'
import { uploadImage, deleteImage } from '../config/cloudinary.js'
import { bookingRange, dailyRanges, findClash, describeBooking, toMinutes, slotsOf, slotsCover, START_TIME_RE, END_TIME_RE } from '../utils/bookingTimes.js'
import asyncHandler from '../middleware/asyncHandler.js'
import { removeBookingFromGoogle } from '../utils/googleCalendar.js'
import { priceForTasks } from '../utils/servicePrices.js'

const router = Router()

const DAY_MS = 24 * 60 * 60 * 1000

// Booking statuses where the sitter may see a walk task's route (i.e. the owner has confirmed the booking)
const ROUTE_VISIBLE_STATUSES = ['confirmed', 'in-progress', 'completed', 'paid']

const TASK_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/ // 00:00 to 23:59
const MAX_REFERENCE_PHOTOS = 3

// Trims a text field, leaving it out if it's blank
const text = (value) => String(value ?? '').trim() || undefined

// Works out the care details to save on one task, keeping only the fields its category uses.
// Returns { details } to save on the task, or { error } with a message for the owner.
function careDetailsFor(task, input) {
  const details = { instructions: text(input?.instructions) }
  if (details.instructions?.length > 1000) return { error: 'Instructions can be up to 1000 characters.' }

  // Photos are added and removed one at a time (the routes below), so saving only updates their captions
  const captions = Array.isArray(input?.referencePhotos) ? input.referencePhotos : []
  details.referencePhotos = (task.details?.referencePhotos ?? []).map((photo) => {
    const sent = captions.find((c) => String(c?._id) === String(photo._id))
    return { _id: photo._id, url: photo.url, publicId: photo.publicId, caption: sent ? text(sent.caption) : photo.caption }
  })
  if (details.referencePhotos.some((p) => p.caption?.length > 80)) return { error: 'Photo captions can be up to 80 characters.' }

  // Times are optional, but if there are any there must be one for each time a day
  const times = Array.isArray(input?.times) ? input.times.filter(Boolean) : []
  if (times.some((t) => !TASK_TIME_RE.test(t))) return { error: 'Choose each time as HH:MM.' }
  if (times.length > 0 && times.length !== task.dailyFrequency) {
    return { error: `"${task.title}" needs ${task.dailyFrequency} time(s), or none.` }
  }
  if (times.length > 0) details.times = times

  if (task.category === 'feed') {
    details.food = text(input?.food)
    if (input?.amount !== undefined && input.amount !== null && input.amount !== '') {
      const amount = Number(input.amount)
      if (!Number.isFinite(amount) || amount < 0) return { error: 'The amount must be a number, 0 or more.' }
      details.amount = amount
    }
    if (input?.unit) {
      if (!FOOD_UNITS.includes(input.unit)) return { error: `The unit must be one of: ${FOOD_UNITS.join(', ')}.` }
      details.unit = input.unit
    }
  }

  if (task.category === 'medication') {
    details.medicationName = text(input?.medicationName)
    details.dosage = text(input?.dosage)
    details.withFood = input?.withFood === true
  }

  if ([details.food, details.medicationName, details.dosage].some((v) => v?.length > 100)) {
    return { error: 'Food, medicine and dosage can be up to 100 characters.' }
  }
  return { details }
}

// Works out the route for a walk task.
// choice: the id of one of the owner's routes, or 'instructions' for "follow my instructions".
// Returns { walkRoute } to save on the task, or { error } with a message for the owner.
async function walkRouteFor(choice, ownerId) {
  if (choice === 'instructions') return { walkRoute: { mode: 'instructions' } }
  if (!mongoose.isValidObjectId(choice)) {
    return { error: 'Choose a route for each walk task, or "follow my instructions".' }
  }
  const route = await WalkRoute.findOne({ _id: choice, owner: ownerId }) // must be this owner's own route
  if (!route) return { error: 'That walking route was not found. It may have been deleted.' }
  return {
    walkRoute: { mode: 'route', route: route._id, name: route.name, path: route.path, distanceM: route.distanceM }
  }
}

// Every 'YYYY-MM-DD' from start to end, inclusive.
function daysBetween(start, end) {
  const days = []
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) days.push(toSgtDateString(new Date(t)))
  return days
}

// POST /api/bookings
// Body: { sitterId, petIds: [id], startDate: 'YYYY-MM-DD', startTime: '09:00', endDate: 'YYYY-MM-DD', endTime: '17:30', notes, tasks }
// Times are Singapore time in 30-minute steps from 07:00 to 24:00 (24:00 = end of the day).
// The times are the hours for EACH day: 3 Nov to 5 Nov, 09:00 to 17:00 = 9am to 5pm on each of the three days.
// Nothing runs overnight, so there are no overnight stays any more (an `overnight` sent by an old page is ignored).
// Creates a 'pending' booking if every check passes.
router.post('/', requireOwner, asyncHandler(async (req, res) => {
  const { sitterId, petIds, startDate, startTime, endDate, endTime, notes = '', tasks = [] } = req.body
  const ownerId = req.session.userId

  // 1. Input checks
  if (!mongoose.isValidObjectId(sitterId)) return res.status(400).json({ message: 'Choose a sitter.' })
  if (!Array.isArray(petIds) || petIds.length === 0) return res.status(400).json({ message: 'Select at least one pet.' })

  const start = sgtMidnight(startDate)
  const end = sgtMidnight(endDate)
  if (!start || !end) return res.status(400).json({ message: 'Choose a valid start and end date.' })
  if (startDate < toSgtDateString(new Date())) return res.status(400).json({ message: 'Start date cannot be in the past.' })
  if (end < start) return res.status(400).json({ message: 'End date must be on or after the start date.' })

  // Times are compulsory: HH:00 or HH:30, between 7am and 12am midnight. (An all-day booking is 07:00 to 24:00.)
  if (!START_TIME_RE.test(startTime || '') || !END_TIME_RE.test(endTime || '') || endTime === '07:00') {
    return res.status(400).json({ message: 'Choose a start time and an end time between 7:00 am and 12:00 am (in 30-minute steps).' })
  }
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    return res.status(400).json({ message: 'End time must be after the start time (the times are the hours for each day).' })
  }
  const range = bookingRange({ startDate: start, endDate: end, startTime, endTime }) // first start and last end
  const ranges = dailyRanges({ startDate: start, endDate: end, startTime, endTime }) // the exact hours on each day
  if (range.start <= Date.now()) return res.status(400).json({ message: 'The start time has already passed.' })

  // 2. The sitter exists
  const sitter = await User.findById(sitterId)
  if (!sitter || sitter.role !== 'sitter') return res.status(404).json({ message: 'Sitter not found.' })

  // 3. The pets belong to this owner
  const pets = await Pet.find({ _id: { $in: petIds }, owner: ownerId })
  if (pets.length !== petIds.length) return res.status(400).json({ message: 'You can only book for your own pets.' })

  // 4. The sitter is available on every day, and for the hours asked for on each day
  const days = daysBetween(start, end)
  const schedule = days.map((date) => ({ date, startTime, endTime }))
  const saved = await Availability.find({ sitterId, date: { $gte: start, $lte: end } })
  const byDay = Object.fromEntries(saved.map((a) => [toSgtDateString(a.date), a]))
  const missing = days.filter((d) => byDay[d]?.status !== 'available')
  if (missing.length) {
    return res.status(409).json({ message: `The sitter is not available on ${missing.join(', ')}.` })
  }
  const wrongHours = days.filter((d) => {
    return !slotsCover(slotsOf(byDay[d]), toMinutes(startTime), toMinutes(endTime)) // the same hours on every day
  })
  if (wrongHours.length) {
    return res.status(409).json({ message: `The sitter is not available at those times on ${wrongHours.join(', ')}.` })
  }

  // 5. No clash with the sitter's accepted / confirmed / paid / in-progress bookings, checked by exact time on each day.
  // (Pending requests don't block, because the sitter hasn't said yes yet.)
  const clash = await findClash(sitterId, ranges)
  if (clash) {
    return res.status(409).json({ message: `The sitter is already booked ${describeBooking(clash)}.` })
  }

  // 6. Care checklist: at least one task, because the price is worked out from the tasks
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ message: 'Add at least one care task. The price is based on the tasks.' })
  }
  if (tasks.length > 20) {
    return res.status(400).json({ message: 'Send at most 20 care tasks.' })
  }
  const bookingPetIds = petIds.map(String)
  const items = []
  for (const t of tasks) {
    const title = String(t.title || '').trim()
    if (!title) return res.status(400).json({ message: 'Every care task needs a description.' })
    if (!CATEGORIES.includes(t.category)) return res.status(400).json({ message: `"${t.category}" is not a task type.` })
    if (!Number.isInteger(t.dailyFrequency) || t.dailyFrequency < 1 || t.dailyFrequency > 10) {
      return res.status(400).json({ message: 'Times per day must be a whole number from 1 to 10.' })
    }
    // A task is for the pets chosen on it, which must be pets in this booking. None chosen = all of them.
    const taskPets = Array.isArray(t.petIds) && t.petIds.length ? t.petIds.map(String) : bookingPetIds
    if (!taskPets.every((id) => bookingPetIds.includes(id))) {
      return res.status(400).json({ message: 'A care task can only be for a pet in this booking.' })
    }
    // Walk tasks need a route (copied from the owner's routes) or "follow my instructions"
    let walkRoute
    if (t.category === 'walk') {
      const result = await walkRouteFor(t.walkRouteId, ownerId)
      if (result.error) return res.status(400).json({ message: result.error })
      walkRoute = result.walkRoute
    }
    // A task is done every day, unless the owner chose some of the booking's days. All of them = every day.
    const taskDays = Array.isArray(t.days) ? [...new Set(t.days)] : []
    if (!taskDays.every((d) => days.includes(d))) {
      return res.status(400).json({ message: `"${title}" is on a day outside this booking.` })
    }
    const onSomeDays = taskDays.length > 0 && taskDays.length < days.length
    items.push({ category: t.category, title, dailyFrequency: t.dailyFrequency, petIds: taskPets, walkRoute, days: onSomeDays ? taskDays : undefined })
  }
  // Every booked day needs a task: the price comes from the tasks, so an empty day would hold the sitter's time for nothing
  const emptyDay = days.find((d) => !items.some((item) => taskIsOn(item, d)))
  if (emptyDay) {
    return res.status(400).json({ message: `${emptyDay} has no tasks. Add a task for that day, or remove the day.` })
  }

  // 7. Create the booking.
 // Price = each task's fixed price × times a day × its number of days, added up
  const booking = await Booking.create({
    ownerId,
    sitterId,
    petIds,
    startDate: start,
    startTime: schedule[0].startTime, // the first day's start
    endDate: end,
    endTime: schedule[schedule.length - 1].endTime, // the last day's end
    dayTimes: schedule, // the hours for each day
    notes,
    totalPrice: priceForTasks(items, days.length),
    status: 'pending'
  })

  // 8. Save the care checklist, linked to the booking by bookingId
  if (items.length) await CareChecklist.create({ bookingId: booking._id, items })

  res.status(201).json({
    _id: booking._id,
    startDate: toSgtDateString(booking.startDate),
    startTime: booking.startTime,
    endDate: toSgtDateString(booking.endDate),
    endTime: booking.endTime,
    dayTimes: booking.dayTimes,
    days: days.length,
    totalPrice: booking.totalPrice,
    status: booking.status,
    tasks: items.length
  })
}))

// GET /api/bookings/:id/care-tasks
// The care tasks the owner added to this booking request. Only the booking's owner or sitter can read them.
// Out: { items: [{ category, title, petIds, dailyFrequency, days, walkRoute, details }], detailsSavedAt }
// (an empty list if there are none)
router.get('/:id/care-tasks', requireLogin, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Booking not found.' })
  const booking = await Booking.findById(req.params.id)
  if (!booking) return res.status(404).json({ message: 'Booking not found.' })

  const me = String(req.session.userId)
  if (me !== String(booking.ownerId) && me !== String(booking.sitterId)) {
    return res.status(403).json({ message: 'This booking is not yours.' })
  }

  const checklist = await CareChecklist.findOne({ bookingId: booking._id })
  const items = checklist ? checklist.items.map((item) => item.toObject()) : []

  // The sitter only gets a walk route's path once the owner has confirmed the booking; before that, just its name
  const isSitter = me === String(booking.sitterId)
  if (isSitter && !ROUTE_VISIBLE_STATUSES.includes(booking.status)) {
    for (const item of items) {
      if (item.walkRoute?.path) {
        delete item.walkRoute.path
        item.walkRoute.hidden = true
      }
    }
  }
  res.json({ items, detailsSavedAt: checklist?.detailsSavedAt ?? null })
}))

// The booking and checklist the owner can add care details to, or sends the reason they can't and returns null.
// A booking becomes in-progress when the first session starts, so this also locks the details from then on.
async function loadEditableChecklist(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Booking not found.' })
    return null
  }
  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    res.status(404).json({ message: 'Booking not found.' })
    return null
  }
  if (String(req.session.userId) !== String(booking.ownerId)) {
    res.status(403).json({ message: 'This booking is not yours.' })
    return null
  }
  if (booking.status !== 'confirmed') {
    res.status(400).json({ message: 'Care details can only be changed on a confirmed booking, before the first session starts.' })
    return null
  }
  const checklist = await CareChecklist.findOne({ bookingId: booking._id })
  if (!checklist) res.status(404).json({ message: 'This booking has no care tasks.' })
  return checklist
}

// PATCH /api/bookings/:id/care-details
// The owner adds or changes the care details on a confirmed booking. Only `details` can change: a task's
// category and times a day set the price. An empty list is fine: it means the owner has nothing to add.
// In: { tasks: [{ taskId, details: { instructions, times, food, amount, unit, medicationName, dosage, withFood } }] }
// Out: { items, detailsSavedAt }
router.patch('/:id/care-details', requireOwner, asyncHandler(async (req, res) => {
  const checklist = await loadEditableChecklist(req, res)
  if (!checklist) return

  const { tasks } = req.body
  if (!Array.isArray(tasks) || tasks.length > 20) {
    return res.status(400).json({ message: 'Send a list of up to 20 tasks.' })
  }

  // Check everything first, so one bad task doesn't leave the others half saved
  const changes = []
  for (const t of tasks) {
    const task = mongoose.isValidObjectId(t?.taskId) ? checklist.items.id(t.taskId) : null
    if (!task) return res.status(404).json({ message: 'Task not found.' })
    const { details, error } = careDetailsFor(task, t.details)
    if (error) return res.status(400).json({ message: error })
    changes.push({ task, details })
  }

  for (const { task, details } of changes) task.details = details
  checklist.detailsSavedAt = new Date()
  await checklist.save()
  res.json({ items: checklist.items, detailsSavedAt: checklist.detailsSavedAt })
}))

// POST /api/bookings/:id/care-details/:taskId/photos   multipart: photo
// Adds one reference photo to a task, up to 3. Out: { items, detailsSavedAt }
router.post('/:id/care-details/:taskId/photos', requireOwner, uploadPhoto, asyncHandler(async (req, res) => {
  const checklist = await loadEditableChecklist(req, res)
  if (!checklist) return
  const task = mongoose.isValidObjectId(req.params.taskId) ? checklist.items.id(req.params.taskId) : null
  if (!task) return res.status(404).json({ message: 'Task not found.' })
  if ((task.details?.referencePhotos?.length ?? 0) >= MAX_REFERENCE_PHOTOS) {
    return res.status(400).json({ message: `A task can have up to ${MAX_REFERENCE_PHOTOS} photos.` })
  }
  if (!req.file) return res.status(400).json({ message: 'Choose a photo first.' })

  const uploaded = await uploadImage(req.file.buffer, {
    folder: 'petsociety/care-details',
    transformation: [{ width: 1200, height: 1200, crop: 'limit' }]
  })
  try {
    if (!task.details) task.details = {}
    if (!task.details.referencePhotos) task.details.referencePhotos = []
    task.details.referencePhotos.push({ url: uploaded.secure_url, publicId: uploaded.public_id })
    await checklist.save()
  } catch (err) {
    await deleteImage(uploaded.public_id)
    throw err
  }
  res.status(201).json({ items: checklist.items, detailsSavedAt: checklist.detailsSavedAt })
}))

// DELETE /api/bookings/:id/care-details/:taskId/photos/:photoId
// Removes one reference photo from a task. Out: { items, detailsSavedAt }
router.delete('/:id/care-details/:taskId/photos/:photoId', requireOwner, asyncHandler(async (req, res) => {
  const checklist = await loadEditableChecklist(req, res)
  if (!checklist) return
  const task = mongoose.isValidObjectId(req.params.taskId) ? checklist.items.id(req.params.taskId) : null
  const photos = task?.details?.referencePhotos
  const photo = mongoose.isValidObjectId(req.params.photoId) ? photos?.id(req.params.photoId) : null
  if (!photo) return res.status(404).json({ message: 'Photo not found.' })

  const { publicId } = photo
  photos.pull(photo._id)
  await checklist.save()
  await deleteImage(publicId)
  res.json({ items: checklist.items, detailsSavedAt: checklist.detailsSavedAt })
}))

// GET /api/bookings/:id
// One booking, for the Booking Detail page. Only the booking's owner or sitter can read it.
router.get('/:id', requireLogin, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Booking not found.' })
  const booking = await Booking.findById(req.params.id)
    .populate('ownerId', 'username email profilePicture') // the picture is for the owner card on the Booking Detail page
    .populate('sitterId', 'username email profilePicture sitterProfile.ratingAvg sitterProfile.ratingCount') // + the stars for the sitter card
    .populate('petIds', 'name species breed photo') // + the pets' pictures and breed
  if (!booking) return res.status(404).json({ message: 'Booking not found.' })

  const me = String(req.session.userId)
  if (me !== String(booking.ownerId._id) && me !== String(booking.sitterId._id)) {
    return res.status(403).json({ message: 'This booking is not yours.' })
  }

  res.json(booking)
}))

// PATCH /api/bookings/:id/cancel
// The booking's owner or sitter cancels it. Only pending, accepted or confirmed bookings that haven't started yet can be cancelled
// (a paid booking would need a refund, which doesn't exist yet). The owner uses this to withdraw a request.
// The sitter's hours free up by themselves: only accepted / confirmed / paid / in-progress bookings block the calendar.
// Body: { reason: 'why it was cancelled' } (required, up to 300 characters), saved as cancelReason so the other person can see it
// Out: the booking, plus googleRemoved: { removed, reason }
router.patch('/:id/cancel', requireLogin, asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Booking not found.' })
  const booking = await Booking.findById(req.params.id)
  if (!booking) return res.status(404).json({ message: 'Booking not found.' })

  const me = String(req.session.userId)
  if (me !== String(booking.ownerId) && me !== String(booking.sitterId)) {
    return res.status(403).json({ message: 'This booking is not yours.' })
  }
  if (!['pending', 'accepted', 'confirmed'].includes(booking.status)) {
    return res.status(400).json({ message: `Only pending, accepted or confirmed bookings can be cancelled. This one is ${booking.status}.` })
  }
  if (bookingRange(booking).start <= Date.now()) {
    return res.status(400).json({ message: 'This booking has already started, so it can no longer be cancelled.' })
  }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
  if (!reason) return res.status(400).json({ message: 'Please give a reason for cancelling.' })
  if (reason.length > 300) return res.status(400).json({ message: 'The reason can be at most 300 characters.' })

  booking.status = 'cancelled'
  booking.cancelReason = reason
  booking.cancelledBy = me === String(booking.ownerId) ? 'owner' : 'sitter' // so the other side can see who called it off
  await booking.save()

  // Take the booking out of the sitter's Google Calendar. This never blocks or fails the cancel.
  const googleRemoved = await removeBookingFromGoogle(booking)

  res.json({ ...booking.toObject(), googleRemoved })
}))

// doesnt delete from database itself ; kiv this 
// can use to see which people cancel, and the booking wont js vanish from sitter pov 

export default router
