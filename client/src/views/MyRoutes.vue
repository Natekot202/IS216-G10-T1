<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import WalkMap from '../components/WalkMap.vue'
import { currentUser, fetchUser } from '../services/auth.js'
import { walkRoutesApi } from '../services/walkRouteApi.js'
import { HOME_RADIUS_M } from '../utils/useHomeCheck.js'

const router = useRouter()

const walkRoutes = ref([])          // the owner's saved routes, newest first
const loading = ref(true)
const loadError = ref('')
const selectedId = ref(null)        // the route shown on the map
const renamingId = ref(null)        // the route whose name is being edited
const newName = ref('')
const confirmingDeleteId = ref(null) // the route showing "Delete this route?"
const busyId = ref(null)            // the route waiting on the server
const actionError = ref('')

// The owner's home as [lng, lat], from the postal code on their profile
const home = computed(() => currentUser.value?.ownerProfile?.address?.location?.coordinates ?? null)

const selectedRoute = computed(() => walkRoutes.value.find((r) => r._id === selectedId.value) ?? null)

const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`)
const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })

onMounted(async () => {
  if (!currentUser.value) await fetchUser()
  try {
    walkRoutes.value = await walkRoutesApi.getMyRoutes()
    selectedId.value = walkRoutes.value[0]?._id ?? null // show the newest route first
  } catch (err) {
    loadError.value = err.response?.data?.message ?? 'Could not load your routes. Please try again.'
  } finally {
    loading.value = false
  }
})

// --- Rename ---
function startRename(walkRoute) {
  renamingId.value = walkRoute._id
  newName.value = walkRoute.name
  confirmingDeleteId.value = null
  actionError.value = ''
}

async function saveRename(walkRoute) {
  const name = newName.value.trim()
  if (!name) {
    actionError.value = 'Give your route a name.'
    return
  }

  busyId.value = walkRoute._id
  actionError.value = ''
  try {
    const updated = await walkRoutesApi.update(walkRoute._id, { name })
    // swap the old copy in the list for the updated one from the server
    walkRoutes.value = walkRoutes.value.map((r) => (r._id === updated._id ? updated : r))
    renamingId.value = null
  } catch (err) {
    actionError.value = err.response?.data?.message ?? 'Could not rename the route. Please try again.'
  } finally {
    busyId.value = null
  }
}

// --- Delete ---
function askDelete(walkRoute) {
  confirmingDeleteId.value = walkRoute._id
  renamingId.value = null
  actionError.value = ''
}

async function deleteRoute(walkRoute) {
  busyId.value = walkRoute._id
  actionError.value = ''
  try {
    await walkRoutesApi.remove(walkRoute._id)
    walkRoutes.value = walkRoutes.value.filter((r) => r._id !== walkRoute._id)
    if (selectedId.value === walkRoute._id) selectedId.value = walkRoutes.value[0]?._id ?? null
    confirmingDeleteId.value = null
  } catch (err) {
    actionError.value = err.response?.data?.message ?? 'Could not delete the route. Please try again.'
  } finally {
    busyId.value = null
  }
}

// --- Re-record ---
function reRecord(walkRoute) {
  router.push({ name: 'rerecord-route', params: { id: walkRoute._id } })
}
</script>

<template>
  <div class="p-3 d-flex flex-column gap-3">
    <header class="d-flex flex-wrap align-items-end gap-2">
      <div>
        <h1 class="page-title mb-1">My routes</h1>
        <p class="text-body-secondary mb-0">Walking routes you've recorded.</p>
      </div>
      <router-link v-if="home" :to="{ name: 'record-route' }" class="btn btn-primary ms-auto">Record new route</router-link>
    </header>

    <p v-if="loading" class="text-body-secondary mb-0">Loading your routes…</p>

    <div v-else-if="loadError" class="alert alert-danger mb-0">{{ loadError }}</div>

    <!-- No home location yet: can't record -->
    <div v-else-if="!home" class="alert alert-danger mb-0">
      Add your postal code in <router-link to="/editProfile">Edit Profile</router-link> first.
      We use it to check that routes start and finish at your home.
    </div>

    <div v-else-if="walkRoutes.length === 0" class="info-card">
      <p class="mb-2">You haven't recorded any routes yet.</p>
    </div>

    <div v-else class="row g-3">
      <!-- List of routes -->
      <div class="col-md-5 col-lg-4">
        <div v-if="actionError" class="alert alert-danger py-2">{{ actionError }}</div>

        <ul class="list-unstyled d-flex flex-column gap-2 mb-0 route-list">
          <li
            v-for="walkRoute in walkRoutes"
            :key="walkRoute._id"
            class="info-card route-card"
            :class="{ selected: walkRoute._id === selectedId }"
            @click="selectedId = walkRoute._id"
          >
            <!-- Renaming -->
            <form v-if="renamingId === walkRoute._id" class="d-flex gap-2" @submit.prevent="saveRename(walkRoute)" @click.stop>
              <input v-model="newName" class="form-control form-control-sm" maxlength="60" aria-label="Route name" />
              <button type="button" class="btn btn-sm bg-white border" @click="renamingId = null">Cancel</button>
              <button type="submit" class="btn btn-sm btn-primary" :disabled="busyId === walkRoute._id">Save</button>
            </form>
            <h2 v-else class="card-heading mb-1">{{ walkRoute.name }}</h2>

            <div class="d-flex gap-4 mt-1">
              <div>
                <div class="section-label">Distance</div>
                <div>{{ formatDistance(walkRoute.distanceM) }}</div>
              </div>
              <div>
                <div class="section-label">Recorded</div>
                <div>{{ formatDate(walkRoute.createdAt) }}</div>
              </div>
            </div>

            <!-- Confirm delete -->
            <div v-if="confirmingDeleteId === walkRoute._id" class="alert alert-danger py-2 mt-2 mb-0" @click.stop>
              <p class="mb-2">Delete this route? This can't be undone.</p>
              <div class="d-flex gap-2 justify-content-end">
                <button class="btn btn-sm bg-white border" @click="confirmingDeleteId = null">Cancel</button>
                <button class="btn btn-sm btn-danger" :disabled="busyId === walkRoute._id" @click="deleteRoute(walkRoute)">
                  {{ busyId === walkRoute._id ? 'Deleting…' : 'Delete' }}
                </button>
              </div>
            </div>

            <!-- Actions -->
            <div v-else-if="renamingId !== walkRoute._id" class="d-flex gap-3 mt-2" @click.stop>
              <button class="btn btn-link text-secondary p-0" @click="startRename(walkRoute)">Rename</button>
              <button class="btn btn-link text-secondary p-0" @click="reRecord(walkRoute)">Re-record</button>
              <button class="btn btn-link text-danger p-0 ms-auto" @click="askDelete(walkRoute)">Delete</button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Map of the selected route -->
      <div class="col-md-7 col-lg-8">
        <WalkMap
          class="route-map rounded-3 border"
          :home="home"
          :home-radius-m="HOME_RADIUS_M"
          :planned-route="selectedRoute?.path.coordinates ?? []"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* PetSociety design system */
.page-title {
  font-size: 32px;
  font-weight: 700;
}
.card-heading {
  font-size: 18px;
  font-weight: 600;
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
.route-card {
  cursor: pointer;
}
.route-card.selected {
  border-color: #e8692c;
  box-shadow: 0 0 0 1px #e8692c;
}
.route-map {
  height: 400px;
}
@media (min-width: 768px) {
  .route-list {
    max-height: calc(100vh - 160px);
    overflow-y: auto;
  }
  .route-map {
    height: calc(100vh - 160px);
  }
}
</style>
