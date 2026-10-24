<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import axios from 'axios'
import { Popover } from 'bootstrap'
import { useRoute } from 'vue-router'
import AvailabilityCalendar from '../components/AvailabilityCalendar.vue'
import { availabilityApi } from '../services/availabilityApi.js'
import { toDateString } from '../utils/bookingTimeHelpers.js'
import { ALL_DAY, shortTime, groupBookingsByDay, chipText, paintedSlots } from '../utils/availabilityHelpers.js'

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

// ----- Selected day: click a day on the calendar, then set its hours from here -----
const selected = ref(today)
const dayStart = ref(0) // minutes after midnight
const dayEnd = ref(24 * 60)

const selectedTitle = computed(() =>
  new Date(selected.value + 'T00:00:00').toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
)
// the bookings on the selected day, written the same way as inside the calendar squares
const selectedBookings = computed(() =>
  (groupBookingsByDay(bookings.value)[selected.value] || []).map((b) => chipText(b, selected.value))
)
const selectedStatus = computed(() => {
  const slots = changes.value[selected.value] ?? saved.value[selected.value] ?? null
  if (slots === null) return 'Not set yet'
  if (!slots.length) return 'Not available'
  const hours = slots.length / 2
  return `${hours} free hour${hours === 1 ? '' : 's'}`
})

function applyDay(on) {
  if (dayEnd.value <= dayStart.value) {
    message.value = { type: 'warning', text: 'The end time must be after the start time.' }
    return
  }
  const date = selected.value
  const current = changes.value[date] ?? saved.value[date] ?? null
  const list = paintedSlots(current, date, dayStart.value, dayEnd.value, on, groupBookingsByDay(bookings.value)[date] || [], today, nowMinutes)
  if (list) {
    setSlots(date, list)
    message.value = null
  } else {
    message.value = { type: 'warning', text: `Nothing to change: those hours are already ${on ? 'available' : 'unavailable'}, in the past, or booked.` }
  }
}

// ----- Days I'm free: set the same weekdays and hours for the next few weeks -----
const patDays = ref([1, 2, 3, 4, 5]) // weekdays 0 = Sunday ... 6 = Saturday
const patWeeks = ref(4)
const patStartMinutes = ref(0) // minutes after midnight
const patEndMinutes = ref(24 * 60)
const dayNames = [
  { n: 0, name: 'Sun' }, { n: 1, name: 'Mon' }, { n: 2, name: 'Tue' }, { n: 3, name: 'Wed' },
  { n: 4, name: 'Thu' }, { n: 5, name: 'Fri' }, { n: 6, name: 'Sat' }
] // starts on Sunday, like the calendar
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
    ? null // the yellow bar above already says there are unsaved days
    : { type: 'warning', text: `Nothing to change: those hours are already ${on ? 'available' : 'unavailable'}, in the past, or booked.` }
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

// The switch: off -> on goes to Google's permission screen, on -> off asks first
function toggleGoogle() {
  if (!google.value.connected) connectGoogle()
  else if (window.confirm('Turn off Google Calendar sync? New bookings will not be added. Bookings already in your Google Calendar stay there.')) disconnectGoogle()
}

// The small (i) button next to the switch shows a Bootstrap popover when hovered or focused.
// The button only exists once the Google status has loaded, so we wait for the ref to be filled.
const infoButton = ref(null)
let infoPopover = null
watch(infoButton, (el) => {
  if (infoPopover) infoPopover.dispose()
  infoPopover = el
    ? new Popover(el, {
        trigger: 'hover focus',
        placement: 'bottom',
        html: true,
        title: 'Google Calendar sync',
        content: '<p class="mb-2">Connect to see all your PetSociety bookings in your Google Calendar.</p><p class="mb-0 text-muted">Accepted bookings are added automatically and cancelled ones are removed. We can\'t see the rest of your calendar.</p>'
      })
    : null
})
onBeforeUnmount(() => {
  if (infoPopover) infoPopover.dispose()
})

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
  if (result === 'connected') message.value = { type: 'success', text: 'Google Calendar connected. Accepted bookings are added automatically.' }
  else if (result === 'denied') message.value = { type: 'danger', text: 'Google Calendar was not connected (you cancelled).' }
  else if (result === 'error') message.value = { type: 'danger', text: 'Could not connect Google Calendar. Please try again.' }
})
</script>

