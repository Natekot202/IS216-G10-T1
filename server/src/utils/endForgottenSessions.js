import Booking from '../models/bookingModel.js'
import VisitSession from '../models/VisitSession.js'
import Walk from '../models/walkModel.js'
import { notify, notifyPaymentDue } from '../models/notificationModel.js'
import { toSgtDateString } from '../models/Availability.js'
import { autoEndWalk } from '../controllers/walkController.js'
import { bookingRange, sessionEndTime } from './bookingTimes.js'

// A session only ends when the sitter submits the report, so one they forget would stay open forever,
// and the owner could never pay. This closes it a generous while after the booked end time.
const GRACE_MS = 6 * 60 * 60 * 1000 // 6 hours
const CHECK_EVERY_MS = 5 * 60 * 1000 // every 5 minutes
const NO_REPORT = "The sitter didn't submit a report."

// Makes the booking 'completed', so the owner can pay as usual
async function completeBooking(booking) {
  const completed = await Booking.findOneAndUpdate({ _id: booking._id, status: 'in-progress' }, { status: 'completed' }, { new: true })
  if (!completed) return
  try {
    await notifyPaymentDue(completed)
  } catch (err) {
    console.error('Could not create payment-due notification:', err.message)
  }
}

async function endSession(visit, booking) {
  // a walk still going on ends with the session (only the sitter's phone has its path)
  const walks = await Walk.find({ visit: visit._id, status: 'in-progress' })
  for (const walk of walks) await autoEndWalk(walk)

  const ended = await VisitSession.findOneAndUpdate(
    { _id: visit._id, status: 'active' }, // not if the sitter has ended it just now
    { $set: { status: 'completed', endedAt: new Date(), autoEnded: true, 'report.notes': NO_REPORT }, $unset: { lastLocation: 1 } },
    { new: true }
  )
  if (!ended) return

  try {
    const message = "A session ended automatically because it wasn't ended after the booked time."
    await notify(booking.ownerId, 'session-auto-ended', message, { booking: booking._id })
    await notify(booking.sitterId, 'session-auto-ended', message, { booking: booking._id })
  } catch (err) {
    console.error('Could not create session-auto-ended notifications:', err.message)
  }
  if (visit.date === toSgtDateString(booking.endDate)) await completeBooking(booking)
}

// Ends every session past its time, then finishes bookings left in progress with nothing open
// (a multi-day booking whose last day never had a session would otherwise stay in progress).
// It never throws: a problem is logged, and the next check tries again.
export async function endForgottenSessions() {
  try {
    const now = Date.now()
    for (const visit of await VisitSession.find({ status: 'active' })) {
      const booking = await Booking.findById(visit.booking)
      if (booking && sessionEndTime(visit, booking) + GRACE_MS <= now) await endSession(visit, booking)
    }

    // quick filter by day first (endDate is midnight of the last day)...
    const bookings = await Booking.find({ status: 'in-progress', endDate: { $lte: new Date() } })
    for (const booking of bookings) {
      // ...then the exact end time
      if (bookingRange(booking).end + GRACE_MS > now) continue
      if (await VisitSession.exists({ booking: booking._id, status: 'active' })) continue
      await completeBooking(booking)
    }
  } catch (err) {
    console.error('Could not end forgotten sessions:', err.message)
  }
}

// Called once when the server starts: checks straight away, then every 5 minutes
export function startEndingForgottenSessions() {
  endForgottenSessions()
  setInterval(endForgottenSessions, CHECK_EVERY_MS)
}
