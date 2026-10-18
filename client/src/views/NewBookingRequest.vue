<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import { formatTime } from '../utils/bookingHelpers.js'
import { toDateString, prettyDate } from '../utils/bookingTimeHelpers.js'
import BookingDatePicker from '../components/BookingDatePicker.vue'
import CareChecklistEditor from '../components/CareChecklistEditor.vue'

// Same setup as services/bookingApi.js: Vite forwards /api to the server, and
// withCredentials sends the login cookie.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true })

const route = useRoute()
const sitterId = route.query.sitterId // from the URL: /bookings/new?sitterId=...

const sitter = ref(null) // { username, sitterProfile: { petsittingRates, ... } }
const pets = ref([]) // the logged-in owner's pets
const availability = ref({}) // { '2026-10-20': 'available' | 'blocked' }
const busy = ref([]) // times the sitter is already booked: [{ start, end }] as moments (milliseconds)
const loadError = ref('')

// What the owner fills in
const selectedPets = ref([]) // array of pet ids
// What the date picker says was chosen (it sends this to us): { startDate, startTime, endDate, endTime, clash }
const when = ref({ startDate: '', startTime: '', endDate: '', endTime: '', clash: false })
const tasks = ref([]) // the care tasks (the checklist editor sends us this list)
const notes = ref('')

const error = ref('')
const sending = ref(false) // tracks wether the booking request is currently sent to the server 
const booking = ref(null) // the created booking, once sent

const rate = computed(() => sitter.value?.sitterProfile?.petsittingRates || 0)
// use '?.' instead of '.' so that if sitter.value/sitterProfile is null/undefined it wont throw an error 

