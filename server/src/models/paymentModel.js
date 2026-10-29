import mongoose from 'mongoose'

// One payment attempt by an owner for a completed booking (a receipt).
// Stripe handles the card. We only keep the card brand and the last 4 digits it tells us.
const paymentSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sitterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, default: '' }, // card brand from Stripe, e.g. 'visa', 'mastercard'
    cardLast4: { type: String, default: '' },
    stripeSessionId: { type: String, index: true }, // links this payment to Stripe's Checkout page
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