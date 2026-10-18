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
    notes: { type: String, default: '' },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'paid', 'in-progress', 'completed'],
      default: 'pending'
    },
    groupId: { type: String, default: null, index: true },
    groupName: { type: String, trim: true, maxlength: 60, default: '' }
  },
  { timestamps: true }
)

const Booking = mongoose.model('Booking', bookingSchema, 'bookings')

export default Booking