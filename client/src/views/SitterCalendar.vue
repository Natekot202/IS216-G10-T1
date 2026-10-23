<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import AvailabilityCalendar from '../components/AvailabilityCalendar.vue'
import { availabilityApi } from '../services/availabilityApi.js'
import { toDateString } from '../utils/bookingTimeHelpers.js'
import { ALL_DAY, shortTime, groupBookingsByDay, paintedSlots } from '../utils/availabilityHelpers.js'

// Same setup as services/bookingApi.js: Vite forwards /api to the server, and
// withCredentials sends the login cookie. (Only the Google Calendar calls use it here.)
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true })

const now = new Date()
const today = toDateString(now)
const nowMinutes = now.getHours() * 60 + now.getMinutes() // minutes after midnight right now

// A day's free time is a list of half-hour starts in minutes after midnight: 540 = 9:00, 570 = 9:30 ... 1410 = 23:30
// so if e.g. the person isnt free from 9am ( 540 mins aft 12am) - 930am (570 mins after 12am),then we assume that 
// 1) he starts at 9am 
// 2) he ends just before 930 (so doesnt include 930 itself i.e end time is excluded)
//  -> a whole day has all 48 slots in saved ; saved = {'date':[0,30,60,....1410]}
//  -> a day with some bookings ; saved = {'date':[540,570,...990]}

const saved = ref({}) // what the server has: { '2026-10-20': [540, 570, ...] } i.e the orignal database value ( [] = unavailable )
const changes = ref({}) // clicked but not saved yet: { '2026-10-21': [] , ... } i.e the temporary unsaved values
const bookings = ref([]) // accepted / paid / in-progress bookings
const message = ref(null) // { type: 'success' | 'danger', text }
const saving = ref(false)

const changeCount = computed(() => Object.keys(changes.value).length)

// Saves a new list of free half-hours for a day in `changes` (kept until Save).
// If it matches what the server already has, the day is not a change any more.
function setSlots(date, slots) {
  const same = saved.value[date] && JSON.stringify(slots) === JSON.stringify(saved.value[date])
  if (same) delete changes.value[date]
  else changes.value[date] = slots
  message.value = null
}

// The calendar tells us when the sitter drags over a day or some half-hours
function onPaint(date, slots) {
  setSlots(date, slots)
}

// Sends every unsaved change to the server in one request.
async function saveChanges() {
  const list = Object.entries(changes.value).map(([date, slots]) => ({ date, slots }))
  saving.value = true
  try {
    await availabilityApi.save(list)
    list.forEach((c) => (saved.value[c.date] = c.slots))
    changes.value = {} // clears all unsaved changes
    message.value = { type: 'success', text: `Saved ${list.length} day${list.length === 1 ? '' : 's'}.` }
  } catch (err) {
    message.value = { type: 'danger', text: err.response?.data?.message || 'Could not save your changes.' }
  } finally {
    saving.value = false
  }
}
function undoChanges() {
  changes.value = {}
  message.value = null
}

// ----- Days I'm free: set the same weekdays and hours for the next few weeks -----
const patDays = ref([1, 2, 3, 4, 5]) // weekdays 0 = Sunday ... 6 = Saturday
const patWeeks = ref(4)
const patStartMinutes = ref(0) // minutes after midnight
const patEndMinutes = ref(24 * 60)
const dayNames = [
  { n: 1, name: 'Mon' }, { n: 2, name: 'Tue' }, { n: 3, name: 'Wed' }, { n: 4, name: 'Thu' },
  { n: 5, name: 'Fri' }, { n: 6, name: 'Sat' }, { n: 0, name: 'Sun' }
]
const fromOptions = ALL_DAY // every half-hour 12:00 am ... 11:30 pm
const toOptions = [...ALL_DAY.slice(1), 24 * 60] // every half-hour 12:30 am ... 12:00 am (end of the day)

function togglePatDay(n) {
  if (patDays.value.includes(n)) patDays.value = patDays.value.filter((d) => d !== n)
  else patDays.value.push(n)
}