// returns an array of day dates from start to end, inclusive. Empty if the dates aren't filled in properly.
const chosenDays = computed(() => {
  if (!when.value.startDate || !when.value.endDate || when.value.endDate < when.value.startDate) return []
  const days = []
  const d = new Date(when.value.startDate + 'T00:00:00') // dateObj for start-date 
  const end = new Date(when.value.endDate + 'T00:00:00') // dateObj for end-date
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

// Safety net: did the date picker find that the chosen time runs into a time the sitter is booked?
const clash = computed(() => when.value.clash)

function togglePet(id) {
  if (selectedPets.value.includes(id)) selectedPets.value = selectedPets.value.filter((p) => p !== id) 
  //if pet id is alr in selectedPet arary, clicking the pet means yw to remove it, so .filter keeps only the pets != to that pet id 
  else selectedPets.value.push(id)
  // adds pet id to selectedPets array 
}

// The pets picked above, as full objects (so a task can show their names)
const selectedPetList = computed(() => pets.value.filter((p) => selectedPets.value.includes(p._id)))

async function sendRequest() {
  error.value = ''
  // Quick checks before calling the server (the server checks these again)
  if (selectedPets.value.length === 0) return (error.value = 'Select at least one pet.')
  if (!when.value.startDate || !when.value.endDate) return (error.value = 'Choose a start and end date.')
  if (when.value.endDate < when.value.startDate) return (error.value = 'End date must be on or after the start date.')
  if (!when.value.startTime || !when.value.endTime) return (error.value = 'Choose a start time and an end time.')
  if (clash.value) return (error.value = 'The sitter is already booked during this time. Please choose different times.')
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
      startDate: when.value.startDate,
      startTime: when.value.startTime,
      endDate: when.value.endDate,
      endTime: when.value.endTime,
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
    const [s, p, a, b] = await Promise.all([
      api.get(`/users/${sitterId}`), // sitter's public profile (name, rate)
      api.get('/pets'), // my pets
      api.get(`/availability/${sitterId}`), // sitter's available days
      api.get(`/availability/${sitterId}/busy`) // times the sitter is already booked
    ])
    sitter.value = s.data
    pets.value = p.data
    a.data.forEach((day) => (availability.value[day.date] = day.status))
    busy.value = b.data.map((x) => ({ start: new Date(x.start).getTime(), end: new Date(x.end).getTime() })) 
    // converts timestamp_str into milliseconds since 1970 so that u can easily compare start-time and end-time 
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
      <p class="text-muted mb-1">
        {{ prettyDate(booking.startDate) }}, {{ formatTime(booking.startTime) }} – {{ prettyDate(booking.endDate) }}, {{ formatTime(booking.endTime) }} · ${{ booking.totalPrice }}
      </p>
      <p class="small">Status: <span class="badge text-bg-warning">{{ booking.status }}</span></p>
      <p v-if="booking.tasks" class="small text-muted">{{ booking.tasks }} care task{{ booking.tasks === 1 ? '' : 's' }} included</p>
      <router-link to="/owner/bookings" class="btn btn-dark mt-2">View My Bookings</router-link>
    </div>
  </div>

  <!-- The form -->
  <div v-else-if="sitter" class="row g-3">
    <div class="col-12">
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

          <!-- Dates and times (the calendar picker) -->
          <div class="mb-3">
            <BookingDatePicker :availability="availability" :busy="busy" @change="when = $event" />
          </div>
          <!--
          @change doesnt mean "run whenever sth in the child component changes" ; instead it means : 
          -> run whenever BookingDatePicker emits an event named change.”

          how it works : 

          watch(....) exists within the bookingDatePicker 

          when one of those values within watch(..) changes, watch callback runs, calls emit('change', choice)

          parent page(this page) recieves the emitted event, @change="when = $event" runs : 
          
            1. sends the parents availability,busy varirable into bookingDatePicker(child page) 
            2. within bookingdatepicker, it builds the object called change, and returns it to the parent, which the parent recieves as the when object 
          -->

          <p v-if="chosenDays.length" class="small mb-4">
            {{ chosenDays.length }} day{{ chosenDays.length === 1 ? '' : 's' }} × ${{ rate }} = <strong>${{ totalPrice }}</strong>
          </p>

          <!-- Notes -->
          <h3 class="h6 text-uppercase text-muted fw-bold">Notes to Sitter</h3>
          <textarea v-model="notes" class="form-control" rows="4" placeholder="Feeding times, medication, walking routine…"></textarea>

          <!-- Care checklist -->
          <CareChecklistEditor :pets="selectedPetList" @change="tasks = $event" />
          <!-- 
          same concept as bookingDatePicker abv 
          -->
        </div>
      </div>
    </div>

    <!-- Price preview (full width, just above the Send button) -->
    <div class="col-12">
      <div class="card shadow-sm">
        <div class="card-body">
          <h3 class="h6 text-uppercase text-muted fw-bold mb-3">Price Preview</h3>
          <div class="d-flex justify-content-between small"><span>Daily rate</span><span>${{ rate }}</span></div>
          <div class="d-flex justify-content-between small"><span>Days</span><span>{{ chosenDays.length || '–' }}</span></div>
          <div v-if="when.startTime && when.endTime" class="d-flex justify-content-between small">
            <span>Time</span><span>{{ formatTime(when.startTime) }} – {{ formatTime(when.endTime) }}</span>
          </div>
          <hr />
          <div class="d-flex justify-content-between fw-bold"><span>Total</span><span>${{ totalPrice }}</span></div>
          <p class="small text-muted mt-2 mb-0">Charged per calendar day.</p>
          <div v-if="clash" class="alert alert-danger small py-2 mt-3 mb-0">
            The sitter is already booked during this time. Please choose different times.
          </div>
          <div v-if="unavailableDays.length" class="alert alert-warning small py-2 mt-3 mb-0">
            Not available on {{ unavailableDays.map(prettyDate).join(', ') }}
          </div>
        </div>
      </div>
    </div>

    <div class="col-12">
      <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
      <button class="btn btn-dark w-100 py-2 fw-semibold" :disabled="sending || clash" @click="sendRequest">
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
