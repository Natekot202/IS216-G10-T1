// Turns a booking's tasklist into short summary lines for a card,
// e.g. "Feeding ×16", "Walking ×4 (6 km)".
// Works with the sample data now and with the real GET /api/bookings/:id/tasklist later.
// It only uses the short-version fields (category, times, days, distanceKm), so it also
// works on the cut-down tasklist a sitter sees before the booking is paid.
import {sampleTasklists} from '../sampleData/taskLists.js'

const LABELS = {
  feed: 'Feeding',
  walk: 'Walking',
  groom: 'Grooming',
  medication: 'Medication',
  other: 'Other tasks',
}
const ORDER = ['feed', 'walk', 'groom', 'medication', 'other'];

// Inclusive, so 22 Oct to 25 Oct is 4 days.
function bookingDuration(start, end) {
  return Math.round((new Date(end) - new Date(start)) / 86400000) + 1
}

function bookingDays(start, end){
  const startDate = new Date(start);
  const endDate = new Date(end);

  const days = [];

    for (
    const current = new Date(startDate);
    current <= endDate;
    current.setUTCDate(current.getUTCDate() + 1)
  ) {
    days.push(new Date(current));
  }

  return days;
}

// Returns e.g. [{ category: 'feed', label: 'Feeding', visits: 16, extra: '' },
//               { category: 'walk', label: 'Walking', visits: 4, extra: '6 km' }]
// visits = how many times that kind of task happens across the whole booking.
/*
export function summariseTasks(tasklist, booking) {
  if (!tasklist || !tasklist.items || tasklist.items.length === 0) return []

  const totalDays = bookingDays(booking.startDate, booking.endDate)
  const totals = {}

  for (const task of tasklist.items) {
    // a task with specific days only happens on those days, otherwise every day
    const days = task.days && task.days.length ? task.days.length : totalDays
    const visits = task.times.length * days

    if (!totals[task.category]) totals[task.category] = { visits: 0, km: 0 }
    totals[task.category].visits += visits
    if (task.category === 'walk' && task.distanceKm) {
      totals[task.category].km += task.distanceKm * visits
    }
  }

  return ORDER.filter((c) => totals[c]).map((c) => ({
    category: c,
    label: LABELS[c],
    visits: totals[c].visits,
    extra: totals[c].km ? `${Math.round(totals[c].km * 10) / 10} km` : '',
  }))
}
*/
export function summariseTasks(tasklist, booking) {
  console.log('[summariseTasks] called')
  console.log('[summariseTasks] tasklist:', tasklist)
  console.log('[summariseTasks] booking:', booking)
  console.log('tasklist structure:', tasklist)
  if (!tasklist || tasklist.length == 0){
    console.log(`no task items found`)
    return []
  }

  let totalDays = bookingDuration(booking.startDate, booking.endDate)
  const summary = {}

  for(const task of tasklist){
    console.log('[summariseTasks] processing task:', task)
    const category = task.category
    
    if(!summary[category]){
      summary[category] = {
        category,
        dailyFrequency: 0,
        bookingFrequency: 0
      }
      console.log(`new category ${category} added`)
    }
    
    totalDays = task.days?.length 
      ? task.days.length
      : totalDays

    summary[category].dailyFrequency += task.dailyFrequency ?? 1
    summary[category].bookingFrequency += (task.dailyFrequency ?? 1) * totalDays

    // returns an array containing objects, one per category
    console.log(`[summariseTasks] result: ${Object.values(summary)}`,)
  }
  return Object.values(summary);
}


// Finds the tasklist for one booking, like GET /api/bookings/:id/tasklist would.
// Pass { sitterView: true } to get the short version a sitter sees before the booking is paid.
export function findTasklist(bookingId, { sitterView = false } = {}) {
  const found = sampleTasklists.find((t) => t.bookingId === bookingId)
  if (!found) return null
  if (!sitterView) return found
  return {
    ...found,
    items: found.items.map((item) => {
      const copy = { ...item }
      DETAIL_FIELDS.forEach((f) => delete copy[f])
      return copy
    }),
  }
}

// task.petIds holds ids like 'p1', the booking's petIds holds { _id, name }
export function petNamesFor(task, booking) {
  return (task.petIds || [])
    .map((id) => booking.petIds?.find((p) => p._id === id)?.name)
    .filter(Boolean)
    .join(', ')
}

export function scheduleText(task) {
  if (task.times?.length) return task.times.join(', ')
  if (task.dailyFrequency) return `${task.dailyFrequency}× a day, sitter chooses when`
  return 'Sitter chooses when'
}

export function daysText(task) {
  if (!task.days?.length) return 'Every day'
  return task.days
    .map((d) => new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }))
    .join(', ')
}