function applyPattern(on) {
  if (!patDays.value.length) {
    message.value = { type: 'warning', text: 'Pick at least one day first.' }
    return
  }
  if (patEndMinutes.value <= patStartMinutes.value) {
    message.value = { type: 'warning', text: 'The end time must be after the start time.' }
    return
  }
  const bookedDays = groupBookingsByDay(bookings.value)
  let changed = 0
  for (let i = 0; i < patWeeks.value * 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    if (!patDays.value.includes(d.getDay())) continue
    const date = toDateString(d)
    const current = changes.value[date] ?? saved.value[date] ?? null
    const list = paintedSlots(current, date, patStartMinutes.value, patEndMinutes.value, on, bookedDays[date] || [], today, nowMinutes)
    if (list) {
      setSlots(date, list)
      changed++
    }
  }
  message.value = changed
    ? { type: 'info', text: `${changed} day${changed === 1 ? '' : 's'} set as ${on ? 'available' : 'unavailable'}. Days with a dot are not saved yet: check them, then press Save changes.` }
    : { type: 'info', text: `Nothing to change: those hours are already ${on ? 'available' : 'unavailable'}, in the past, or booked.` }
}

// ----- Google Calendar -----
const route = useRoute()
const google = ref(null) // from the server: { configured, connected, needsReconnect, unsynced }

async function loadGoogle() {
  try {
    google.value = (await api.get('/google/status')).data
  } catch {
    google.value = null // the Google card stays hidden if this can't load
  }
}

// Connecting leaves our site for Google's permission screen, so it is a normal page jump, not an axios call.
function connectGoogle() {
  window.location.href = `${api.defaults.baseURL}/google/connect`
}

async function disconnectGoogle() {
  await api.delete('/google/disconnect')
  await loadGoogle()
  message.value = { type: 'success', text: 'Disconnected from Google Calendar.' }
}

// Adds any accepted booking that isn't in Google Calendar yet
async function retryGoogleSync() {
  try {
    const { synced, failed } = (await api.post('/google/sync-now')).data
    message.value = failed
      ? { type: 'danger', text: `${failed} booking${failed === 1 ? '' : 's'} could not be added to Google Calendar.` }
      : { type: 'success', text: `Added ${synced} booking${synced === 1 ? '' : 's'} to your Google Calendar.` }
  } catch (err) {
    message.value = { type: 'danger', text: err.response?.data?.message || 'Could not sync with Google Calendar.' }
  }
  await loadGoogle()
}

onMounted(async () => {
  try {
    const days = await availabilityApi.getMine()
    days.forEach((a) => (saved.value[a.date] = a.slots)) // gives data from backend to frontend
    bookings.value = await availabilityApi.getMyBookings()
  } catch (err) {
    message.value = { type: 'danger', text: err.response?.data?.message || 'Could not load your calendar.' }
  }

  await loadGoogle()
  // Google sends the sitter back here with ?google=connected / denied / error
  const result = route.query.google
  if (result === 'connected') message.value = { type: 'success', text: 'Google Calendar connected ✅ Accepted bookings are added automatically.' }
  else if (result === 'denied') message.value = { type: 'danger', text: 'Google Calendar was not connected (you cancelled).' }
  else if (result === 'error') message.value = { type: 'danger', text: 'Could not connect Google Calendar. Please try again.' }
})
</script>

