// Small helper functions shared by MyBookings.vue, GroupBookings.vue and the cards.
// ASSUMPTION: GET /api/bookings returns sitterId and petIds already populated
// (objects with a .name). If not, the fallbacks below show "Sitter" / "Pet".

// Statuses that mean the owner has picked this sitter.
export const CHOSEN_STATUSES = ['paid', 'in-progress', 'completed']

export function sitterName(booking) {
  return booking.sitterId?.username || booking.sitterId?.name || booking.sitter?.name || 'Sitter'
}

export function petNames(booking) {
  const names = (booking.petIds || []).map((p) => p?.name).filter(Boolean)
  return names.length ? names.join(', ') : 'Pet'
}

export function formatDateRange(start, end) {
  const opts = { day: 'numeric', month: 'short' }
  const s = new Date(start).toLocaleDateString('en-SG', opts)
  const e = new Date(end).toLocaleDateString('en-SG', { ...opts, year: 'numeric' })
  return s === new Date(end).toLocaleDateString('en-SG', opts) ? e : `${s} – ${e}`
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

// The booking the owner has paid for (or later), if any.
export function chosenBooking(bookings) {
  return bookings.find((b) => CHOSEN_STATUSES.includes(b.status))
}
