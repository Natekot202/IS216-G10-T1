import { ref, computed, watch } from 'vue'
import { distance } from '@turf/turf'

// How close to home (in metres) a route or walk must start and finish.
// Must match HOME_RADIUS_M in server/src/utils/walkGeo.js
export const HOME_RADIUS_M = 75

// Works out where the user is compared to home.
//   position: ref of the current [lng, lat] (from useGeoTracker)
//   home:     ref (or computed) of the home [lng, lat]
export function useHomeCheck(position, home) {
  // How far from home right now, in metres (null until there's a GPS reading and a home)
  // recalculates on every GPS reading
  const metresFromHome = computed(() => {
    if (!position.value || !home.value) return null
    return Math.round(distance(position.value, home.value, { units: 'meters' }))
  })

  // true when within HOME_RADIUS_M of home
  const nearHome = computed(() => metresFromHome.value !== null && metresFromHome.value <= HOME_RADIUS_M)

  // true once the user has walked out of the home circle;
  // call resetLeftHome() when a recording or walk starts
  const hasLeftHome = ref(false)
  watch(nearHome, (near) => {
    if (!near) hasLeftHome.value = true
  })

  function resetLeftHome() {
    hasLeftHome.value = false
  }

  return { metresFromHome, nearHome, hasLeftHome, resetLeftHome }
}
