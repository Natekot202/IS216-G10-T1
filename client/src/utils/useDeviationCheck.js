import { ref, computed, watch } from 'vue'
import { lineString, point, pointToLineDistance } from '@turf/turf'

// ---- Deviation thresholds: change these to tune the alerts ----
export const WARN_M = 25            // further than this from the route: the sitter is warned
export const NOTIFY_M = 50          // further than this: the owner is notified
export const READINGS_IN_A_ROW = 3  // how many GPS readings in a row before it counts (ignores GPS jumps)
// Back on route = within WARN_M again for READINGS_IN_A_ROW readings.

// Compares the sitter's position with the planned route on every GPS reading.
//   position:     ref of the current [lng, lat] (from useGeoTracker)
//   plannedRoute: ref (or computed) of the route's points, [[lng, lat], ...]
//   handlers:     functions to call when the level changes
//     onWarning(location, metresOff)            - went past WARN_M
//     onNotify(location, metresOff)             - went past NOTIFY_M
//     onBackOnRoute(location, ownerWasNotified) - came back within WARN_M
//
// level is 'on-route' -> 'warning' -> 'notified', and back to 'on-route'.
export function useDeviationCheck(position, plannedRoute, handlers = {}) {
  const level = ref('on-route')
  const metresOffRoute = ref(null)   // how far from the route right now, in metres
  const active = ref(false)          // only checks between start() and stop()

  // readings in a row beyond each threshold (or back within WARN_M)
  let beyondWarn = 0
  let beyondNotify = 0
  let withinWarn = 0

  // the route as a Turf line, or null if there isn't a usable route
  const routeLine = computed(() =>
    plannedRoute.value && plannedRoute.value.length >= 2 ? lineString(plannedRoute.value) : null
  )

  function start() {
    level.value = 'on-route'
    metresOffRoute.value = null
    beyondWarn = beyondNotify = withinWarn = 0
    active.value = true
  }

  function stop() {
    active.value = false
  }

  // runs on every new GPS reading
  watch(position, (p) => {
    if (!active.value || !p || !routeLine.value) return

    const metresOff = pointToLineDistance(point(p), routeLine.value, { units: 'meters' })
    metresOffRoute.value = Math.round(metresOff)

    // count readings in a row; a reading that doesn't match resets that count to 0
    beyondWarn = metresOff > WARN_M ? beyondWarn + 1 : 0
    beyondNotify = metresOff > NOTIFY_M ? beyondNotify + 1 : 0
    withinWarn = metresOff <= WARN_M ? withinWarn + 1 : 0

    // on route -> warning
    if (level.value === 'on-route' && beyondWarn >= READINGS_IN_A_ROW) {
      level.value = 'warning'
      handlers.onWarning?.(p, metresOff)
    }
    // warning -> owner notified (can happen on the same reading if the sitter went far quickly)
    if (level.value === 'warning' && beyondNotify >= READINGS_IN_A_ROW) {
      level.value = 'notified'
      handlers.onNotify?.(p, metresOff)
    }
    // warning or notified -> back on route
    if (level.value !== 'on-route' && withinWarn >= READINGS_IN_A_ROW) {
      const ownerWasNotified = level.value === 'notified'
      level.value = 'on-route'
      handlers.onBackOnRoute?.(p, ownerWasNotified)
    }
  })

  return { level, metresOffRoute, start, stop }
}
