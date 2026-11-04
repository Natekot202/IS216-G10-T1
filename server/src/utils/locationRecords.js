import { HOME_RADIUS_M, metresBetween } from './walkGeo.js'

// What the care report says about the sitter's location during a session (never a full trail):
//   awayEpisodes: more than 75 m from the home, not on a walk, for 3 location updates in a row
//   locationGaps: location blocked, or no update for more than a minute (e.g. the app was closed)
// Each function takes the visit as it is now and returns the fields to $set on it.

const AWAY_IN_A_ROW = 3          // an episode opens on the 3rd away update in a row (about 45 s)
const STOPPED_AFTER_MS = 60 * 1000 // no update for this long counts as a gap (the same as "Location paused")
const MAX_RECORDS = 50           // a cap per session, so a faulty phone can't grow these forever

const openOne = (list) => list.find((x) => !x.endedAt)
const plain = (list) => (list ?? []).map((x) => (x.toObject ? x.toObject() : { ...x }))

// A location reading: { location: [lng, lat], accuracy }. `walking`: a walk is under way.
export function recordReading(visit, reading, walking, now = new Date()) {
  const away = plain(visit.awayEpisodes)
  const gaps = plain(visit.locationGaps)
  const home = visit.home
  // like the start check, a reading only counts as away if it's away even allowing for its accuracy
  const distanceM = home ? metresBetween(reading.location, home) : null
  const isAway = distanceM != null && distanceM - reading.accuracy > HOME_RADIUS_M

  // Location gaps: close an open one, or notice that updates had stopped since the last reading
  const openGap = openOne(gaps)
  const last = visit.lastLocation?.at ? new Date(visit.lastLocation.at) : null
  if (openGap) {
    openGap.endedAt = now
    openGap.resumedAtHome = distanceM != null && !isAway
  } else if (last && now - last > STOPPED_AFTER_MS && gaps.length < MAX_RECORDS) {
    gaps.push({ startedAt: new Date(last.getTime() + STOPPED_AFTER_MS), endedAt: now, reason: 'stopped', resumedAtHome: distanceM != null && !isAway })
  }

  // Away from home, not on a walk
  let streak = visit.awayStreak ?? null
  const openAway = openOne(away)
  if (walking || !isAway) {
    if (openAway) openAway.endedAt = now
    streak = null
  } else {
    streak = streak
      ? { ...streak, count: streak.count + 1, maxDistanceM: Math.max(streak.maxDistanceM, distanceM) }
      : { count: 1, startedAt: now, maxDistanceM: distanceM }
    if (openAway) openAway.maxDistanceM = Math.round(Math.max(openAway.maxDistanceM, distanceM))
    else if (streak.count >= AWAY_IN_A_ROW && away.length < MAX_RECORDS) {
      away.push({ startedAt: streak.startedAt, maxDistanceM: Math.round(streak.maxDistanceM) })
    }
  }
  return { awayEpisodes: away, locationGaps: gaps, awayStreak: streak }
}

// The browser says location is switched off: a 'blocked' gap starts (if one isn't open already)
export function recordBlocked(visit, now = new Date()) {
  const gaps = plain(visit.locationGaps)
  if (!openOne(gaps) && gaps.length < MAX_RECORDS) gaps.push({ startedAt: now, reason: 'blocked' })
  return { locationGaps: gaps }
}

// The session is ending (by the sitter or automatically): close whatever is still open.
// If updates had already stopped, that gap is recorded up to the end.
export function closeRecords(visit, at = new Date()) {
  const away = plain(visit.awayEpisodes)
  const gaps = plain(visit.locationGaps)
  const openAway = openOne(away)
  if (openAway) openAway.endedAt = at
  const openGap = openOne(gaps)
  const last = visit.lastLocation?.at ? new Date(visit.lastLocation.at) : null
  if (openGap) openGap.endedAt = at
  else if (last && at - last > STOPPED_AFTER_MS && gaps.length < MAX_RECORDS) {
    gaps.push({ startedAt: new Date(last.getTime() + STOPPED_AFTER_MS), endedAt: at, reason: 'stopped' })
  }
  return { awayEpisodes: away, locationGaps: gaps, awayStreak: null }
}
