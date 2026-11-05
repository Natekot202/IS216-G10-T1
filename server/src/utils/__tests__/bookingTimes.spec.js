// Unit tests (Vitest) for the time rules in utils/bookingTimes.js:
// when a day's session was booked to end, when location sharing stops (30 minutes later),
// which days a multi-day booking has, and when reviews close (30 days after the last booked time).
// All bookings are in Singapore time (UTC+8). Run with: pnpm test   (in the server folder)
import { describe, it, expect } from 'vitest'
import { sessionEndTime, sharingEndTime, bookedDays, bookingRange, reviewOpenUntil, REVIEW_OPEN_MS } from '../bookingTimes.js'

const sgt = (date, time) => new Date(`${date}T${time}:00+08:00`).getTime()
const midnight = (date) => new Date(`${date}T00:00:00+08:00`)

// A 3-day booking with different hours each day (how every new booking is saved)
const threeDays = {
  startDate: midnight('2026-11-03'),
  endDate: midnight('2026-11-05'),
  startTime: '09:00',
  endTime: '24:00',
  dayTimes: [
    { date: '2026-11-03', startTime: '09:00', endTime: '12:00' },
    { date: '2026-11-04', startTime: '13:00', endTime: '18:00' },
    { date: '2026-11-05', startTime: '20:00', endTime: '24:00' }
  ]
}
// An older booking with no dayTimes: the same hours every day
const oldStyle = { startDate: midnight('2026-11-03'), endDate: midnight('2026-11-04'), startTime: '10:00', endTime: '14:00' }

describe('TestSuite: sessionEndTime', () => {
  it("Test1: uses that day's own end time", () => {
    expect(sessionEndTime({ date: '2026-11-03' }, threeDays)).toBe(sgt('2026-11-03', '12:00'))
    expect(sessionEndTime({ date: '2026-11-04' }, threeDays)).toBe(sgt('2026-11-04', '18:00'))
  })

  it('Test2: 24:00 is midnight at the end of that day', () => {
    expect(sessionEndTime({ date: '2026-11-05' }, threeDays)).toBe(sgt('2026-11-06', '00:00'))
  })

  it('Test3: an older booking uses the same end time every day', () => {
    expect(sessionEndTime({ date: '2026-11-04' }, oldStyle)).toBe(sgt('2026-11-04', '14:00'))
  })
})

describe('TestSuite: sharingEndTime (the 30-minute cutoff)', () => {
  it('Test1: location sharing stops 30 minutes after the booked end', () => {
    expect(sharingEndTime({ date: '2026-11-04' }, threeDays)).toBe(sgt('2026-11-04', '18:30'))
  })

  it('Test2: a session ending at 12 am shares until 12:30 am the next day', () => {
    expect(sharingEndTime({ date: '2026-11-05' }, threeDays)).toBe(sgt('2026-11-06', '00:30'))
  })
})

describe('TestSuite: bookedDays (multi-day bookings)', () => {
  it('Test1: lists every day with its own hours, oldest first', () => {
    expect(bookedDays(threeDays)).toEqual(threeDays.dayTimes)
  })

  it('Test2: an older booking gets one entry per day with the same hours', () => {
    expect(bookedDays(oldStyle)).toEqual([
      { date: '2026-11-03', startTime: '10:00', endTime: '14:00' },
      { date: '2026-11-04', startTime: '10:00', endTime: '14:00' }
    ])
  })

  it('Test3: the whole booking runs from the first start to the last end', () => {
    expect(bookingRange(threeDays)).toEqual({ start: sgt('2026-11-03', '09:00'), end: sgt('2026-11-06', '00:00') })
  })
})

describe('TestSuite: reviewOpenUntil', () => {
  it('Test1: reviews stay open for 30 days after the last booked time', () => {
    expect(REVIEW_OPEN_MS).toBe(30 * 24 * 60 * 60 * 1000)
    expect(reviewOpenUntil(oldStyle)).toBe(sgt('2026-12-04', '14:00'))
  })

  it("Test2: counts from the last day's end, not the first day's", () => {
    expect(reviewOpenUntil(threeDays)).toBe(sgt('2026-12-06', '00:00'))
  })
})
