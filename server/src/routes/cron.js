import express from 'express'
import { expireStaleBookings } from '../utils/expireBookings.js'
import { endForgottenSessions } from '../utils/endForgottenSessions.js'
import { recalcAllRatings } from '../utils/ratingsCalc.js'

const router = express.Router()

// Called by Vercel Cron (see vercel.json). Serverless functions can't keep setInterval timers
// alive, so the periodic checks that server.js runs locally happen here instead.
router.get('/daily', async (req, res, next) => {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
  try {
    await expireStaleBookings()
    await endForgottenSessions()
    await recalcAllRatings()
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
