<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useRoute } from 'vue-router'
import { formatTime } from '../utils/bookingHelpers.js'

// Same setup as services/bookingApi.js: Vite forwards /api to the server, and
// withCredentials sends the login cookie.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true })

// Turns year, month (0-11) and day into 'YYYY-MM-DD', the format the server uses.
// hv to +1 for month cos jan in js is month 0, in real life is 1 
function toDateString(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const now = new Date() 
// new Date() automatically creates a JavaScript Date object containing the browser's current local date and time.
// no arguments = date object for today ; Date(year,month,day)-> date object for that day

const today = toDateString(now.getFullYear(), now.getMonth(), now.getDate())

const year = ref(now.getFullYear())
const month = ref(now.getMonth())
// getFullyr and getMonth are built in js methods for date objects 

const saved = ref({}) // what the server has: { '2026-10-20': 'available', ... } i.e the orignal database value 
const changes = ref({}) // clicked but not saved yet: { '2026-10-21': 'blocked', ... } i.e the temporary unsaved values 
const bookedDays = ref({}) // days taken by accepted / paid / in-progress bookings: { '2026-11-21': [booking, ...] }
const message = ref(null) // { type: 'success' | 'danger', text }
const saving = ref(false)

const monthName = computed(() =>
  new Date(year.value, month.value, 1).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' })
)
// todateString : converts month_number -> month_name 
// recalculates the month name automatically when it changes 

const changeCount = computed(() => Object.keys(changes.value).length)

// The month as a list of weeks. Each week has 7 slots; empty slots are null.
const weeks = computed(() => {
  const firstWeekday = new Date(year.value, month.value, 1).getDay() // .getDay() checks date, returns the specific day as a value e.g. 0 = Sunday, 1 = monday etc 
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()  // for the date object for the last day of the month, .getDate() returns how many days there are in that month

  const days = [] 
  for (let i = 0; i < firstWeekday; i++) days.push(null) 
  // makes it so the days before the first day fo the month are null ( i.e days that belonged to the previous month )
  for (let d = 1; d <= daysInMonth; d++) days.push({ day: d, date: toDateString(year.value, month.value, d) })
  // loops thru every day of the month, so days = [ { day: 1, date: "2026-10-01" },... ] 
  while (days.length % 7 !== 0) 
    days.push(null) // make sure each week has 7 days 
  const result = []
  for (let i = 0; i < days.length; i += 7) 
  result.push(days.slice(i, i + 7)) // breaks all the weeks into individual weeks 
// weeks = [ [1, 2, 3, 4, 5, 6, 7], [8, 9, 10, 11, 12, 13, 14], [15, 16, 17, 18, 19, 20, 21] ]
  return result
})

function statusOf(date) {
  if (isFullyBooked(date)) return 'booked' // no free time left that day
  if (bookedDays.value[date]) return 'partial' // some bookings, but part of the day is still free
  return changes.value[date] || saved.value[date] || 'unset'
}
// returns the status of that specific day by checking the bookedDays,changes,saved object 
//  if the bookings cover the whole day: 'booked' ; if there are bookings but free time is left: 'partial'
//  if in changes/saved, has the status given to it alr within those objects
// else if in none of these objects, has 'unset' status 

// Past days and booked days can't be changed.
function canChange(date) {
  return date >= today && !bookedDays.value[date]
}
// reutrns true if the date is ahead of today and its not in bookedDays 

// Clicking a day flips it between available and blocked (kept in `changes` until saved).
function toggleDay(date) {
  const next = statusOf(date) === 'available' ? 'blocked' : 'available' // flips the current value of the day
  if (saved.value[date] === next) 
  delete changes.value[date] // on second click, blocked->avail, same as original value, so delete obj from changes 
  else changes.value[date] = next // when u first click, avail->blocked, so saved.value != next, so this runs, and the date is added to changes  
  message.value = null
}

// ----- Bookings shown inside the day squares (like Google Calendar) -----
// '09:30' -> 570 (minutes after midnight)
function toMinutes(time) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}
// Short time for the squares: 540 -> '9a', 570 -> '9:30a', 720 -> '12p', 1440 -> '12a'
function shortTime(minutes) {
  const h24 = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${h24 % 12 || 12}${m ? ':' + String(m).padStart(2, '0') : ''}${h24 >= 12 ? 'p' : 'a'}`
}
// What one booking looks like inside one day's square, e.g. '9a–12p · Buddy'.
// The first day uses the start time, the last day the end time; days in between say 'All day'.
// The part of this day (in minutes after midnight) that one booking takes up: [from, to]
function dayPart(b, date) {
  const from = date === b.startDate && b.startTime ? toMinutes(b.startTime) : 0
  const to = date === b.endDate && b.endTime ? toMinutes(b.endTime) : 24 * 60
  return [from, to]
}
// True when the bookings on this day add up to the whole day (so nothing is left to book)
function isFullyBooked(date) {
  const parts = (bookedDays.value[date] || []).map((b) => dayPart(b, date)).sort((a, b) => a[0] - b[0])
  let coveredUpTo = 0 // everything before this minute is taken
  for (const [from, to] of parts) {
    if (from > coveredUpTo) return false // a gap: free time
    coveredUpTo = Math.max(coveredUpTo, to)
  }
  return coveredUpTo >= 24 * 60
}
function chipText(b, date) {
  const [from, to] = dayPart(b, date)
  const when = from === 0 && to === 24 * 60 ? 'All day' : `${shortTime(from)}–${shortTime(to)}`
  return `${when} · ${b.petNames.join(', ')}`
}

// The booked day the sitter has clicked, and the bookings on it
const selectedDate = ref(null)
const selectedBookings = computed(() => (selectedDate.value ? bookedDays.value[selectedDate.value] || [] : []))

// Clicking a booked day shows its bookings (click again to hide). Clicking any other day toggles it, as before.
function clickDay(date) {
  if (bookedDays.value[date]) {
    selectedDate.value = selectedDate.value === date ? null : date
    return
  }
  selectedDate.value = null
  if (canChange(date)) toggleDay(date)
}

// '2026-11-21' -> '21 Nov 2026' (or 'Sat, 21 Nov 2026' with the weekday)
function prettyDate(s, withWeekday = false) {
  return new Date(s + 'T00:00:00').toLocaleDateString('en-SG', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

function changeMonth(step) {
  selectedDate.value = null // the clicked day may not be on screen any more
  const d = new Date(year.value, month.value + step, 1)
  year.value = d.getFullYear()
  month.value = d.getMonth()
}

// Sends every unsaved change to the server in one request.
async function saveChanges() {
  const list = Object.entries(changes.value).map(([date, status]) => ({ date, status }))
  saving.value = true
  try {
    await api.put('/availability/me', { changes: list })
    list.forEach((c) => (saved.value[c.date] = c.status))
    changes.value = {} // clears all unsaved changes 
    message.value = { type: 'success', text: `Saved ${list.length} day${list.length === 1 ? '' : 's'}.` }
  } catch (err) {
    message.value = { type: 'danger', text: err.response?.data?.message || 'Could not save your changes.' }
  } finally {
    saving.value = false
  }
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
    const availability = await api.get('/availability/me')
    availability.data.forEach((a) => (saved.value[a.date] = a.status)) // gives data from backend to frontend

    // Mark every day covered by an accepted / paid / in-progress booking.
    const bookings = await api.get('/availability/me/bookings')
    bookings.data.forEach((b) => {
      const d = new Date(b.startDate + 'T00:00:00')
      const end = new Date(b.endDate + 'T00:00:00')
      while (d <= end) {
        const key = toDateString(d.getFullYear(), d.getMonth(), d.getDate())
        if (!bookedDays.value[key]) bookedDays.value[key] = [] // first booking on this day
        bookedDays.value[key].push(b) // a day can hold more than one booking
        d.setDate(d.getDate() + 1)
      }
    })
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
  <h1 class="h3 fw-bold mb-3">My Availability</h1>

  <div v-if="message" :class="`alert alert-${message.type} py-2`">{{ message.text }}</div>

  <div class="row g-3">
    <!-- Left: the month calendar -->
    <div class="col-lg-8">
      <div class="card shadow-sm">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <button class="btn btn-outline-secondary btn-sm" @click="changeMonth(-1)">‹</button>
            <h2 class="h5 fw-bold mb-0">{{ monthName }}</h2>
            <button class="btn btn-outline-secondary btn-sm" @click="changeMonth(1)">›</button>
          </div>

          <div class="calendar">
            <div v-for="name in ['S', 'M', 'T', 'W', 'T', 'F', 'S']" class="text-center small text-muted fw-semibold">
              {{ name }}
            </div>
            <template v-for="week in weeks">
              <template v-for="d in week">
                <div v-if="!d"></div>
                <button
                  v-else
                  class="day" 
                  :class="[statusOf(d.date), { 
                    past: d.date < today, 
                    today: d.date === today, 
                    selected: d.date === selectedDate,
                    unsaved: changes[d.date] }]"
                  :disabled="!canChange(d.date) && !bookedDays[d.date]"
                  @click="clickDay(d.date)"
                >
                  <span class="num">{{ d.day }}</span>
                  <!-- up to 2 bookings written inside the square, then "+N more" -->
                  <span v-for="b in (bookedDays[d.date] || []).slice(0, 2)" :key="b._id" class="chip">
                    <span class="chip-text">{{ chipText(b, d.date) }}</span>
                  </span>
                  <span v-if="(bookedDays[d.date] || []).length > 2" class="more">+{{ bookedDays[d.date].length - 2 }} more</span>
                </button>
              </template>
            </template>
          </div>
        </div>
      </div>

      <!-- Bookings on the clicked booked day -->
      <div v-if="selectedDate" class="card shadow-sm mt-3">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <h3 class="h6 text-uppercase text-muted fw-bold mb-0">Bookings on {{ prettyDate(selectedDate, true) }}</h3>
            <button type="button" class="btn-close" aria-label="Close" @click="selectedDate = null"></button>
          </div>
          <ul class="list-group list-group-flush">
            <li v-for="b in selectedBookings" :key="b._id" class="list-group-item px-0">
              <div class="d-flex justify-content-between flex-wrap gap-1">
                <span class="fw-semibold">{{ b.ownerName }} · {{ b.petNames.join(', ') }}</span>
                <span class="badge text-bg-light border">{{ b.status }}</span>
              </div>
              <div class="small text-muted">
                {{ prettyDate(b.startDate) }}<template v-if="b.startTime">, {{ formatTime(b.startTime) }}</template>
                – {{ prettyDate(b.endDate) }}<template v-if="b.endTime">, {{ formatTime(b.endTime) }}</template>
                · ${{ b.totalPrice }}
              </div>
              <div v-if="b.notes" class="small mt-1">Notes: "{{ b.notes }}"</div>
            </li>
          </ul>
          <router-link to="/sitter/requests" class="btn btn-outline-dark btn-sm mt-2">Open Booking Requests</router-link>
        </div>
      </div>
    </div>

    <!-- Right (below on small screens): legend, note and Save Changes -->
    <div class="col-lg-4">
      <div class="card shadow-sm mb-3">
        <div class="card-body">
          <h3 class="h6 text-uppercase text-muted fw-bold mb-3">Legend</h3>
          <div class="d-flex flex-wrap flex-lg-column gap-2 small">
            <span><span class="swatch available"></span> Available</span>
            <span><span class="swatch blocked"></span> Unavailable</span>
            <span><span class="swatch partial"></span> Partly booked</span>
            <span><span class="swatch booked"></span> Fully booked</span>
            <span><span class="swatch unset"></span> Not set</span>
          </div>
          <p class="small text-muted mt-3 mb-0">
            Click a date to toggle Available / Unavailable. Booked times are added automatically once you accept a request; click a day with bookings to see them.
          </p>
        </div>
      </div>

      <button class="btn btn-dark w-100 py-2 fw-semibold" :disabled="changeCount === 0 || saving" @click="saveChanges">
        {{ saving ? 'Saving…' : changeCount ? `Save Changes` : 'Save Changes' }}
        <!-- removed changeCount cos it looks bad  -->
      </button>

      <!-- Google Calendar (hidden if the server has no Google keys) -->
      <div v-if="google && google.configured" class="card shadow-sm mt-3">
        <div class="card-body">
          <h3 class="h6 text-uppercase text-muted fw-bold mb-2">Google Calendar</h3>

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
</template>

<style scoped>
.calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.day {
  min-height: 4.6rem; /* room for the bookings written inside the square */
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  text-align: left;
  padding: 3px 4px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  position: relative;
}
.num { font-weight: 600; font-size: 0.85rem; }
.chip { /* one booking inside a day square */
  display: block;
  margin-top: 2px;
  padding: 0 3px;
  border-radius: 3px;
  background: #a9c4ea;
  color: #1c3a66;
  font-size: 0.62rem;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.more { margin-top: 1px; font-size: 0.6rem; color: #5b6b85; }
@media (max-width: 575.98px) { /* phones: squares are too small for text, so show small bars */
  .day { min-height: 3.2rem; padding: 2px; }
  .chip { height: 6px; padding: 0; }
  .chip-text, .more { display: none; }
}
.day:disabled { color: #1f1f1f; } /* keep booked days readable */
.day.past { opacity: 0.4; }
.day.today { outline: 2px solid #2b2420; }
.day.selected { outline: 2px solid #c47756; }
.booked, .partial { cursor: pointer; }
.day.unsaved::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c47756;
}
.available { background: #e3f4e8; }
.blocked { background: #e6e6e6; }
.partial { background: #fff3c4; } /* yellow: some bookings, free time left */
.booked { background: #dbe6f5; }
.unset { background: #fff; }
.swatch {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 1px solid #ccc;
  border-radius: 3px;
  vertical-align: -1px;
}
</style>




