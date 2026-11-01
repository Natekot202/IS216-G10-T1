// The sitter's location during a session. This is one shared tracker for the whole app, not part of a page,
// so moving between pages doesn't stop it:
//   - the whole session: sends the latest location to the server, for the owner's live card
//   - only during a walk: records the path, saved on the phone as it grows, and checks for going off route
// Browsers pause all of this when the phone locks or the browser closes. Only a phone app could carry on.
import { computed, ref, watch } from 'vue'
import { distance, lineString, simplify } from '@turf/turf'
import { createGeoTracker } from './useGeoTracker.js'
import { HOME_RADIUS_M, useHomeCheck } from './useHomeCheck.js'
import { useDeviationCheck } from './useDeviationCheck.js'
import { visitsApi } from '../services/api.js'
import { walkApi } from '../services/walkApi.js'

const SEND_EVERY_MS = 15 * 1000       // how often the owner's card gets a new location
const MAX_SHARED_ACCURACY_M = 100     // vaguer readings aren't shared (same limit as starting a session)
const BACK_HOME_REMINDER_MS = 20 * 60 * 1000 // back at the home this long with the walk still going: notify the sitter
const AUTO_END_REASON = 'The booked time ended before the walk was finished.'

const geo = createGeoTracker()
export const { position, path, accuracy, error: gpsError, blocked } = geo

const visitId = ref(null)      // the session being tracked
const sharingEndsAt = ref(null) // when sharing stops: the booked end plus 30 minutes
const walkId = ref(null)       // the walk being recorded
const now = ref(Date.now())
let timer = null

// Bumped when the tracker ends a walk by itself, so the Session page can reload
export const walkEndedCount = ref(0)
export const sharingEnded = computed(() => sharingEndsAt.value !== null && now.value >= sharingEndsAt.value)
export const isSharing = computed(() => visitId.value !== null && !sharingEnded.value)
export const isWalking = computed(() => walkId.value !== null)

// ---- Home ----
export const home = ref(null) // [lng, lat]
export const { metresFromHome, nearHome, hasLeftHome, resetLeftHome } = useHomeCheck(position, home)

// Back at the home during a walk: when they arrived, and whether it's time to notify them
const backHomeSince = ref(null)
watch(nearHome, (near) => {
  backHomeSince.value = near && isWalking.value && hasLeftHome.value ? Date.now() : null
})
const reminderDue = computed(() =>
  backHomeSince.value !== null && now.value - backHomeSince.value >= BACK_HOME_REMINDER_MS
)
let reminderSent = false

// ---- Off-route checks ----
export const trackedWalk = ref(null)   // the walk as the server last sent it
export const syncError = ref('')       // a deviation report couldn't reach the server
export const backOnRouteMessage = ref('')
const plannedRoute = ref([])
let backOnRouteTimer = null

function vibrate(pattern) {
  navigator.vibrate?.(pattern)   // not supported on every phone (e.g. iPhones), so it's optional
}

function showBackOnRoute(message) {
  backOnRouteMessage.value = message
  clearTimeout(backOnRouteTimer)
  backOnRouteTimer = setTimeout(() => { backOnRouteMessage.value = '' }, 5000)
}

// Deviation reports must reach the server in the order they happened (warning before notify
// before back on route), so each request waits for the one before it to finish.
let lastRequest = Promise.resolve()
export function sendInOrder(request) {
  const previous = lastRequest
  lastRequest = (async () => {
    try { await previous } catch { /* an earlier failure shouldn't block this one */ }
    return await request()
  })()
  return lastRequest
}

// sends a deviation report; if it fails, tells the sitter but carries on with the walk
async function report(request) {
  try {
    trackedWalk.value = await sendInOrder(request)
    syncError.value = ''
  } catch {
    syncError.value = "Couldn't reach the server, so the owner may not have been alerted. Check your connection."
  }
}

export const deviation = useDeviationCheck(position, plannedRoute, {
  onWarning(location, metresOff) {
    vibrate([200])
    report(() => walkApi.reportDeviation(walkId.value, 'warning', location, Math.round(metresOff)))
  },
  onNotify(location, metresOff) {
    vibrate([200, 100, 200])
    report(() => walkApi.reportDeviation(walkId.value, 'notify', location, Math.round(metresOff)))
  },
  onBackOnRoute(location, ownerWasNotified) {
    showBackOnRoute(ownerWasNotified
      ? "You're back on the route. The owner has been told."
      : "You're back on the route.")
    report(() => walkApi.reportBackOnRoute(walkId.value, location))
  }
})

// ---- The walk's path, saved on the phone ----
// localStorage can be unavailable (e.g. private windows), so a failure only means a reload would lose the path
const pathKey = (id) => `walk-path-${id}`

function savedPath(id) {
  try {
    return JSON.parse(localStorage.getItem(pathKey(id))) ?? []
  } catch {
    return []
  }
}

function clearSavedPath(id) {
  try {
    localStorage.removeItem(pathKey(id))
  } catch { /* nothing to clear */ }
}

