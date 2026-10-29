// Small helper functions shared by the booking pages and tables.
// ASSUMPTION: GET /api/bookings returns sitterId and petIds already populated
// (objects with a .name). If not, the fallbacks below show "Sitter" / "Pet".

export function petNames(booking) {
  const names = (booking.petIds || []).map((p) => p?.name).filter(Boolean)
  return names.length ? names.join(', ') : 'Pet'
}

// '09:30' -> '9:30 am', '24:00' (end of the day) -> '12:00 am'
export function formatTime(time) {
  const [h, m] = time.split(':').map(Number)
  const minutes = (h * 60 + m) % (24 * 60)
  const h24 = Math.floor(minutes / 60)
  return `${h24 % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h24 >= 12 ? 'pm' : 'am'}`
}

// '21 Oct 2026' for one day, '21 Oct – 23 Oct 2026' for several.
// With times (bookings made from now on): '21 Oct 2026, 9:00 am – 12:00 pm' or '21 Oct, 9:00 am – 23 Oct 2026, 5:00 pm'.
export function formatDateRange(start, end, startTime, endTime) {
  const opts = { day: 'numeric', month: 'short' }
  const s = new Date(start).toLocaleDateString('en-SG', opts)
  const e = new Date(end).toLocaleDateString('en-SG', { ...opts, year: 'numeric' })
  const sameDay = s === new Date(end).toLocaleDateString('en-SG', opts)
  if (startTime && endTime) {
    if (sameDay) {
      return startTime === '00:00' && endTime === '24:00'
        ? `${e}, all day`
        : `${e}, ${formatTime(startTime)} – ${formatTime(endTime)}`
    }
    return `${s}, ${formatTime(startTime)} – ${e}, ${formatTime(endTime)}`
  }
  return sameDay ? e : `${s} – ${e}`
}

export function formatPrice(amount) {
  return amount == null ? '—' : `$${Number(amount).toFixed(2)}`
}

// Turns a flat list of bookings into a list of groups.
// Bookings that share a groupId go together; bookings without one stand alone.
export function groupBookings(bookings) {
  const groups = new Map()
  for (const b of bookings) {
    const key = b.groupId || b._id
    if (!groups.has(key)) {
      groups.set(key, { key, groupId: b.groupId || null, bookings: [] })
    }
    groups.get(key).bookings.push(b)
  }
  // newest trip first
  return [...groups.values()].sort(
    (a, b) => new Date(b.bookings[0].startDate) - new Date(a.bookings[0].startDate)
  )
}

// { pending: 2, accepted: 1 } for a list of bookings
export function statusCounts(bookings) {
  const counts = {}
  for (const b of bookings) counts[b.status] = (counts[b.status] || 0) + 1
  return counts
}

// The sitter who got the job for this trip, if any.
export function chosenBooking(bookings) {
  return bookings.find((b) => CHOSEN_STATUSES.includes(b.status))
}
