import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import MongoStore from 'connect-mongo'
import connectDB from './src/config/db.js'
import session from 'express-session'
import petRoutes from './src/routes/petRoutes.js'
import authRoutes from './src/routes/authRoute.js'
import sitterRoute from './src/routes/sitterRoute.js'
import errorHandler from './src/middleware/errorHandler.js'
import bookingRoutes from './src/routes/bookingRoute.js'
import userRoutes from './src/routes/userRoutes.js'
import availabilityRoutes from './src/routes/availability.js'
import bookingCreateRoutes from './src/routes/bookingCreate.js'
import googleCalendarRoutes from './src/routes/googleCalendar.js'
import visitRoutes from './src/routes/visitRoutes.js'
import reviewRoutes from './src/routes/reviewRoutes.js'
import walkRouteRoutes from './src/routes/walkRoutes.js'
import paymentRoutes from './src/routes/paymentRoute.js'
import walksRoutes from './src/routes/walks.js'
import notificationRoutes from './src/routes/notifications.js'
import bookingMessageRoutes from './src/routes/bookingMessages.js'
import cronRoutes from './src/routes/cron.js'
import { expireStaleBookings } from './src/utils/expireBookings.js'
import { endForgottenSessions } from './src/utils/endForgottenSessions.js'

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is missing (set it in server/.env or the Vercel project env vars)')
}

// One cached connection promise: reused across requests and across warm serverless invocations
let dbPromise = null
export function ensureDB() {
  if (!dbPromise) {
    dbPromise = connectDB().catch((err) => {
      dbPromise = null // let the next request retry
      throw err
    })
  }
  return dbPromise
}

const app = express()
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

// Vercel sits behind a proxy; needed so secure cookies are set over its HTTPS
app.set('trust proxy', 1)

app.use(cors({
  origin: CLIENT_ORIGIN ,
  credentials: true
}))
app.use(express.json())

// Health check answers without touching the database
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})


// Connect to MongoDB lazily (once per process/serverless instance) before any route runs
app.use(async (req, res, next) => {
  try {
    await ensureDB()
    next()
  } catch (err) {
    next(err)
  }
})

// On Vercel there are no setInterval timers, so run the 5-minute checks on incoming requests instead
// (at most once every 5 minutes per instance). Locally, server.js runs the timers and this is skipped.
let lastSweep = 0
app.use(async (req, res, next) => {
  if (process.env.VERCEL && Date.now() - lastSweep > 5 * 60 * 1000) {
    lastSweep = Date.now()
    await expireStaleBookings() // both never throw; they log their own errors
    await endForgottenSessions()
  }
  next()
})

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: !!process.env.VERCEL, // HTTPS-only cookie on Vercel, plain HTTP locally
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}))

app.use("/api/auth", authRoutes);
app.use('/api/pets', petRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sitters', sitterRoute);
app.use('/api/users', userRoutes)  
app.use('/api/availability', availabilityRoutes)
app.use('/api/bookings', bookingCreateRoutes)
app.use('/api/bookings', bookingMessageRoutes)
app.use('/api/visits', visitRoutes)   
app.use('/api/reviews', reviewRoutes)
app.use('/api/google', googleCalendarRoutes)
app.use('/api/walk-routes', walkRouteRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/walks', walksRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/cron', cronRoutes)

// Fallback 404 for unmatched API routes
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Not found' })
})

app.use(errorHandler)

export default app
