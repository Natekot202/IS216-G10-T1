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

// PATCH /api/bookings/:id/status   body: { "status": "accepted" } or { "status": "declined" }
export const updateBookingStatus = async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Not logged in' })
  }
  if (req.session.role !== 'sitter') {
    return res.status(403).json({ message: 'Only sitters can accept or decline bookings' })
  }

  const { status } = req.body
  if (!['accepted', 'declined'].includes(status)) {
    return res.status(400).json({ message: "Status must be 'accepted' or 'declined'" })
  }

  const booking = await Booking.findById(req.params.id)
  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' })
  }

  if (String(booking.sitterId) !== String(req.session.userId)) {
    return res.status(403).json({ message: 'This booking is not yours' })
  }

  if (booking.status !== 'pending') {
    return res.status(400).json({ message: `Only pending bookings can be accepted or declined. This one is ${booking.status}.` })
  }

  booking.status = status
  await booking.save()

  res.json(booking)
}