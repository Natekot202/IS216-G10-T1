import Booking from '../models/bookingModel.js'
import Availability, { sgtMidnight, toSgtDateString } from '../models/Availability.js'

const DAY = 24 * 60 * 60 * 1000
const SGT_OFFSET = 8 * 60 * 60 * 1000

const T = {
  newMonths: 6,
  topRating: 4.5,
  topRatingMin: 3,
  demandCount: 5,
  demandDays: 90
}

export async function computeBadges(user) {
  const sp = user.sitterProfile || {}
  const badges = []

  const since = new Date(Date.now() - T.demandDays * DAY)
  const todayStr = toSgtDateString(new Date())
  const todayStart = sgtMidnight(todayStr)
  const weekEnd = new Date(todayStart.getTime() + 7 * DAY)

  const sgtNow = new Date(Date.now() + SGT_OFFSET)
  const nowMinutes = sgtNow.getUTCHours() * 60 + sgtNow.getUTCMinutes()

  const [recentCount, repeatOwners, openDays] = await Promise.all([
    Booking.countDocuments({ sitterId: user._id, status: 'completed', endDate: { $gte: since } }),
    Booking.aggregate([
      { $match: { sitterId: user._id, status: 'completed' } },
      { $group: { _id: '$ownerId', bookings: { $sum: 1 } } },
      { $match: { bookings: { $gte: 2 } } },
      { $count: 'owners' }
    ]),
    Availability.find({
      sitterId: user._id,
      status: 'available',
      date: { $gte: todayStart, $lt: weekEnd }
    }).select('date slots')
  ])

  if (sp.experienceStart) {
    const months = (Date.now() - new Date(sp.experienceStart).getTime()) / (30.44 * DAY)
    if (months < T.newMonths) {
      badges.push('new')
    }
  }

  if (sp.ratingCount >= T.topRatingMin && sp.ratingAvg >= T.topRating) {
    badges.push('top_rated')
  }

  if (recentCount >= T.demandCount) {
    badges.push('in_demand')
  }

  if ((repeatOwners[0]?.owners ?? 0) >= 1) {
    badges.push('repeat')
  }

  const hasOpenDay = openDays.some((d) => {
    if (toSgtDateString(d.date) !== todayStr) {
      return true                                 
    }
    return !d.slots || d.slots.some((m) => m > nowMinutes)   
  })
  if (hasOpenDay) {
    badges.push('available')
  }

  return badges
}