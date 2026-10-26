import mongoose from 'mongoose'

// One payment attempt by an owner for a completed booking (a receipt).
// We never store the full card number or the CVC, only the brand and the last 4 digits.
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: ['visa', 'mastercard'], required: true },
    cardLast4: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'successful', 'rejected'],
      default: 'pending'
    }
  },
  { timestamps: true }
)

const Payment = mongoose.model('Payment', paymentSchema, 'payments')

export default Payment