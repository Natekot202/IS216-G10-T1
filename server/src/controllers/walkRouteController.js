import { distance, length, lineString } from '@turf/turf'
import WalkRoute from '../models/walkRouteModel.js'
import User from '../models/UserModel.js'

const HOME_RADIUS_M = 75     // how close to home a route must start and end
const MAX_POINTS = 2000      // stops someone sending a huge path

// The logged-in owner's home as [lng, lat], or null if they haven't set a postal code
async function getHome(userId) {
  const user = await User.findById(userId).select('+ownerProfile.address')
  return user?.ownerProfile?.address?.location?.coordinates ?? null
}

// Checks a recorded path. Returns an error message, or null if it's fine.
function checkPath(coords, home) {
  if (!Array.isArray(coords) || coords.length < 2) return 'A route needs at least 2 points.'
  if (coords.length > MAX_POINTS) return 'This route has too many points.'

  const allValid = coords.every((c) => Array.isArray(c) && c.length === 2 && c.every(Number.isFinite))
  if (!allValid) return 'The route contains invalid points.'

  if (!home) return 'Add your postal code in Edit Profile before recording a route.'
  const nearHome = (c) => distance(c, home, { units: 'meters' }) <= HOME_RADIUS_M
  if (!nearHome(coords[0])) return 'A route must start at your home.'
  if (!nearHome(coords.at(-1))) return 'A route must end at your home.'

  return null
}

// Total length of a path in metres, rounded
const pathLength = (coords) => Math.round(length(lineString(coords), { units: 'meters' }))

// GET /api/walk-routes -> all of the logged-in owner's routes, newest first
export async function getMyWalkRoutes(req, res) {
  const routes = await WalkRoute.find({ owner: req.session.userId }).sort({ createdAt: -1 })
  res.json(routes)
}

// GET /api/walk-routes/:id -> one route, only if it belongs to this owner
export async function getWalkRouteById(req, res) {
  const route = await WalkRoute.findOne({ _id: req.params.id, owner: req.session.userId })
  if (!route) return res.status(404).json({ message: 'Route not found' })
  res.json(route)
}

// POST /api/walk-routes   body: { name, path: [[lng, lat], ...] }
export async function createWalkRoute(req, res) {
  const name = String(req.body.name ?? '').trim()
  const coords = req.body.path
  if (!name) return res.status(400).json({ message: 'Give your route a name.' })

  const problem = checkPath(coords, await getHome(req.session.userId))
  if (problem) return res.status(400).json({ message: problem })

  const route = await WalkRoute.create({
    owner: req.session.userId,
    name,
    path: { type: 'LineString', coordinates: coords },
    distanceM: pathLength(coords)
  })
  res.status(201).json(route)
}

// PATCH /api/walk-routes/:id   body: { name } to rename, and/or { path } to re-record
export async function updateWalkRoute(req, res) {
  const route = await WalkRoute.findOne({ _id: req.params.id, owner: req.session.userId })
  if (!route) return res.status(404).json({ message: 'Route not found' })

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) return res.status(400).json({ message: 'Give your route a name.' })
    route.name = name
  }

  if (req.body.path !== undefined) {
    const problem = checkPath(req.body.path, await getHome(req.session.userId))
    if (problem) return res.status(400).json({ message: problem })
    route.path = { type: 'LineString', coordinates: req.body.path }
    route.distanceM = pathLength(req.body.path)
  }

  await route.save()
  res.json(route)
}

// DELETE /api/walk-routes/:id
export async function deleteWalkRoute(req, res) {
  const route = await WalkRoute.findOneAndDelete({ _id: req.params.id, owner: req.session.userId })
  if (!route) return res.status(404).json({ message: 'Route not found' })
  res.json({ message: 'Route deleted' })
}
