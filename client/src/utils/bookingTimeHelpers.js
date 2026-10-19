// Small helpers for booking dates and times, shared by the booking form and its calendar picker.
// All times are Singapore time. A "moment" is a time as a number (milliseconds since 1970),
// so two times can simply be compared with < and >.

export const DAY_MIN = 24 * 60 // number of minutes in a day
export const SLOT_MS = 30 * 60 * 1000 // one 30-minute slot, in milliseconds

// Turns a Date into 'YYYY-MM-DD' (what the server uses), in local time.
export function toDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// '2026-10-20' -> '20 Oct 2026'
export function prettyDate(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

// '09:30' -> 570 (minutes after midnight)
export function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

// 570 -> '09:30'
export function toHHMM(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// combines a date and time into one time in milliseconds from 1970
// i.e. the moment a date + minutes-after-midnight happens (the +08:00 means Singapore time)
export function momentOf(date, minutes) {
  return new Date(date + 'T00:00:00+08:00').getTime() + minutes * 60000
}

// is the sitter already booked at any point between these two moments?
// (`busy` is the sitter's booked times: [{ start, end }] as moments)
export function isBusy(busy, startMs, endMs) {
  return busy.some((b) => startMs < b.end && b.start < endMs)
}
//  startMs and endMs is the Ms of the proposed booking ; busy obj contains the current bookings 
// goes through each booking in busy : 
// checks wether the start of the proposed booking is before the end of a confirmed booking + 
// checks ether the end of the proposed booking is after the start of a confirmed booking 


// is this 30-minute slot in the future and not already booked?
export function slotFree(busy, date, minutes) {
  const start = momentOf(date, minutes) 
  return start > Date.now() && !isBusy(busy, start, start + SLOT_MS)  
}
// minutes is the minutes aft midnight that the specific 30min slot starts from 
// converts the start of the slot -> milliseconds from 1970 
//  checks that slot is after current date + check if busy from start to end of the slot 

// does the day have at least one free slot?
export function dayHasFreeSlot(busy, date) {
  for (let m = 0; m < DAY_MIN; m += 30) if (slotFree(busy, date, m)) return true
  return false
}
// loops through all slots within the whole day, checks if slotFree returns true for each slot 
