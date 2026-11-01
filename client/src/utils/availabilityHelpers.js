// Small helpers for the sitter's availability calendar, shared by the calendar component
// (AvailabilityCalendar.vue) and the pages that use it.
// A day's free time is a list of half-hour starts in minutes after midnight: 540 = 9:00, 570 = 9:30 ... 1410 = 23:30.
// Only 7am to 12am midnight can be free or booked, so the earliest half-hour is 420 (7:00).

import { DAY_MIN, DAY_START_MIN, toDateString, toMinutes } from './bookingTimeHelpers.js'

export const ALL_DAY = Array.from({ length: (DAY_MIN - DAY_START_MIN) / 30 }, (_, i) => DAY_START_MIN + i * 30) // [420, 450, 480 ... 1410] = 7am to 12am

// A date from the server like '2026-10-19T16:00:00.000Z' -> '2026-10-20' (the day it is in Singapore, which is 8 hours ahead)
export function isoToSgtDay(iso) {
  return new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// Short time for the squares: 540 -> '9am', 570 -> '9:30am', 720 -> '12pm', 1440 -> '12am'
export function shortTime(minutes) {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h24 % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h24 >= 12 ? 'pm' : 'am'}`
}

// Groups bookings by day: { '2026-11-21': [booking, ...] }. A booking that lasts several days is added to each of its days.
export function groupBookingsByDay(bookings) {
  const byDay = {}
  bookings.forEach((b) => {
    const d = new Date(b.startDate + 'T00:00:00')
    const end = new Date(b.endDate + 'T00:00:00')
    while (d <= end) {
      const key = toDateString(d)
      if (!byDay[key]) byDay[key] = [] // if the day isn't in byDay yet, start its list
      byDay[key].push(b) // a day can hold more than one booking
      d.setDate(d.getDate() + 1) // loop to the next day
    }
  })
  return byDay
}

// The part of this day (in minutes after midnight) that one booking takes up: [startMinutes, endMinutes]
// The first day uses the start time, the last day the end time; days in between are all day.
export function dayPart(b, date) {
  // The times are the hours for EACH day (e.g. 9am to 5pm on every day from 3 Nov to 5 Nov)
  if (sameHoursEachDay(b)) return [toMinutes(b.startTime), toMinutes(b.endTime)]
  // Old bookings that ran non-stop (overnight stays): the first day from the start time, the last day to the end time
  const startMinutes = date === b.startDate && b.startTime ? toMinutes(b.startTime) : 0
  const endMinutes = date === b.endDate && b.endTime ? toMinutes(b.endTime) : DAY_MIN
  return [startMinutes, endMinutes]
}

// True when a booking's times are the hours for each of its days (every booking made from now on).
// False for old bookings that ran non-stop: overnight stays, no times, or an end time before the start time.
export function sameHoursEachDay(b) {
  return Boolean(!b.overnight && b.startTime && b.endTime && toMinutes(b.endTime) > toMinutes(b.startTime))
}

// What one booking looks like inside one day's square, e.g. '9am–12pm · Buddy'.
export function chipText(b, date) {
  const [startMinutes, endMinutes] = dayPart(b, date)
  const when = startMinutes === 0 && endMinutes === DAY_MIN ? 'All day' : `${shortTime(startMinutes)}–${shortTime(endMinutes)}`
  return `${when} · ${b.petNames.join(', ')}`
}

// True when the bookings on this day add up to the whole day (so nothing is left to book)
export function isFullyBooked(dayBookings, date) {
  const parts = dayBookings.map((b) => dayPart(b, date)).sort((a, b) => a[0] - b[0])
  let coveredUpTo = DAY_START_MIN // everything before this minute is taken (nothing before 7am can be booked, so the day starts at 7am)
  for (const [startMinutes, endMinutes] of parts) {
    if (startMinutes > coveredUpTo) return false // a gap: free time
    coveredUpTo = Math.max(coveredUpTo, endMinutes)
  }
  return coveredUpTo >= DAY_MIN
}

// Short text for a day's free hours, written inside its square: [540, 570 ... 1050] -> '9am–6pm'.
// If the free time has gaps, only the first stretch is written, followed by ' +'.
export function freeHoursText(slots) {
  if (!slots || !slots.length) return ''
  const sorted = [...slots].sort((a, b) => a - b)
  let end = sorted[0] + 30 // where the first stretch of free half-hours ends
  let i = 1
  while (i < sorted.length && sorted[i] === end) {
    end += 30
    i++
  }
  return `${shortTime(sorted[0])}–${shortTime(end)}${i < sorted.length ? ' +' : ''}`
}

// Is this half-hour (starting at minute m) taken by one of these bookings?
export function slotBooked(dayBookings, date, m) {
  return dayBookings.some((b) => {
    const [startMinutes, endMinutes] = dayPart(b, date)
    return startMinutes < m + 30 && endMinutes > m
  })
}

// Can this half-hour be changed? Not if it is in the past or a booking is on it.
export function canChangeSlot(date, m, dayBookings, today, nowMinutes) {
  if (date < today) return false
  if (date === today && m + 30 <= nowMinutes) return false
  return !slotBooked(dayBookings, date, m) 
}

// The new list of free half-hours for a day after making `startMinutes` up to `endMinutes` free (on = true) or not free (on = false).
// startMins -> the slot that the person starts painting from, endMIn -> the slot the person stops painting 
export function paintedSlots(current, date, startMinutes, endMinutes, on, dayBookings, today, nowMinutes) {
  const slots = new Set(current || []) //start with the days current avail. slots 
  let touched = 0 
  for (let m = startMinutes; m < endMinutes; m += 30) { // loops thru range in 30min jumps till we reach the end
    if (!canChangeSlot(date, m, dayBookings, today, nowMinutes)) continue // skip if the slot is alr booked/unavail ,so cannot be painted 
    touched++ // counts the number of 30min slots we can change
    if (on) slots.add(m) // if on = true i.e avail, then add that slot to list ; else remove the slot from list 
    else slots.delete(m)
  }
  if (touched === 0) return null // nothing here can be changed (all in the past or booked)
  const list = [...slots].sort((a, b) => a - b)
  if (current && JSON.stringify(list) === JSON.stringify(current)) return null // already like this
  return list 
  // returns the newly calculated availability list,taking that days bookings int  e.g. [480, 510, 540, 570]
}

// The new list of free half-hours for a day after "Set as free": ONLY startMinutes up to endMinutes are free, every other
// half-hour becomes not free (e.g. 7am-12am set to 5pm-12am leaves just 5pm-12am).
// Half-hours already taken by a booking are left as they were. Earlier hours of today (already past) are cleared too, as they can't be booked any more.
export function replacedSlots(current, date, startMinutes, endMinutes, dayBookings, today, nowMinutes) {
  if (date < today) return null // a day in the past can't be changed
  const slots = new Set(current || [])
  let touched = 0
  for (const m of ALL_DAY) {
    if (slotBooked(dayBookings, date, m)) continue // booked: keep as it is
    touched++
    const past = date === today && m + 30 <= nowMinutes
    if (!past && m >= startMinutes && m < endMinutes) slots.add(m)
    else slots.delete(m)
  }
  if (touched === 0) return null // nothing here can be changed
  const list = [...slots].sort((a, b) => a - b)
  if (current && JSON.stringify(list) === JSON.stringify(current)) return null // already like this
  return list
}

// Does a booking request fit the sitter's calendar?
// Returns 'ok', 'not-free' (some hours aren't marked available) or 'clash' (overlaps a booking already accepted).
// `slotsByDate` is { '2026-10-20': [540, ...] }, `bookedByDay` comes from groupBookingsByDay.
export function requestFit(request, slotsByDate, bookedByDay) {
  const d = new Date(request.startDate + 'T00:00:00')
  const end = new Date(request.endDate + 'T00:00:00')
  while (d <= end) {
    const date = toDateString(d)
    const [startMinutes, endMinutes] = dayPart(request, date)
    const slots = slotsByDate[date] || []
    for (let m = startMinutes; m < endMinutes; m += 30) {
      if (slotBooked(bookedByDay[date] || [], date, m)) return 'clash'
      if (!slots.includes(m)) return 'not-free'
    }
    d.setDate(d.getDate() + 1)
  }
  return 'ok'
}
