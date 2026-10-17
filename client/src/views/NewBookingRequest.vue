<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'

// Same setup as services/bookingApi.js: Vite forwards /api to the server, and
// withCredentials sends the login cookie.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true })

const route = useRoute()
const sitterId = route.query.sitterId // from the URL: /bookings/new?sitterId=...

// Turns a Date into 'YYYY-MM-DD' (what <input type="date"> uses), in local time.
function toDateString(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// '2026-10-20' -> '20 Oct 2026'
function prettyDate(s) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}
const today = toDateString(new Date())

const sitter = ref(null) // { username, sitterProfile: { petsittingRates, ... } }
const pets = ref([]) // the logged-in owner's pets
const availability = ref({}) // { '2026-10-20': 'available' | 'blocked' | 'booked' }
const loadError = ref('')

// What the owner fills in
const selectedPets = ref([]) // array of pet ids
const startDate = ref('')
const endDate = ref('')
const notes = ref('')

const error = ref('')
const sending = ref(false) // tracks wether the booking request is currently sent to the server 
const booking = ref(null) // the created booking, once sent

const rate = computed(() => sitter.value?.sitterProfile?.petsittingRates || 0)
// use '?.' instead of '.' so that if sitter.value/sitterProfile is null/undefined it wont throw an error 

// returns an array of day dates from start to end, inclusive. Empty if the dates aren't filled in properly.
const chosenDays = computed(() => {
  if (!startDate.value || !endDate.value || endDate.value < startDate.value) return []
  const days = []
  const d = new Date(startDate.value + 'T00:00:00') // dateObj for start-date 
  const end = new Date(endDate.value + 'T00:00:00') // dateObj for end-date
  while (d <= end) {
    days.push(toDateString(d)) // convert the current date into a string and add it to days 
    d.setDate(d.getDate() + 1) // move d forward by one day by updating the initial d dateObj
  }
  return days
})

// Price preview: daily rate × number of days
const totalPrice = computed(() => rate.value * chosenDays.value.length)

// Chosen days the sitter hasn't marked as available
const unavailableDays = computed(() => chosenDays.value.filter((d) => availability.value[d] !== 'available'))
// array of days within chosenDays array where availability != 'available'

function togglePet(id) {
  if (selectedPets.value.includes(id)) selectedPets.value = selectedPets.value.filter((p) => p !== id) 
  //if pet id is alr in selectedPet arary, clicking the pet means yw to remove it, so .filter keeps only the pets != to that pet id 
  else selectedPets.value.push(id)
  // adds pet id to selectedPets array 
}

// ----- Care checklist -----
const categories = ['feed', 'walk', 'groom', 'medication', 'other'] // same list the server accepts
const tasks = ref([]) // each task: { category, title, dailyFrequency, petIds }

// The pets picked above, as full objects (so a task can show their names)
const selectedPetList = computed(() => pets.value.filter((p) => selectedPets.value.includes(p._id)))

function addTask() {
  // petIds: [] means "all the selected pets"
  tasks.value.push({ category: 'feed', title: '', dailyFrequency: 1, petIds: [] })
}

function removeTask(index) {
  tasks.value.splice(index, 1) // remove 1 task at this position
}

// Same idea as togglePet, but for the pets chosen on one task
function toggleTaskPet(task, id) {
  if (task.petIds.includes(id)) task.petIds = task.petIds.filter((p) => p !== id)
  else task.petIds.push(id)
}


