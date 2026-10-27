import mongoose from 'mongoose'
import Walk from '../models/walkModel.js'
import WalkRoute from '../models/walkRouteModel.js'
import User from '../models/UserModel.js'
import { notify } from '../utils/notify.js'
import { HOME_RADIUS_M, isValidPath, isValidPoint, metresBetween, pathLength } from '../utils/walkGeo.js'

// The sitter's name for notification messages
const sitterName = (req) => req.session.username || 'Your sitter'

// Finds the walk and checks the logged-in sitter is the one walking it.
// Sends a 404 and returns null if not (a walk that isn't yours looks the same as one that doesn't exist).
async function loadSittersWalk(req, res) {
  const walk = await Walk.findById(req.params.id)
  if (!walk || String(walk.sitter) !== String(req.session.userId)) {
    res.status(404).json({ message: 'Walk not found.' })
    return null
  }
  return walk
}

// The deviation that's still going on (no endedAt yet), or undefined
const currentDeviation = (walk) => walk.deviations.find((d) => !d.endedAt)

// Marks the walk as ended and saves the walked path, distance and duration
function closeWalk(walk, path, status) {
  const now = new Date()
  walk.status = status
  walk.endedAt = now
  walk.durationS = Math.round((now - walk.startedAt) / 1000)
  if (path.length >= 2) {
    walk.walkedPath = { type: 'LineString', coordinates: path }
    walk.distanceM = pathLength(path)
  }
  // a deviation still going on when the walk ends is closed at the same time
  const current = currentDeviation(walk)
  if (current) current.endedAt = now
}

// POST /api/walks   body: { routeId, bookingId?, visitId?, taskId? }
// Creates a 'ready' walk holding a copy of the route and the owner's home.
// TEMP until booking integration: any logged-in sitter can create a walk on any route.
// Later: only the booking's sitter, once the booking is confirmed, on the route attached to that booking.
export async function createWalk(req, res) {
  const { routeId, bookingId = null, visitId = null, taskId = null } = req.body
  if (!mongoose.isValidObjectId(routeId)) return res.status(400).json({ message: 'Choose a route.' })

  const route = await WalkRoute.findById(routeId)
  if (!route) return res.status(404).json({ message: 'Route not found.' })

  const owner = await User.findById(route.owner).select('+ownerProfile.address')
  const homeCoords = owner?.ownerProfile?.address?.location?.coordinates
  if (!homeCoords) return res.status(400).json({ message: "The owner hasn't set their home address." })

  const walk = await Walk.create({
    owner: route.owner,
    sitter: req.session.userId,
    booking: bookingId,
    visit: visitId,
    task: taskId,
    route: route._id,
    routeName: route.name,
    plannedPath: route.path,
    home: { type: 'Point', coordinates: homeCoords }
  })
  res.status(201).json(walk)
}

// GET /api/walks/:id -> one walk, for its sitter or its owner
export async function getWalk(req, res) {
  const walk = await Walk.findById(req.params.id)
  const me = String(req.session.userId)
  if (!walk || (me !== String(walk.sitter) && me !== String(walk.owner))) {
    return res.status(404).json({ message: 'Walk not found.' })
  }
  res.json(walk)
}

// POST /api/walks/:id/start   body: { location: [lng, lat] }
export async function startWalk(req, res) {
  const walk = await loadSittersWalk(req, res)
  if (!walk) return
  if (walk.status !== 'ready') return res.status(400).json({ message: 'This walk has already been started.' })

  const { location } = req.body
  if (!isValidPoint(location)) return res.status(400).json({ message: 'Your location is missing.' })
  if (metresBetween(location, walk.home.coordinates) > HOME_RADIUS_M) {
    return res.status(400).json({ message: "Start the walk at the owner's home." })
  }

  walk.status = 'in-progress'
  walk.startedAt = new Date()
  await walk.save()
  res.json(walk)
}

