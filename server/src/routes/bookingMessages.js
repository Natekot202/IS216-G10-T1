import { Router } from 'express'
import mongoose from 'mongoose'
import Booking from '../models/bookingModel.js'
import Message, { MAX_MESSAGE_LENGTH } from '../models/Message.js'
import { requireLogin } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'

const router = Router()

// Messages can only be sent while a booking is confirmed or in progress
const CHAT_STATUSES = ['confirmed', 'in-progress']
const MAX_LOADED = 100   // a chat loads its newest 100 messages

// Loads the booking and checks that the logged-in user is its owner or sitter.
// If not, it sends the error itself and returns null, so the caller just stops.
async function loadMyBooking(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Booking not found.' })
    return null
  }
  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    res.status(404).json({ message: 'Booking not found.' })
    return null
  }
  const me = String(req.session.userId)
  if (me !== String(booking.ownerId) && me !== String(booking.sitterId)) {
    res.status(403).json({ message: 'This booking is not yours.' })
    return null
  }
  return booking
}

// What the frontend gets for one message (`mine` is worked out here so the page doesn't need user ids)
function shape(message, me) {
  return {
    _id: message._id,
    text: message.text,
    createdAt: message.createdAt,
    mine: String(message.sender?._id) === me,
    senderName: message.sender?.username ?? 'Deleted user'
  }
}

// GET /api/bookings/:id/messages?after=<ISO time>
// The booking's messages, oldest first. With `after`, only messages from that time on
// (it includes the boundary, so the page skips ones it already has by _id).
router.get('/:id/messages', requireLogin, asyncHandler(async (req, res) => {
  const booking = await loadMyBooking(req, res)
  if (!booking) return

  const filter = { booking: booking._id }
  if (req.query.after) {
    const after = new Date(req.query.after)
    if (Number.isNaN(after.getTime())) return res.status(400).json({ message: 'Invalid "after" time.' })
    filter.createdAt = { $gte: after }
  }

  const newest = await Message.find(filter)
    .sort({ createdAt: -1 })
    .limit(MAX_LOADED)
    .populate('sender', 'username')
  const me = String(req.session.userId)
  res.json(newest.reverse().map((m) => shape(m, me)))
}))

// POST /api/bookings/:id/messages   body: { text }
// Sends a message.
router.post('/:id/messages', requireLogin, asyncHandler(async (req, res) => {
  const booking = await loadMyBooking(req, res)
  if (!booking) return

  if (!CHAT_STATUSES.includes(booking.status)) {
    return res.status(400).json({ message: `Messages are only open while a booking is confirmed or in progress. This one is ${booking.status}.` })
  }

  const text = typeof req.body.text === 'string' ? req.body.text.trim() : ''
  if (!text) return res.status(400).json({ message: 'Please type a message.' })
  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ message: `Messages can be at most ${MAX_MESSAGE_LENGTH} characters.` })
  }

  const message = await Message.create({ booking: booking._id, sender: req.session.userId, text })
  await message.populate('sender', 'username')

  res.status(201).json(shape(message, String(req.session.userId)))
}))

export default router
