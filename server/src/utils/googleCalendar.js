import { google } from 'googleapis'
import Booking from '../models/bookingModel.js'
import Pet from '../models/petModel.js'
import User from '../models/UserModel.js'
import GoogleCalendarLink from '../models/GoogleCalendarLink.js'
import CalendarEvent from '../models/CalendarEvent.js'
import { sgtMidnight, toSgtDateString } from '../models/Availability.js'
import { bookingRange } from './bookingTimes.js'

// All the Google Calendar code lives here, so routes and controllers only call these functions.

// We only ask Google for permission to create events (not to read the sitter's whole calendar).
const SCOPES = ['https://www.googleapis.com/auth/calendar.events']
const DAY_MS = 24 * 60 * 60 * 1000
const SYNCED_STATUSES = ['accepted', 'paid', 'in-progress']

// The Google keys come from server/.env
export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

// The Google permission-screen address the sitter is sent to.
// access_type 'offline' + prompt 'consent' make Google return a refresh token we can keep.
export function getAuthUrl(state) {
  return createOAuthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state })
}

// Called after the sitter approves: swap Google's one-time code for tokens and save the refresh token.
export async function connectSitter(sitterId, code) {
  const { tokens } = await createOAuthClient().getToken(code)
  if (!tokens.refresh_token) throw new Error('Google did not return a refresh token')
  await GoogleCalendarLink.findOneAndUpdate(
    { sitterId },
    { refreshToken: tokens.refresh_token, needsReconnect: false },
    { upsert: true }
  )
}

// Best effort: tell Google to forget the permission.
export async function revokeToken(refreshToken) {
  try {
    await createOAuthClient().revokeToken(refreshToken)
  } catch (err) {
    console.error('Could not revoke Google token:', err.message)
  }
}

// What the Google Calendar event looks like for one booking.
// A moment (milliseconds) -> Singapore wall-clock text Google understands, e.g. '2026-10-21T09:00:00+08:00'
function sgtDateTime(ms) {
  return new Date(ms + 8 * 60 * 60 * 1000).toISOString().slice(0, 19) + '+08:00'
}

function buildEvent(booking, ownerName, petNames) {
  const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

  const lines = [`Owner: ${ownerName}`, `Pets: ${petNames.join(', ')}`]
  if (booking.notes) lines.push(`Notes: ${booking.notes}`)
  lines.push(`Booking requests: ${clientOrigin}/sitter/requests`)

  let start, end
  if (booking.startTime && booking.endTime) {
    // A booking with times becomes a timed event.
    const range = bookingRange(booking)
    start = { dateTime: sgtDateTime(range.start), timeZone: 'Asia/Singapore' }
    end = { dateTime: sgtDateTime(range.end), timeZone: 'Asia/Singapore' }
  } else {
    // An old booking without times stays an all-day event.
    // Google's all-day events end on the day AFTER the last day, so add one day.
    start = { date: toSgtDateString(booking.startDate) }
    end = { date: toSgtDateString(new Date(booking.endDate.getTime() + DAY_MS)) }
  }

  return {
    // Our own id, built from the booking id: if we ever try to add the same booking twice,
    // Google answers "already exists" instead of making a duplicate.
    id: `ps${booking._id}`,
    summary: `Pet sitting: ${petNames.join(', ')}`,
    description: lines.join('\n'),
    start,
    end
  }
}

