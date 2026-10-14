import mongoose from 'mongoose'

const bookingSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    petIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Pet' }],
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    notes: { type: String, default: '' },
    totalPrice: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'paid', 'in-progress', 'completed'],
      default: 'pending'
    }
  },
  { timestamps: true }
)

const Booking = mongoose.model('Booking', bookingSchema, 'bookings')

export default Booking