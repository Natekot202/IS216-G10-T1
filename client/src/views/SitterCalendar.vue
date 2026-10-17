<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

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
const bookedDays = ref({}) // days taken by accepted / paid / in-progress bookings
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
  if (bookedDays.value[date]) return 'booked'
  return changes.value[date] || saved.value[date] || 'unset'
}
// returns the status of that specific day by checking the bookedDays,changes,saved object 
//  if in bookedDays, has booked status ; if in changes/saved, has the status given to it alr within those objects
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

function changeMonth(step) {
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
        bookedDays.value[toDateString(d.getFullYear(), d.getMonth(), d.getDate())] = b
        d.setDate(d.getDate() + 1)
      }
    })
  } catch (err) {
    message.value = { type: 'danger', text: err.response?.data?.message || 'Could not load your calendar.' }
  }
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
                    unsaved: changes[d.date] }]"
                  :disabled="!canChange(d.date)"
                  @click="toggleDay(d.date)"
                >
                  {{ d.day }}
                </button>
              </template>
            </template>
          </div>
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
            <span><span class="swatch booked"></span> Booked</span>
            <span><span class="swatch unset"></span> Not set</span>
          </div>
          <p class="small text-muted mt-3 mb-0">
            Click a date to toggle Available / Unavailable. Booked dates are set automatically once you accept a request.
          </p>
        </div>
      </div>

      <button class="btn btn-dark w-100 py-2 fw-semibold" :disabled="changeCount === 0 || saving" @click="saveChanges">
        {{ saving ? 'Saving…' : changeCount ? `Save Changes` : 'Save Changes' }}
        <!-- removed changeCount cos it looks bad  -->
      </button>
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
  aspect-ratio: 1;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  position: relative;
}
.day:disabled { color: #1f1f1f; } /* keep booked days readable */
.day.past { opacity: 0.4; }
.day.today { outline: 2px solid #2b2420; }
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
.booked { background: #dbe6f5; font-weight: bold; }
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