<template>
  <div class="cal-page">
    <h1 class="page-title mb-3">My Availability</h1>

    <div v-if="message" :class="`alert alert-${message.type} py-2`">{{ message.text }}</div>

    <!-- Unsaved changes -->
    <div v-if="changeCount" class="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
      <span>{{ changeCount }} unsaved day{{ changeCount === 1 ? '' : 's' }}. Leaving this page will discard them.</span>
      <span class="d-flex gap-2">
        <button class="btn btn-outline-secondary btn-sm" :disabled="saving" @click="undoChanges">Undo</button>
        <button class="btn btn-accent btn-sm fw-semibold" :disabled="saving" @click="saveChanges">
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </span>
    </div>

    <!-- The calendar itself is a child component; this page keeps the data and the unsaved changes -->
    <div class="card cal-card mb-3">
      <div class="card-body">
        <AvailabilityCalendar
          :saved="saved"
          :changes="changes"
          :bookings="bookings"
          editable
          @paint="onPaint"
        />
      </div>
    </div>

    <div class="row g-3">
      <!-- Days I'm free -->
      <div class="col-md-6">
        <div class="card cal-card h-100">
          <div class="card-body">
            <h3 class="side-title">Days I'm free</h3>
            <p class="small text-muted">Tap the days, choose the hours and how many weeks, then mark them.</p>
            <div class="free-days mb-3">
              <button
                v-for="d in dayNames"
                :key="d.n"
                type="button"
                class="free-day"
                :class="{ on: patDays.includes(d.n) }"
                @click="togglePatDay(d.n)"
              >
                {{ d.name }}
              </button>
            </div>
            <div class="row g-2 mb-2">
              <div class="col-6">
                <label class="form-label small mb-1" for="pat-start">From</label>
                <select id="pat-start" v-model="patStartMinutes" class="form-select form-select-sm">
                  <option v-for="m in fromOptions" :key="m" :value="m">{{ shortTime(m) }}</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label small mb-1" for="pat-end">Until</label>
                <select id="pat-end" v-model="patEndMinutes" class="form-select form-select-sm">
                  <option v-for="m in toOptions" :key="m" :value="m">{{ shortTime(m) }}{{ m === 1440 ? ' (end of day)' : '' }}</option>
                </select>
              </div>
            </div>
            <label class="form-label small mb-1" for="pat-weeks">For the next</label>
            <select id="pat-weeks" v-model="patWeeks" class="form-select form-select-sm mb-3">
              <option v-for="w in 12" :key="w" :value="w">{{ w }} week{{ w === 1 ? '' : 's' }}</option>
            </select>
            <div class="d-flex gap-2">
              <button class="btn btn-available flex-fill" @click="applyPattern(true)">Mark available</button>
              <button class="btn btn-unavailable flex-fill" @click="applyPattern(false)">Mark unavailable</button>
            </div>
            <p class="small text-muted mt-2 mb-0">Hours in the past and booked hours are never changed.</p>
          </div>
        </div>
      </div>

      <!-- Google Calendar (hidden if the server has no Google keys) -->
      <div v-if="google && google.configured" class="col-md-6">
        <div class="card cal-card h-100">
          <div class="card-body">
            <h3 class="side-title">Google Calendar</h3>

            <template v-if="!google.connected">
              <p class="small text-muted">Connect your Google Calendar and accepted bookings are added to it automatically.</p>
              <button class="btn btn-outline-dark btn-sm w-100" @click="connectGoogle">Connect Google Calendar</button>
            </template>

            <template v-else-if="google.needsReconnect">
              <p class="small text-danger">Google stopped the connection. Reconnect to keep syncing.</p>
              <button class="btn btn-outline-dark btn-sm w-100" @click="connectGoogle">Reconnect Google Calendar</button>
            </template>

            <template v-else>
              <p class="small mb-2">✅ Connected. Accepted bookings are added automatically.</p>
              <p v-if="google.unsynced" class="small text-muted mb-2">
                {{ google.unsynced }} upcoming booking{{ google.unsynced === 1 ? ' is' : 's are' }} not in your Google Calendar yet.
              </p>
              <div class="d-flex gap-2">
                <button v-if="google.unsynced" class="btn btn-outline-dark btn-sm flex-fill" @click="retryGoogleSync">Retry sync</button>
                <button class="btn btn-outline-secondary btn-sm flex-fill" @click="disconnectGoogle">Disconnect</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Colours for this page (the PetSociety brown, orange and cream, with calm green and blue for the days) */
.cal-page {
  --ink: #2b2420;
  --muted: #766a60;
  --line: #e4dbd0;
  --accent: #c47756;
  --open: #e3e9dc;
  --open-line: #8aa07c;
  --blocked: #e6dfd6;
  font-family: 'Nunito', system-ui, sans-serif;
  color: var(--ink);
}
.page-title, .side-title { font-family: 'Fredoka', 'Nunito', sans-serif; }
.page-title { font-size: 1.9rem; font-weight: 600; letter-spacing: -0.01em; }
.side-title { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 0.75rem; font-weight: 600; }
.cal-card { border: 1px solid var(--line); border-radius: 8px; box-shadow: none; }

.btn-accent { background: var(--accent); border-color: var(--accent); color: #fff; }
.btn-accent:hover { background: #b06647; border-color: #b06647; color: #fff; }
.btn-available { border: 1.5px solid var(--open-line); background: var(--open); color: var(--ink); }
.btn-unavailable { border: 1.5px solid #a89d90; background: #fff; color: var(--ink); }
.btn-available:hover, .btn-unavailable:hover { filter: brightness(0.96); }

/* ----- Days I'm free ----- */
.free-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
.free-day {
  border: 0;
  border-bottom: 4px solid transparent;
  background: var(--blocked);
  color: var(--muted);
  border-radius: 2px;
  padding: 8px 0 5px;
  font-weight: 700;
  font-size: 0.75rem;
}
.free-day.on { background: var(--open); color: var(--ink); border-bottom-color: var(--open-line); }

@media (prefers-reduced-motion: no-preference) {
  .cal-card { animation: rise 0.45s ease both; }
  @keyframes rise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
}
</style>