<template>
  <div class="cal-page">
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <h1 class="page-title mb-0">My Calendar</h1>

      <!-- Google Calendar sync switch (hidden if the server has no Google keys) -->
      <div v-if="google && google.configured" class="google-box d-flex align-items-center gap-2">
        <div class="form-check form-switch mb-0">
          <input
            id="google-switch"
            class="form-check-input"
            type="checkbox"
            role="switch"
            :checked="google.connected"
            @click.prevent="toggleGoogle"
          />
          <label class="form-check-label fw-semibold" for="google-switch">Sync to Google Calendar</label>
        </div>
        <button v-if="google.connected && google.needsReconnect" class="btn btn-outline-danger btn-sm" @click="connectGoogle">Reconnect</button>
        <button v-else-if="google.connected && google.unsynced" class="btn btn-outline-dark btn-sm" @click="retryGoogleSync">
          Retry sync ({{ google.unsynced }})
        </button>
        <button ref="infoButton" type="button" class="info-btn" aria-label="What does Google Calendar sync do?">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="11"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="message" :class="`notice alert alert-${message.type} alert-dismissible`" role="status">
      <span v-if="message.type === 'success'" class="notice-icon" aria-hidden="true">✓</span>
      {{ message.text }}
      <button type="button" class="btn-close" aria-label="Close" @click="message = null"></button>
    </div>

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

    <div class="row g-3">
      <div class="col-lg-8">
        <!-- The calendar itself is a child component; this page keeps the data and the unsaved changes -->
        <div class="card cal-card">
          <div class="card-body">
            <AvailabilityCalendar
              :saved="saved"
              :changes="changes"
              :bookings="bookings"
              :selected="selected"
              editable
              @paint="onPaint"
              @select="selected = $event"
            />
          </div>
        </div>
      </div>

      <div class="col-lg-4 d-flex flex-column gap-3">
        <!-- Selected day -->
        <div class="card cal-card">
          <div class="card-body">
            <h3 class="side-title">Selected day</h3>
            <p class="selected-title mb-1">{{ selectedTitle }}</p>
            <p class="small text-muted mb-1">{{ selectedStatus }}</p>
            <p v-for="line in selectedBookings" :key="line" class="small mb-1">Booked: {{ line }}</p>
            <div class="row g-2 my-2">
              <div class="col-6">
                <label class="form-label small mb-1" for="day-start">From</label>
                <select id="day-start" v-model="dayStart" class="form-select form-select-sm">
                  <option v-for="m in fromOptions" :key="m" :value="m">{{ shortTime(m) }}</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label small mb-1" for="day-end">Until</label>
                <select id="day-end" v-model="dayEnd" class="form-select form-select-sm">
                  <option v-for="m in toOptions" :key="m" :value="m">{{ shortTime(m) }}{{ m === 1440 ? ' (end of day)' : '' }}</option>
                </select>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-available flex-fill" @click="applyDay(true)">Set as free</button>
              <button class="btn btn-unavailable flex-fill" @click="applyDay(false)">Not free</button>
            </div>
          </div>
        </div>

        <!-- Repeat every week -->
        <div class="card cal-card">
          <div class="card-body">
            <h3 class="side-title">Repeat every week</h3>
            <p class="small text-muted">Tap the days, choose the hours and how many weeks, then set them.</p>
            <div class="free-days mb-3">
              <button
                v-for="d in dayNames"
                :key="d.n"
                type="button"
                class="free-day"
                :class="{ on: patDays.includes(d.n) }"
                :aria-pressed="patDays.includes(d.n)"
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
              <button class="btn btn-available flex-fill" @click="applyPattern(true)">Set as free</button>
              <button class="btn btn-unavailable flex-fill" @click="applyPattern(false)">Not free</button>
            </div>
            <p class="small text-muted mt-2 mb-0">Hours in the past and booked hours are never changed.</p>
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
/* ----- notice at the top: centred, soft, with a close x ----- */
.notice {
  text-align: center;
  font-weight: 600;
  padding: 0.7rem 3rem; /* same room on both sides, so the text stays centred next to the x */
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(43, 36, 32, 0.08);
}
.notice .btn-close { padding: 1rem; }
.notice-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 8px;
  border-radius: 50%;
  background: #198754;
  color: #fff;
  font-size: 0.75rem;
}
.selected-title { font-family: 'Fredoka', 'Nunito', sans-serif; font-size: 1.2rem; font-weight: 600; }

/* ----- Google Calendar switch ----- */
.google-box { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: 6px 10px 6px 12px; }
.google-box .form-check-input:checked { background-color: #c44f1c; border-color: #c44f1c; }
.info-btn { border: 0; background: none; color: var(--muted); padding: 2px; line-height: 0; border-radius: 50%; }
.info-btn:hover, .info-btn:focus-visible { color: var(--ink); }


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
