import Booking from '../models/bookingModel.js'
import { toSgtDateString } from '../models/Availability.js'

// Time maths for bookings. A booking runs from startDate + startTime to endDate + endTime (Singapore time).
// Everything is turned into "milliseconds since 1970" so two bookings can be compared with < and >.

// Statuses that hold the sitter's time. 'accepted' is included: once a sitter says yes, those hours stay
// theirs while the owner decides (the sitter can still decline to free them).
export const BOOKED_STATUSES = ['accepted', 'confirmed', 'paid', 'in-progress']

// Statuses where the owner has committed to a booking (used for the owner's same-pet clash check)
export const CONFIRMED_STATUSES = ['confirmed', 'in-progress']

const MINUTE_MS = 60 * 1000
const DAY_MS = 24 * 60 * MINUTE_MS

export const START_TIME_RE = /^([01]\d|2[0-3]):(00|30)$/ // 00:00 to 23:30
export const END_TIME_RE = /^(([01]\d|2[0-3]):(00|30)|24:00)$/ // 00:00 to 23:30, or 24:00 = end of the day

// '09:30' -> 570 (minutes since midnight)
export function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// Every half-hour start of a day: [0, 30, 60 ... 1410]
export const ALL_SLOTS = Array.from({ length: 48 }, (_, i) => i * 30)

// The half-hours a sitter is free on one Availability document.
// No `slots` saved = the whole day if available (old documents), nothing if blocked.
export function slotsOf(day) {
  if (day.status !== 'available') return []
  return Array.isArray(day.slots) ? day.slots : ALL_SLOTS
}

// Is every half-hour from `startMinutes` up to `endMinutes` (minutes after midnight, `endMinutes` may be 1440) in `slots`?
export function slotsCover(slots, startMinutes, endMinutes) {
  for (let m = startMinutes; m < endMinutes; m += 30) if (!slots.includes(m)) return false
  return true
}

// The exact start and end of a booking, in milliseconds.
// startDate / endDate are stored as midnight Singapore time. A booking with no times counts as all-day.
export function bookingRange(booking) {
  const startMinutes = booking.startTime ? toMinutes(booking.startTime) : 0
  const endMinutes = booking.endTime ? toMinutes(booking.endTime) : 24 * 60
  return {
    start: booking.startDate.getTime() + startMinutes * MINUTE_MS,
    end: booking.endDate.getTime() + endMinutes * MINUTE_MS
  }
}

// Two ranges overlap when each one starts before the other ends.
// A booking ending at 12:00 and another starting at 12:00 do NOT overlap.
export function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end
}

// The owner's confirmed / in-progress booking that overlaps `booking` AND is for at least one of the same pets, or null.
// Used when the owner confirms: a pet can't be with two sitters at once (different pets at the same time is fine).
export async function findPetClash(booking) {
  const range = bookingRange(booking)
  const candidates = await Booking.find({
    _id: { $ne: booking._id },
    ownerId: booking.ownerId,
    petIds: { $in: booking.petIds }, // shares at least one pet
    status: { $in: CONFIRMED_STATUSES },
    startDate: { $lte: new Date(range.end) },
    endDate: { $gte: new Date(range.start - DAY_MS) }
  })
  return candidates.find((c) => rangesOverlap(bookingRange(c), range)) || null
}

// The sitter's accepted / confirmed / paid / in-progress booking that overlaps `range`, or null.
// `excludeId` leaves one booking out (the one being accepted, so it doesn't clash with itself).
export async function findClash(sitterId, range, excludeId) {
  const filter = {
    sitterId,
    status: { $in: BOOKED_STATUSES },
    startDate: { $lte: new Date(range.end) }, // quick filter by day first...
    endDate: { $gte: new Date(range.start - DAY_MS) }
  }
  if (excludeId) filter._id = { $ne: excludeId }
  const candidates = await Booking.find(filter)
  return candidates.find((c) => rangesOverlap(bookingRange(c), range)) || null // ...then the exact time check
}

// The sitter's busy periods from now on, for the booking form to grey out: [{ start, end }] as ISO times.
export async function busyRanges(sitterId) {
  const bookings = await Booking.find({
    sitterId,
    status: { $in: BOOKED_STATUSES },
    endDate: { $gte: new Date(Date.now() - 2 * DAY_MS) }
  })
  return bookings
    .map(bookingRange)
    .filter((r) => r.end > Date.now())
    .map((r) => ({ start: new Date(r.start).toISOString(), end: new Date(r.end).toISOString() }))
}

// '09:30' -> '9:30 am', '24:00' -> '12:00 am'
export function formatTime(time) {
  const minutes = toMinutes(time) % (24 * 60)
  const h24 = Math.floor(minutes / 60)
  const m = String(minutes % 60).padStart(2, '0')
  return `${h24 % 12 || 12}:${m} ${h24 >= 12 ? 'pm' : 'am'}`
}

function formatDay(date) {
  return date.toLocaleDateString('en-SG', { timeZone: 'Asia/Singapore', day: 'numeric', month: 'short', year: 'numeric' })
}

// For error messages: '21 Oct 2026, 9:00 am – 12:00 pm' or '21 Oct 2026, 9:00 am – 22 Oct 2026, 5:00 pm'
export function describeBooking(booking) {
  if (!booking.startTime || !booking.endTime) {
    const days = toSgtDateString(booking.startDate) === toSgtDateString(booking.endDate)
      ? formatDay(booking.startDate)
      : `${formatDay(booking.startDate)} – ${formatDay(booking.endDate)}`
    return `${days} (all day)`
  }
  if (toSgtDateString(booking.startDate) === toSgtDateString(booking.endDate)) {
    return `${formatDay(booking.startDate)}, ${formatTime(booking.startTime)} – ${formatTime(booking.endTime)}`
  }
  return `${formatDay(booking.startDate)}, ${formatTime(booking.startTime)} – ${formatDay(booking.endDate)}, ${formatTime(booking.endTime)}`
}