// POST /api/walks/:id/deviations   body: { level: 'warning' | 'notify', location: [lng, lat], distanceM }
// 'warning': the sitter has gone past the first threshold, which starts a deviation
// 'notify':  they've gone past the second threshold, so the owner is told (once per deviation)
export async function reportDeviation(req, res) {
  const walk = await loadSittersWalk(req, res)
  if (!walk) return
  if (walk.status !== 'in-progress') return res.status(400).json({ message: 'This walk is not in progress.' })

  const { level, location, distanceM } = req.body
  if (!['warning', 'notify'].includes(level)) return res.status(400).json({ message: 'Unknown deviation level.' })
  if (!isValidPoint(location) || !Number.isFinite(distanceM)) {
    return res.status(400).json({ message: 'The location or distance is missing.' })
  }

  // carry on the current deviation, or start a new one
  let current = currentDeviation(walk)
  if (!current) {
    walk.deviations.push({ startedAt: new Date(), startLocation: location, maxDistanceM: distanceM })
    current = walk.deviations.at(-1)
  }
  current.maxDistanceM = Math.max(current.maxDistanceM, distanceM)

  const notifyOwner = level === 'notify' && !current.ownerNotifiedAt
  if (notifyOwner) current.ownerNotifiedAt = new Date()

  await walk.save()

  if (notifyOwner) {
    await notify(walk.owner, 'walk-off-route',
      `${sitterName(req)} is about ${Math.round(distanceM)} m off the route "${walk.routeName}".`, walk._id)
  }
  res.json(walk)
}

// POST /api/walks/:id/back-on-route   body: { location: [lng, lat] }
// Ends the current deviation. If the owner was told about it, they're told the sitter is back.
export async function reportBackOnRoute(req, res) {
  const walk = await loadSittersWalk(req, res)
  if (!walk) return
  if (walk.status !== 'in-progress') return res.status(400).json({ message: 'This walk is not in progress.' })

  const current = currentDeviation(walk)
  if (!current) return res.json(walk) // nothing to end

  current.endedAt = new Date()
  if (isValidPoint(req.body.location)) current.endLocation = req.body.location
  await walk.save()

  if (current.ownerNotifiedAt) {
    await notify(walk.owner, 'walk-back-on-route',
      `${sitterName(req)} is back on the route "${walk.routeName}".`, walk._id)
  }
  res.json(walk)
}

// POST /api/walks/:id/finish   body: { path: [[lng, lat], ...] }
// Ends the walk normally. The path must end at the owner's home.
export async function finishWalk(req, res) {
  const walk = await loadSittersWalk(req, res)
  if (!walk) return
  if (walk.status !== 'in-progress') return res.status(400).json({ message: 'This walk is not in progress.' })

  const { path } = req.body
  if (!isValidPath(path)) return res.status(400).json({ message: 'The walked path is missing or invalid.' })
  if (metresBetween(path.at(-1), walk.home.coordinates) > HOME_RADIUS_M) {
    return res.status(400).json({ message: "Finish the walk at the owner's home, or end it early." })
  }

  closeWalk(walk, path, 'completed')
  await walk.save()
  res.json(walk)
}

// POST /api/walks/:id/end-early   body: { path: [[lng, lat], ...], reason }
// Ends the walk anywhere (e.g. an emergency). The owner is told why.
export async function endWalkEarly(req, res) {
  const walk = await loadSittersWalk(req, res)
  if (!walk) return
  if (walk.status !== 'in-progress') return res.status(400).json({ message: 'This walk is not in progress.' })

  const reason = String(req.body.reason ?? '').trim()
  if (!reason) return res.status(400).json({ message: 'Tell the owner why the walk ended early.' })
  if (reason.length > 200) return res.status(400).json({ message: 'Keep the reason under 200 characters.' })

  // the path can be empty if they stopped straight after starting
  const path = req.body.path ?? []
  if (!isValidPath(path, 0)) return res.status(400).json({ message: 'The walked path is invalid.' })

  closeWalk(walk, path, 'ended-early')
  walk.endedEarlyReason = reason
  await walk.save()

  await notify(walk.owner, 'walk-ended-early',
    `${sitterName(req)} ended the walk on "${walk.routeName}" early: ${reason}`, walk._id)
  res.json(walk)
}