watch(() => path.value.length, () => {
  if (!walkId.value) return
  try {
    localStorage.setItem(pathKey(walkId.value), JSON.stringify(path.value))
  } catch { /* the walk carries on without the saved copy */ }
})

function followRoute(walk) {
  trackedWalk.value = walk
  plannedRoute.value = walk.plannedPath?.coordinates ?? []
  if (plannedRoute.value.length >= 2) deviation.start()
}

// Starts recording a walk that has just started
export function beginWalk(walk) {
  walkId.value = walk._id
  backHomeSince.value = null
  reminderSent = false
  resetLeftHome()
  geo.startRecording()
  followRoute(walk)
}

// Carries on recording a walk already under way, from its saved path.
// Returns false if there's no saved path, so recording starts again from here.
export function resumeWalk(walk) {
  if (walkId.value === walk._id) return true
  const saved = savedPath(walk._id)
  walkId.value = walk._id
  hasLeftHome.value = true // they've been out walking, so coming home should allow ending the walk
  geo.startRecording(saved)
  followRoute(walk)
  return saved.length > 0
}

// Stops recording once the server has saved the walk
export function endWalk() {
  geo.stopRecording()
  deviation.stop()
  if (walkId.value) clearSavedPath(walkId.value)
  walkId.value = null
  backHomeSince.value = null
}

// Drop points that barely change the shape (within about 2 m), so the path is smaller to send
export const simplifiedPath = () =>
  path.value.length < 2 ? [...path.value] : simplify(lineString(path.value), { tolerance: 0.00002 }).geometry.coordinates

// The sharing cutoff has passed: a walk back at the home is finished, and one still out is ended early.
// If it can't reach the server, the next check tries again.
async function endWalkAtCutoff() {
  if (!walkId.value) return
  const id = walkId.value
  const route = simplifiedPath()
  const last = route.at(-1)
  const isHome = home.value && route.length >= 2 && distance(last, home.value, { units: 'meters' }) <= HOME_RADIUS_M
  try {
    trackedWalk.value = await sendInOrder(() =>
      isHome ? walkApi.finish(id, route) : walkApi.endEarly(id, route, AUTO_END_REASON)
    )
  } catch (err) {
    // 400: the server has closed it already. Anything else is worth trying again.
    if (err.response?.status !== 400) return
  }
  endWalk()
  walkEndedCount.value++
}

// ---- Sending the location ----
async function sendLocation() {
  if (document.hidden) return // nothing is live while the page is hidden, so the owner sees "Location paused"
  const { reading } = geo
  const body = blocked.value
    ? { blocked: true }
    : reading.value && reading.value.accuracy <= MAX_SHARED_ACCURACY_M ? reading.value : null
  if (!body) return
  try {
    const res = await visitsApi.sendLocation(visitId.value, body)
    if (res.sharing === false) sharingEndsAt.value = Date.now()
  } catch (err) {
    // 400 / 404: the session is over. Anything else is probably the connection, so the next check tries again.
    if ([400, 404].includes(err.response?.status)) stopTracking()
  }
}

// The server only notifies once per walk. If this fails, the next check tries again.
async function sendWalkReminder() {
  if (!reminderDue.value || reminderSent) return
  reminderSent = true
  try {
    await walkApi.remindBackHome(walkId.value)
  } catch {
    reminderSent = false
  }
}

async function check() {
  now.value = Date.now()
  if (!visitId.value) return
  if (sharingEnded.value) {
    await endWalkAtCutoff()
    if (!walkId.value) {
      geo.stop()
      clearInterval(timer)
    }
    return
  }
  await sendWalkReminder()
  if (blocked.value) geo.restart() // notices when location is switched back on
  await sendLocation()
}

function startTracking(session) {
  visitId.value = session.visit._id
  sharingEndsAt.value = session.sharingEndsAt ?? null
  home.value = session.visit.home?.length ? session.visit.home : null
  now.value = Date.now()
  if (!sharingEnded.value) geo.start()
  if (session.activeWalk) resumeWalk(session.activeWalk)
  clearInterval(timer)
  timer = setInterval(check, SEND_EVERY_MS)
  check()
}

// Starts tracking the sitter's active session, if there is one and it isn't being tracked yet.
// Runs when they log in or reload, and after starting a session.
export async function resumeTracking() {
  if (visitId.value) return
  try {
    const { sessions } = await visitsApi.today()
    const active = sessions.find((s) => s.visit?.status === 'active')
    if (active) startTracking(active)
  } catch (err) {
    console.warn('Could not start location tracking', err)
  }
}

// The session has ended, or the sitter has logged out
export function stopTracking() {
  clearInterval(timer)
  geo.stop()
  deviation.stop()
  visitId.value = null
  sharingEndsAt.value = null
  walkId.value = null
  backHomeSince.value = null
}

// GPS for a walk page with no session being tracked (and a way to stop it again)
export const startGps = () => geo.start()
export function stopGpsIfIdle() {
  if (!visitId.value) geo.stop()
}
