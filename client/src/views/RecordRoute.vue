<script setup>
import { ref, computed, onMounted, watch} from 'vue'
import { distance, length, lineString, simplify } from '@turf/turf'
import WalkMap from '../components/WalkMap.vue'
import { useGeoTracker } from '../utils/useGeoTracker.js'
import { currentUser, fetchUser } from '../services/auth.js'
import { walkRoutesApi } from '../services/walkRouteApi.js'

// Must match HOME_RADIUS_M in server/src/controllers/walkRouteController.js
const HOME_RADIUS_M = 75

const { position, path, accuracy, error, start, startRecording, stopRecording } = useGeoTracker()

// Which stage the page is at: 'loading' -> 'ready' -> 'recording' -> 'naming' -> 'saved'
const step = ref('loading');
const hasLeftHome = ref(false);
const routeName = ref('');
const saving = ref(false);
const saveError = ref('');
const savedRoute = ref(null);

// The owner's home as [lng, lat], from the postal code on their profile
const home = computed(() => currentUser.value?.ownerProfile?.address?.location?.coordinates ?? null)

// How far the owner is from home right now, in metres (null until the first GPS reading)
// depends on position.value, recalculates on every GPS reading
const metresFromHome = computed(() => {
  if (!position.value || !home.value) return null
  return Math.round(distance(position.value, home.value, { units: 'meters' }))
})
const nearHome = computed(() => metresFromHome.value !== null && metresFromHome.value <= HOME_RADIUS_M)

// once out of home radius after recording starts, hasLeftHome is set to true
watch(nearHome, (near) => {
  if(step.value === 'recording' && !near) hasLeftHome.value = true
})

// Length of what's been recorded so far, in metres
const recordedM = computed(() =>
  path.value.length < 2 ? 0 : Math.round(length(lineString(path.value), { units: 'meters' }))
)

const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`)

onMounted(async () => {
  if (!currentUser.value) await fetchUser()
  step.value = 'ready'
  if (home.value) start()   // GPS on straight away, so the owner can see how far they are from home
})

function beginRecording() {
  hasLeftHome.value = false;
  startRecording()
  step.value = 'recording'
}

function finishRecording() {
  stopRecording()
  step.value = 'naming'
}

// Throws the current recording away and goes back to the start
// used by buttons Cancel, Discard and Record another route(after saving)
function reset() {
  hasLeftHome.value = false;
  stopRecording()
  path.value = []
  routeName.value = ''
  saveError.value = ''
  savedRoute.value = null
  step.value = 'ready'
}

//
async function save() {
  const name = routeName.value.trim()
  if (!name) {
    saveError.value = 'Give your route a name.'
    return
  }

  saving.value = true
  saveError.value = ''
  try {
    // Drop points that barely change the shape (within about 2 m), so the route is smaller to store
    const simplified = simplify(lineString(path.value), { tolerance: 0.00002 }).geometry.coordinates
    savedRoute.value = await walkRoutesApi.create(name, simplified)
    step.value = 'saved'
  } catch (err) {
    saveError.value = err.response?.data?.message ?? 'Could not save the route. Please try again.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="d-flex flex-column vh-100 p-3 gap-3">
    <header>
      <h1 class="page-title mb-1">Record a walking route</h1>
      <p class="text-body-secondary mb-0">Walk the route with your phone. It must start and finish at your home.</p>
    </header>

    <!-- No home location yet: can't record -->
    <div v-if="step !== 'loading' && !home" class="alert alert-danger mb-0">
      Add your postal code in <router-link to="/editProfile">Edit Profile</router-link> first.
      We use it to check that routes start and finish at your home.
    </div>

    <template v-else-if="step !== 'loading'">
      <!-- Stats and main buttons -->
      <div class="info-card d-flex flex-wrap align-items-center gap-4">
        <div>
          <div class="section-label">From home</div>
          <div class="stat">{{ metresFromHome === null ? 'Locating…' : formatDistance(metresFromHome) }}</div>
        </div>
        <div v-if="step !== 'ready'">
          <div class="section-label">Recorded</div>
          <div class="stat">{{ formatDistance(recordedM) }}</div>
        </div>
        <div v-if="accuracy">
          <div class="section-label">GPS accuracy</div>
          <div class="stat">±{{ Math.round(accuracy) }} m</div>
        </div>

        <div class="ms-auto d-flex gap-2">
          <button v-if="step === 'ready'" class="btn btn-primary" :disabled="!nearHome" @click="beginRecording">
            Start recording
          </button>
          <template v-else-if="step === 'recording'">
            <button class="btn bg-white border" @click="reset">Cancel</button>
            <button class="btn btn-primary" :disabled="!(hasLeftHome && nearHome)" @click="finishRecording">
              End recording
            </button>
          </template>
        </div>
      </div>

      <!-- Messages -->
      <div v-if="error" class="alert alert-danger mb-0">{{ error }}</div>
      <template v-else-if="metresFromHome !== null">
        <div v-if="step === 'ready'" class="alert mb-0" :class="nearHome ? 'alert-success' : 'alert-danger'">
          <template v-if="nearHome">You're at home. Press <strong>Start recording</strong> when you're ready to walk.</template>
          <template v-else>You're {{ formatDistance(metresFromHome) }} from home. Go within {{ HOME_RADIUS_M }} m of home to start.</template>
        </div>
        <p v-else-if="step === 'recording'" class="text-body-secondary small mb-0">
          {{ hasLeftHome && nearHome ? "You're back home. Press End to end the walk." : 'Recording… walk your route, then come back home to finish.' }}
        </p>
      </template>

      <!-- Name and save -->
      <form v-if="step === 'naming'" class="info-card" @submit.prevent="save">
        <label class="section-label form-label" for="route-name">Route name</label>
        <input id="route-name" v-model="routeName" class="form-control mb-2" maxlength="60" placeholder="e.g. Morning park loop" />
        <div v-if="saveError" class="alert alert-danger py-2">{{ saveError }}</div>
        <div class="d-flex gap-2 justify-content-end">
          <button type="button" class="btn bg-white border" @click="reset">Discard</button>
          <button type="submit" class="btn btn-primary" :disabled="saving">{{ saving ? 'Saving…' : 'Save route' }}</button>
        </div>
      </form>

      <!-- Saved -->
      <div v-if="step === 'saved'" class="alert alert-success d-flex flex-wrap align-items-center gap-2 mb-0">
        <span>Saved <strong>{{ savedRoute.name }}</strong> ({{ formatDistance(savedRoute.distanceM) }}).</span>
        <button class="btn btn-link text-secondary ms-auto p-0" @click="reset">Record another route</button>
      </div>

      <WalkMap class="flex-grow-1 rounded-3 border" :home="home" :home-radius-m="HOME_RADIUS_M" :position="position" :walked-path="path" />
    </template>
  </div>
</template>

<style scoped>
/* PetSociety design system */
.page-title {
  font-size: 32px;
  font-weight: 700;
}
.info-card {
  background: #fff;
  border: 1px solid #ede3d8;
  border-radius: 10px;
  padding: 12px 16px;
}
.section-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--bs-secondary-color);
}
.stat {
  font-size: 18px;
  font-weight: 600;
}
</style>