async function sendRequest() {
  error.value = ''
  // Quick checks before calling the server (the server checks these again)
  if (selectedPets.value.length === 0) return (error.value = 'Select at least one pet.')
  if (!startDate.value || !endDate.value) return (error.value = 'Choose a start and end date.')
  if (endDate.value < startDate.value) return (error.value = 'End date must be on or after the start date.')
  if (unavailableDays.value.length) {
    return (error.value = `The sitter is not available on ${unavailableDays.value.map(prettyDate).join(', ')}.`)
  }

  if (tasks.value.some((t) => !t.title.trim())) {
    return (error.value = 'Give every care task a description, or remove it.')
  }
  if (tasks.value.some((t) => !Number.isInteger(t.dailyFrequency) || t.dailyFrequency < 1 || t.dailyFrequency > 10)) {
    return (error.value = 'Times a day must be a whole number from 1 to 10.')
  }
  // .some returns true/false for the condition 

  sending.value = true
  try {
    const res = await api.post('/bookings', {
      sitterId,
      petIds: selectedPets.value,
      startDate: startDate.value,
      endDate: endDate.value,
      notes: notes.value,
      tasks: tasks.value.map((t) => {
        // keep only pets that are still selected; if none are left, the task is for all selected pets
        const chosen = t.petIds.filter((id) => selectedPets.value.includes(id))
        return {
          category: t.category,
          title: t.title.trim(),
          dailyFrequency: t.dailyFrequency,
          petIds: chosen.length ? chosen : selectedPets.value
        }
      })
    })
    booking.value = res.data
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not send the booking request.'
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  if (!sitterId) return (loadError.value = 'No sitter selected. Pick a sitter from Search Sitters first.')
  try {
    const [s, p, a] = await Promise.all([
      api.get(`/users/${sitterId}`), // sitter's public profile (name, rate)
      api.get('/pets'), // my pets
      api.get(`/availability/${sitterId}`) // sitter's available days
    ])
    sitter.value = s.data
    pets.value = p.data
    a.data.forEach((day) => (availability.value[day.date] = day.status))
  } catch (err) {
    loadError.value = err.response?.data?.message || 'Could not load this sitter.'
  }
})
</script>

