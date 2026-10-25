import { distance, length, lineString } from '@turf/turf'

// Shared rules and distance helpers for walk routes (owner) and walks (sitter).

// How close to the owner's home a route or walk must start and end.
// Must match HOME_RADIUS_M in client/src/utils/useHomeCheck.js
export const HOME_RADIUS_M = 75

// Stops someone sending a huge path (the client simplifies paths before sending)
export const MAX_POINTS = 2000

// A single [lng, lat] point
export const isValidPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)

// A list of [lng, lat] points with at least `minPoints` of them
export const isValidPath = (coords, minPoints = 2) =>
  Array.isArray(coords) &&
  coords.length >= minPoints &&
  coords.length <= MAX_POINTS &&
  coords.every(isValidPoint)

// Straight-line distance between two [lng, lat] points, in metres
export const metresBetween = (a, b) => distance(a, b, { units: 'meters' })

// Total length of a path in metres, rounded
export const pathLength = (coords) => Math.round(length(lineString(coords), { units: 'meters' }))
