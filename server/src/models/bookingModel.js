import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    // Times of day on startDate / endDate, Singapore time, in 30-minute steps (e.g. '09:00').
    // endTime can be '24:00' (end of the day). Old bookings have no times and count as all-day.
    startTime: { type: String, match: /^([01]\d|2[0-3]):(00|30)$/ },
    endTime: { type: String, match: /^(([01]\d|2[0-3]):(00|30)|24:00)$/ },
    // The hours for each day of the booking, e.g.
    // [{ date: '2026-11-03', startTime: '10:00', endTime: '24:00' }, { date: '2026-11-04', startTime: '07:00', endTime: '09:00' }]
    // Every booking made from now on has one entry per day. Old bookings have none and use startTime/endTime for every day.
    // (startTime above = the first day's start, endTime = the last day's end.)
    dayTimes: {
      type: [{
        _id: false,
        date: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
        startTime: { type: String, match: /^([01]\d|2[0-3]):(00|30)$/ },
        endTime: { type: String, match: /^(([01]\d|2[0-3]):(00|30)|24:00)$/ }
      }],
      default: []
    },
    notes: { type: String, default: '' },
    totalPrice: { type: Number, required: true, min: 0 },
    // pending -> accepted (sitter says yes) -> confirmed (owner picks this sitter) -> in-progress -> completed -> paid
    // declined: the sitter said no (from pending or accepted)
    // cancelled: the owner or sitter called it off before it started (see cancelledBy)
    // expired: the start time passed before the owner confirmed (utils/expireBookings.js)
    status: {
      type: String,
      enum: ['pending', 'accepted', 'confirmed', 'declined', 'paid', 'in-progress', 'completed', 'cancelled', 'expired'],
      default: 'pending'
    },
    cancelledBy: { type: String, enum: ['owner', 'sitter'] }, // only set on cancelled bookings
    cancelReason: { type: String, trim: true, maxlength: 300 } // why it was cancelled (required when cancelling), only set on cancelled bookings
  },
  { timestamps: true }
)

const Booking = mongoose.model('Booking', bookingSchema, 'bookings')

export default Booking