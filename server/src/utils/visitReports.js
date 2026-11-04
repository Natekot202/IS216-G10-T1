import CareChecklist, { taskIsOn } from '../models/CareChecklist.js'
import VisitSession from '../models/VisitSession.js'
import Walk from '../models/walkModel.js'
import Review from '../models/reviewModel.js'
import Message from '../models/Message.js'
import { toSgtDateString } from '../models/Availability.js'
import { bookingRange, bookedDays, reviewOpenUntil } from './bookingTimes.js'

// The care reports of finished bookings, for the owner's "Recently ended" list and the visit report window.
// `bookings` must have sitterId, ownerId and petIds populated.
// Returns one entry per booking, in the same order:
// { booking, endedAt, reviewOpenUntil, totalDays, days: [...], review, messageCount }
// `days` only has the days that had a session, oldest first; dayNumber still counts every booked day.
// Everything is loaded with one query per collection, not one per booking.
export async function buildReportEntries(bookings) {
  const ids = bookings.map((b) => b._id)
  const [visits, checklists, reviews, counts] = await Promise.all([
    VisitSession.find({ booking: { $in: ids } }).select('-lastLocation -home').sort({ date: 1 }),
    CareChecklist.find({ bookingId: { $in: ids } }),
    Review.find({ booking: { $in: ids } }),
    Message.aggregate([{ $match: { booking: { $in: ids } } }, { $group: { _id: '$booking', n: { $sum: 1 } } }])
  ])
  // no paths here: the report loads a walk's map only when it's opened (GET /api/walks/:id)
  const walks = await Walk.find({ visit: { $in: visits.map((v) => v._id) }, startedAt: { $ne: null } })
    .select('visit task mode routeName status startedAt endedAt endedEarlyReason distanceM durationS deviations')
    .sort({ startedAt: 1 })

  const group = (list, key) => {
    const map = new Map()
    for (const x of list) {
      const k = String(key(x))
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(x)
    }
    return map
  }
  const visitsByBooking = group(visits, (v) => v.booking)
  const walksByVisit = group(walks, (w) => w.visit)
  const itemsByBooking = new Map(checklists.map((c) => [String(c.bookingId), c.items]))
  const reviewByBooking = new Map(reviews.map((r) => [String(r.booking), r]))
  const countByBooking = new Map(counts.map((c) => [String(c._id), c.n]))

  return bookings.map((b) => {
    const id = String(b._id)
    const booked = bookedDays(b)
    const items = itemsByBooking.get(id) ?? []
    const days = (visitsByBooking.get(id) ?? []).map((visit) => {
      const index = booked.findIndex((d) => d.date === visit.date)
      const hours = booked[index] ?? { startTime: b.startTime, endTime: b.endTime }
      return {
        dayNumber: index + 1,
        date: visit.date,
        startTime: hours.startTime,
        endTime: hours.endTime,
        visit,
        // the tasks due that day, without their care details
        items: items
          .filter((item) => taskIsOn(item, visit.date))
          .map((item) => ({ _id: item._id, category: item.category, title: item.title, dailyFrequency: item.dailyFrequency, petIds: item.petIds })),
        walks: walksByVisit.get(String(visit._id)) ?? []
      }
    })
    const endedAt = bookingRange(b).end
    return {
      booking: {
        _id: b._id,
        status: b.status,
        startDate: toSgtDateString(b.startDate),
        endDate: toSgtDateString(b.endDate),
        startTime: b.startTime,
        endTime: b.endTime,
        sitter: b.sitterId,
        owner: b.ownerId,
        pets: b.petIds
      },
      endedAt,
      reviewOpenUntil: reviewOpenUntil(b),
      totalDays: booked.length,
      days,
      review: reviewByBooking.get(id) ?? null,
      messageCount: countByBooking.get(id) ?? 0
    }
  })
}
