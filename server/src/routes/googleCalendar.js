import { Router } from 'express'
import crypto from 'node:crypto'
import GoogleCalendarLink from '../models/GoogleCalendarLink.js'
import { requireSitter } from '../middleware/authMiddleware.js'
import asyncHandler from '../middleware/asyncHandler.js'
import * as gcal from '../utils/googleCalendar.js'

const router = Router()
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

// GET /api/google/status
// Out: { configured, connected, needsReconnect, unsynced }
//   unsynced = upcoming accepted bookings that are not in the sitter's Google Calendar yet
router.get('/status', requireSitter, asyncHandler(async (req, res) => {
  const link = await GoogleCalendarLink.findOne({ sitterId: req.session.userId })
  res.json({
    configured: gcal.isConfigured(),
    connected: Boolean(link),
    needsReconnect: Boolean(link?.needsReconnect),
    unsynced: link ? await gcal.countUnsynced(req.session.userId) : 0
  })
}))

// GET /api/google/connect
// Step 1 of connecting: the browser is sent to Google's permission screen.
// `state` is a random code we also keep in the session, to check that the person coming back is the same one who left.
router.get('/connect', requireSitter, (req, res) => {
  if (!gcal.isConfigured()) return res.status(500).json({ message: 'Google Calendar is not set up on the server.' })
  const state = crypto.randomBytes(16).toString('hex')
  req.session.googleState = state
  req.session.save(() => res.redirect(gcal.getAuthUrl(state)))
})

// GET /api/google/callback
// Step 2: Google sends the sitter back here with a one-time code (this address is registered in the Google console).
// We save their permission, add their upcoming accepted bookings, then return them to the calendar page.
router.get('/callback', requireSitter, asyncHandler(async (req, res) => {
  const back = (result) => res.redirect(`${CLIENT_ORIGIN}/sitter/calendar?google=${result}`)

  if (req.query.error) return back('denied') // they clicked Cancel on Google's screen
  const expected = req.session.googleState
  delete req.session.googleState
  if (!expected || req.query.state !== expected) return back('error')

  try {
    await gcal.connectSitter(req.session.userId, req.query.code)
    await gcal.syncUpcomingForSitter(req.session.userId)
  } catch (err) {
    console.error('Google connect failed:', err.message)
    return back('error')
  }
  back('connected')
}))

// DELETE /api/google/disconnect
// Forgets the sitter's Google permission. Events already in their calendar are left alone.
router.delete('/disconnect', requireSitter, asyncHandler(async (req, res) => {
  const link = await GoogleCalendarLink.findOneAndDelete({ sitterId: req.session.userId })
  if (link) await gcal.revokeToken(link.refreshToken)
  res.json({ message: 'Disconnected from Google Calendar.' })
}))

// POST /api/google/sync-now
// Retry: adds any upcoming accepted booking that isn't in Google Calendar yet.
// Out: { synced, failed }
router.post('/sync-now', requireSitter, asyncHandler(async (req, res) => {
  const link = await GoogleCalendarLink.findOne({ sitterId: req.session.userId })
  if (!link) return res.status(400).json({ message: 'Connect Google Calendar first.' })
  res.json(await gcal.syncUpcomingForSitter(req.session.userId))
}))

export default router
