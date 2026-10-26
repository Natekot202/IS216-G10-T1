import Payment from '../models/paymentModel.js'
import Booking from '../models/bookingModel.js'

// Simulated bank: this test card number is always declined
const DECLINED_TEST_CARD = '4000000000000002'

// Luhn check: the maths every real card number passes
function passesLuhn(number) {
  let sum = 0
  let shouldDouble = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i])
    if (shouldDouble) {
      digit = digit * 2
      if (digit > 9) digit = digit - 9
    }
    sum = sum + digit
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

// VISA starts with 4. Mastercard starts with 51–55 or 2221–2720.
function getCardBrand(number) {
  if (number.startsWith('4')) return 'visa'
  const firstTwo = Number(number.slice(0, 2))
  const firstFour = Number(number.slice(0, 4))
  if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) return 'mastercard'
  return null
}

// Expiry must be "MM/YY" and not before this month
function isValidExpiry(expiry) {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry || '')
  if (!match) return false
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12) return false
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth() + 1
  return year > thisYear || (year === thisYear && month >= thisMonth)
}

// POST /api/payments   body: { bookingId, cardNumber, expiry, cvc }
// The owner pays AFTER the sitter has finished: only 'completed' bookings can be paid.
export const createPayment = async (req, res) => {
  const { bookingId, cardNumber, expiry, cvc } = req.body

  if (!bookingId || !cardNumber || !expiry || !cvc) {
    return res.status(400).json({ message: 'Please fill in all card details.' })
  }

  const booking = await Booking.findById(bookingId)
  if (!booking) {
    return res.status(404).json({ message: 'Booking not found' })
  }
  if (String(booking.ownerId) !== String(req.session.userId)) {
    return res.status(403).json({ message: 'This booking is not yours' })
  }
  if (booking.status !== 'completed') {
    return res.status(400).json({ message: `You can only pay once the sitter has completed the booking. This one is ${booking.status}.` })
  }

  const digits = String(cardNumber).replace(/\s/g, '')
  if (!/^\d{16}$/.test(digits) || !passesLuhn(digits)) {
    return res.status(400).json({ message: 'Card number is not valid.' })
  }
  const brand = getCardBrand(digits)
  if (!brand) {
    return res.status(400).json({ message: 'Only VISA and Mastercard are accepted.' })
  }
  if (!isValidExpiry(expiry)) {
    return res.status(400).json({ message: 'Expiry must be MM/YY and not in the past.' })
  }
  if (!/^\d{3}$/.test(String(cvc))) {
    return res.status(400).json({ message: 'CVC must be 3 digits.' })
  }

  const payment = await Payment.create({
    bookingId: booking._id,
    ownerId: booking.ownerId,
    sitterId: booking.sitterId,
    amount: booking.totalPrice,
    method: brand,
    cardLast4: digits.slice(-4),
    status: 'pending'
  })

  if (digits === DECLINED_TEST_CARD) {
    payment.status = 'rejected'
    await payment.save()
    return res.status(402).json({ message: 'Your card was declined. Please try another card.', payment })
  }

  payment.status = 'successful'
  await payment.save()

  booking.status = 'paid'
  await booking.save()

  res.status(201).json({ message: 'Payment successful', payment })
}

// GET /api/payments/mine -> my payment records, newest first
// (sitter: payments made to me, owner: payments I made)
export const getMyPayments = async (req, res) => {
  const field = req.session.role === 'sitter' ? 'sitterId' : 'ownerId'
  const payments = await Payment.find({ [field]: req.session.userId })
    .populate({
      path: 'bookingId',
      select: 'startDate endDate startTime endTime petIds',
      populate: { path: 'petIds', select: 'name' }
    })
    .populate('ownerId', 'username')
    .populate('sitterId', 'username')
    .sort({ createdAt: -1 })

  res.json(payments)
}