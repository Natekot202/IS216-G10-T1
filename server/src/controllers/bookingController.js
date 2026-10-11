import Booking from '../models/bookingModel.js'

// GET /api/bookings                         -> all my bookings
// GET /api/bookings?status=pending,accepted -> only those statuses
export const getMyBookings = async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not logged in' })
  }

  const filter =
    req.session.role === 'sitter'
      ? { sitterId: req.session.userId }
      : { ownerId: req.session.userId }

  if (req.query.status) {
    filter.status = { $in: req.query.status.split(',') }
  }

  const bookings = await Booking.find(filter)
    .populate('ownerId', 'username email')
    .populate('sitterId', 'username email')
    .populate('petIds', 'name species')
    .sort({ startDate: 1 })

  res.json(bookings)
}