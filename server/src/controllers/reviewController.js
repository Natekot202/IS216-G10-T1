import mongoose from 'mongoose'
import Booking from '../models/bookingModel.js'
import Review from '../models/reviewModel.js'
import { recalcSitterRating } from '../utils/ratingsCalc.js'  
 
export async function createReview(req, res) {
  const { bookingId, rating, comment } = req.body

  if (!mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ message: 'Invalid booking.' })
  }
  const stars = Number(rating)
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return res.status(400).json({ message: 'Rating must be 1 to 5.' })
  }

  const booking = await Booking.findOne({ _id: bookingId, ownerId: req.session.userId })
  if (!booking) {
    return res.status(404).json({ message: 'Booking not found.' })
  }
  if (!['completed', 'paid'].includes(booking.status)) {
    return res.status(400).json({ message: 'You can only review a completed booking.' })
  }

  try {
    const review = await Review.create({
      booking: booking._id,
      sitter: booking.sitterId,
      owner: req.session.userId,
      rating: stars,
      comment: String(comment ?? '').trim().slice(0, 1000)
    })
    await recalcSitterRating(booking.sitterId)   
    res.status(201).json(review)
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You have already reviewed this booking.' })
    }
    throw err
  }
}

export async function getBookingReview(req, res) {
  if (!mongoose.isValidObjectId(req.params.bookingId)) {
    return res.status(404).json({ message: 'Booking not found.' })
  }
  const booking = await Booking.findById(req.params.bookingId)
  if (!booking) {
    return res.status(404).json({ message: 'Booking not found.' })
  }

  const me = String(req.session.userId)
  if (me !== String(booking.ownerId) && me !== String(booking.sitterId)) {
    return res.status(403).json({ message: 'This booking is not yours.' })
  }

  const review = await Review.findOne({ booking: booking._id })
  res.json(review)              
}