<template>
  <h1 class="h3 fw-bold mb-3">New Booking Request</h1>

  <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>

  <!-- After sending: confirmation -->
  <div v-else-if="booking" class="card shadow-sm">
    <div class="card-body text-center py-5">
      <div class="fs-1">🐾</div>
      <h2 class="h5">Request sent to {{ sitter.username }}</h2>
      <p class="text-muted mb-1">{{ prettyDate(booking.startDate) }} – {{ prettyDate(booking.endDate) }} · ${{ booking.totalPrice }}</p>
      <p class="small">Status: <span class="badge text-bg-warning">{{ booking.status }}</span></p>
      <p v-if="booking.tasks" class="small text-muted">{{ booking.tasks }} care task{{ booking.tasks === 1 ? '' : 's' }} included</p>
      <router-link to="/owner/bookings" class="btn btn-dark mt-2">View My Bookings</router-link>
    </div>
  </div>

  <!-- The form -->
  <div v-else-if="sitter" class="row g-3">
    <div class="col-lg-8">
      <div class="card shadow-sm">
        <div class="card-body">
          <!-- Sitter -->
          <div class="d-flex align-items-center gap-3 mb-4">
            <div class="avatar">{{ sitter.username.charAt(0).toUpperCase() }}</div>
            <div>
              <div class="fw-semibold">{{ sitter.username }}</div>
              <div class="small text-muted">${{ rate }}/day</div>
            </div>
          </div>

          <!-- Pets -->
          <h3 class="h6 text-uppercase text-muted fw-bold">Select Pet</h3>
          <p v-if="pets.length === 0" class="small text-muted">You have no pets yet. Add one from your profile first.</p>
          <div class="d-flex flex-wrap gap-2 mb-4">
            <button
              v-for="pet in pets"
              :key="pet._id"
              type="button"
              class="btn btn-sm rounded-pill px-3"
              :class="selectedPets.includes(pet._id) ? 'btn-dark' : 'btn-outline-secondary'"
              @click="togglePet(pet._id)"
            >
              {{ pet.name }}
            </button>
          </div>

          <!-- Dates -->
          <h3 class="h6 text-uppercase text-muted fw-bold">Dates</h3>
          <div class="row g-2 mb-4">
            <div class="col-sm-6">
              <label class="form-label small" for="start">Start date</label>
              <input id="start" v-model="startDate" type="date" class="form-control" :min="today" />
            </div>
            <div class="col-sm-6">
              <label class="form-label small" for="end">End date</label>
              <input id="end" v-model="endDate" type="date" class="form-control" :min="startDate || today" />
            </div>
          </div>

          <!-- Notes -->
          <h3 class="h6 text-uppercase text-muted fw-bold">Notes to Sitter</h3>
          <textarea v-model="notes" class="form-control" rows="4" placeholder="Feeding times, medication, walking routine…"></textarea>

          <!-- Care checklist -->
          <h3 class="h6 text-uppercase text-muted fw-bold mt-4">Care Checklist</h3>
          <p class="small text-muted">What should the sitter do each day? Optional.</p>

          <div v-for="(task, i) in tasks" :key="i" class="border rounded p-2 mb-2">
            <div class="row g-2 align-items-end">
              <div class="col-sm-3">
                <label class="form-label small mb-1">Type</label>
                <select v-model="task.category" class="form-select form-select-sm">
                  <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>
              <div class="col-sm-5">
                <label class="form-label small mb-1">What to do</label>
                <input v-model="task.title" type="text" maxlength="120" class="form-control form-control-sm" placeholder="e.g. Feed 1 cup kibble at 8am" />
              </div>
              <div class="col-6 col-sm-2">
                <label class="form-label small mb-1">Times a day</label>
                <input v-model.number="task.dailyFrequency" type="number" min="1" max="10" class="form-control form-control-sm" />
              </div>
              <div class="col-6 col-sm-2 text-end">
                <button type="button" class="btn btn-sm btn-outline-danger" @click="removeTask(i)">Remove</button>
              </div>
            </div>
            <!-- Only worth choosing pets when more than one is selected -->
            <div v-if="selectedPetList.length > 1" class="d-flex flex-wrap align-items-center gap-2 mt-2">
              <span class="small text-muted">For:</span>
              <button
                v-for="pet in selectedPetList"
                :key="pet._id"
                type="button"
                class="btn btn-sm rounded-pill px-2 py-0"
                :class="task.petIds.includes(pet._id) ? 'btn-dark' : 'btn-outline-secondary'"
                @click="toggleTaskPet(task, pet._id)"
              >
                {{ pet.name }}
              </button>
              <span v-if="task.petIds.length === 0" class="small text-muted">(all selected pets)</span>
            </div>
          </div>

          <button type="button" class="btn btn-outline-secondary btn-sm" @click="addTask">+ Add Task</button>
        </div>
      </div>
    </div>

    <!-- Price preview (right on wide screens, below on small) -->
    <div class="col-lg-4">
      <div class="card shadow-sm">
        <div class="card-body">
          <h3 class="h6 text-uppercase text-muted fw-bold mb-3">Price Preview</h3>
          <div class="d-flex justify-content-between small"><span>Daily rate</span><span>${{ rate }}</span></div>
          <div class="d-flex justify-content-between small"><span>Days</span><span>{{ chosenDays.length || '–' }}</span></div>
          <hr />
          <div class="d-flex justify-content-between fw-bold"><span>Total</span><span>${{ totalPrice }}</span></div>
          <div v-if="unavailableDays.length" class="alert alert-warning small py-2 mt-3 mb-0">
            Not available on {{ unavailableDays.map(prettyDate).join(', ') }}
          </div>
        </div>
      </div>
    </div>

    <div class="col-12">
      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
      <button class="btn btn-dark w-100 py-2 fw-semibold" :disabled="sending" @click="sendRequest">
        {{ sending ? 'Sending…' : 'Send Booking Request' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fbeee4;
  color: #c44f1c;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}
</style>