// Adds one booking to its sitter's Google Calendar.
// It NEVER throws: it returns { synced, reason } so a Google problem can't break accepting a request.
export async function syncBookingToGoogle(booking) {
  try {
    if (!isConfigured()) return { synced: false, reason: 'not-configured' }

    const link = await GoogleCalendarLink.findOne({ sitterId: booking.sitterId })
    if (!link) return { synced: false, reason: 'not-connected' }
    if (link.needsReconnect) return { synced: false, reason: 'needs-reconnect' }

    if (await CalendarEvent.exists({ bookingId: booking._id, status: 'synced' })) {
      return { synced: true, reason: 'already-synced' }
    }

    const owner = await User.findById(booking.ownerId).select('username')
    const pets = await Pet.find({ _id: { $in: booking.petIds } }).select('name')
    const event = buildEvent(booking, owner?.username || 'Pet owner', pets.map((p) => p.name))

    const auth = createOAuthClient()
    auth.setCredentials({ refresh_token: link.refreshToken }) // the library fetches fresh access tokens by itself
    const calendar = google.calendar({ version: 'v3', auth })
    try {
      await calendar.events.insert({ calendarId: 'primary', requestBody: event }, { timeout: 8000 })
    } catch (err) {
      if (err.code !== 409 && err.status !== 409) throw err // 409 = already in the calendar, which is fine
    }

    await CalendarEvent.findOneAndUpdate(
      { bookingId: booking._id },
      { sitterId: booking.sitterId, googleEventId: event.id, status: 'synced', lastError: '' },
      { upsert: true }
    )
    return { synced: true }
  } catch (err) {
    console.error('Google Calendar sync failed:', err.message)
    // "invalid_grant" means the sitter's permission has expired or been removed: they must reconnect.
    const needsReconnect = String(err.message).includes('invalid_grant')
    try {
      if (needsReconnect) await GoogleCalendarLink.updateOne({ sitterId: booking.sitterId }, { needsReconnect: true })
      await CalendarEvent.findOneAndUpdate(
        { bookingId: booking._id },
        { sitterId: booking.sitterId, status: 'failed', lastError: String(err.message).slice(0, 300) },
        { upsert: true }
      )
    } catch (saveErr) {
      console.error('Could not record the sync failure:', saveErr.message)
    }
    return { synced: false, reason: needsReconnect ? 'needs-reconnect' : 'error' }
  }
}

// Removes one booking's event from its sitter's Google Calendar (used when a booking is cancelled).
// Like syncBookingToGoogle it NEVER throws: it returns { removed, reason } so a Google problem can't block the cancel.
export async function removeBookingFromGoogle(booking) {
  try {
    const event = await CalendarEvent.findOne({ bookingId: booking._id, status: 'synced' })
    if (!event) return { removed: false, reason: 'not-synced' } // it was never added to Google, so there is nothing to remove

    const link = await GoogleCalendarLink.findOne({ sitterId: booking.sitterId })
    if (!link || link.needsReconnect) return { removed: false, reason: 'not-connected' }

    const auth = createOAuthClient()
    auth.setCredentials({ refresh_token: link.refreshToken })
    const calendar = google.calendar({ version: 'v3', auth })
    try {
      await calendar.events.delete({ calendarId: 'primary', eventId: event.googleEventId }, { timeout: 8000 })
    } catch (err) {
      if (err.code !== 404 && err.status !== 404 && err.code !== 410 && err.status !== 410) throw err // 404 / 410 = already gone, which is fine
    }

    await CalendarEvent.deleteOne({ _id: event._id })
    return { removed: true }
  } catch (err) {
    console.error('Google Calendar remove failed:', err.message)
    return { removed: false, reason: String(err.message).includes('invalid_grant') ? 'needs-reconnect' : 'error' }
  }
}

// This sitter's accepted / paid / in-progress bookings that haven't ended yet.
async function upcomingBookings(sitterId) {
  const today = sgtMidnight(toSgtDateString(new Date()))
  return Booking.find({ sitterId, status: { $in: SYNCED_STATUSES }, endDate: { $gte: today } })
}

// Of those, the ones not in Google Calendar yet.
async function unsyncedBookings(sitterId) {
  const bookings = await upcomingBookings(sitterId)
  const done = await CalendarEvent.find({ bookingId: { $in: bookings.map((b) => b._id) }, status: 'synced' }).select('bookingId')
  const doneIds = new Set(done.map((d) => String(d.bookingId)))
  return bookings.filter((b) => !doneIds.has(String(b._id)))
}

export async function countUnsynced(sitterId) {
  return (await unsyncedBookings(sitterId)).length
}

// Adds every upcoming booking that isn't in Google Calendar yet.
// Runs when a sitter connects (for bookings accepted earlier) and on "Retry sync".
export async function syncUpcomingForSitter(sitterId) {
  let synced = 0
  let failed = 0
  for (const booking of await unsyncedBookings(sitterId)) {
    const result = await syncBookingToGoogle(booking)
    if (result.synced) synced++
    else failed++
  }
  return { synced, failed }
}
