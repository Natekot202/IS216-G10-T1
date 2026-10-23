<script setup>
import { computed, onMounted, ref } from 'vue'
import { bookingsApi } from '../services/bookingApi.js'
import BookingTable from '../components/BookingTable.vue'
import AvailabilityCalendar from '../components/AvailabilityCalendar.vue'
import { availabilityApi } from '../services/availabilityApi.js'
import { formatDateRange } from '../utils/bookingHelpers.js'
import { groupBookingsByDay, requestFit, isoToSgtDay } from '../utils/availabilityHelpers.js'

const bookings = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const actionError = ref('') // why accepting / declining a request failed (the lists stay visible)
const busyId = ref(null)

// Small popup about Google Calendar after accepting a request: { type: 'success' | 'warning', text }
const toast = ref(null)
let toastTimer = null
function showToast(googleSync) {
  if (!googleSync) return
  if (googleSync.synced) {
    toast.value = { type: 'success', text: '📅 Added to your Google Calendar' }
  } else if (googleSync.reason === 'needs-reconnect' || googleSync.reason === 'error') {
    toast.value = { type: 'warning', text: "Couldn't add this to your Google Calendar. Reconnect on My Calendar." }
  } else {
    return // not connected: say nothing
  }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = null), 4000) // hide after 4 seconds
}

const newRequests = computed(() => bookings.value.filter((b) => b.status === 'pending'))
const responded = computed(() => bookings.value.filter((b) => b.status !== 'pending'))

// ----- The sitter's calendar, shown (look only) above the requests so a request can be checked against it -----
const saved = ref({}) // the sitter's free half-hours: { '2026-10-20': [540, 570, ...] }
const calendarBookings = ref([]) // bookings already accepted / paid / in-progress
const checkId = ref('') // the request picked to look at on the calendar
const checked = computed(() => newRequests.value.find((b) => b._id === checkId.value) || null)

// the picked request in the form the calendar understands: days as 'YYYY-MM-DD' plus the times
const checkedRange = computed(() =>
  checked.value
    ? {
        startDate: isoToSgtDay(checked.value.startDate),
        startTime: checked.value.startTime,
        endDate: isoToSgtDay(checked.value.endDate),
        endTime: checked.value.endTime
      }
    : null
)
// does it fit? 'ok' | 'not-free' (hours not marked available) | 'clash' (overlaps an accepted booking)
const fit = computed(() =>
  checkedRange.value ? requestFit(checkedRange.value, saved.value, groupBookingsByDay(calendarBookings.value)) : null
)

async function loadCalendar() {
  try {
    const days = await availabilityApi.getMine()
    saved.value = Object.fromEntries(days.map((d) => [d.date, d.slots]))
    calendarBookings.value = await availabilityApi.getMyBookings()
  } catch {
    // the calendar is only a help: the requests below still work without it
  }
}

async function loadRequests() {
  loading.value = true
  error.value = ''
  try {
    bookings.value = await bookingsApi.getMine('pending,accepted,declined')
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load booking requests.'
  } finally {
    loading.value = false
  }
}

async function respond(id, status) {
  busyId.value = id
  error.value = ''
  actionError.value = ''
  message.value = ''
  try {
    const updated = await bookingsApi.updateStatus(id, status)
    const booking = bookings.value.find((b) => b._id === id)
    booking.status = updated.status
    message.value = status === 'accepted' ? 'Request accepted ✅ The owner can now pay.' : 'Request declined.'
    if (status === 'accepted') showToast(updated.googleSync)
    checkId.value = '' // that request is no longer a new one
    loadCalendar() // an accepted request is now on the calendar
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not update the booking.'
  } finally {
    busyId.value = null
  }
}

onMounted(() => {
  loadRequests()
  loadCalendar()
})
</script>

<template>
  <h2 class="mb-4">Booking Requests</h2>

  <div v-if="error" class="alert alert-warning">{{ error }}</div>
  <div v-if="message" class="alert alert-success">{{ message }}</div>
  <div v-if="actionError" class="alert alert-warning">{{ actionError }}</div>

  <div v-if="toast" class="toast-container position-fixed bottom-0 end-0 p-3">
    <div class="toast show align-items-center border-0" :class="`text-bg-${toast.type}`" role="status">
      <div class="d-flex">
        <div class="toast-body">{{ toast.text }}</div>
        <button type="button" class="btn-close me-2 m-auto" :class="{ 'btn-close-white': toast.type === 'success' }" aria-label="Close" @click="toast = null"></button>
      </div>
    </div>
  </div>

  <div v-if="loading" class="text-muted">Loading requests…</div>

   <template v-else-if="!error">
    <!-- The calendar (look only): pick a request to see where it lands -->
    <div class="card mb-4">
      <div class="card-body">
        <div class="row g-2 align-items-end mb-3">
          <div class="col-md-6">
            <label class="form-label small mb-1" for="check-request">Check a request against your calendar</label>
            <select id="check-request" v-model="checkId" class="form-select form-select-sm">
              <option value="">Choose a request…</option>
              <option v-for="b in newRequests" :key="b._id" :value="b._id">
                {{ b.ownerId?.username || 'Owner' }} · {{ formatDateRange(b.startDate, b.endDate, b.startTime, b.endTime) }}
              </option>
            </select>
          </div>
          <div class="col-md-6">
            <p v-if="fit === 'ok'" class="small text-success mb-0">✅ This fits your calendar: all of these hours are available.</p>
            <p v-else-if="fit === 'not-free'" class="small text-danger mb-0">Some of these hours are not marked as available on your calendar.</p>
            <p v-else-if="fit === 'clash'" class="small text-danger mb-0">This overlaps a booking you already accepted.</p>
            <p v-else class="small text-muted mb-0">The request you pick is outlined in orange on the calendar.</p>
          </div>
        </div>
        <AvailabilityCalendar
          :saved="saved"
          :bookings="calendarBookings"
          :highlight="checkedRange"
          :focus-date="checkedRange ? checkedRange.startDate : ''"
        />
      </div>
    </div>

    <h5 class="mb-3">New requests ({{ newRequests.length }})</h5>
    <p v-if="!newRequests.length" class="text-muted mb-5">No new requests right now 🐾</p>
    <BookingTable
      v-else
      class="mb-5"
      :bookings="newRequests"
      viewer="sitter"
      :busy-id="busyId"
      @accept="respond($event, 'accepted')"
      @decline="respond($event, 'declined')"
    />

    <h5 class="mb-3">Responded ({{ responded.length }})</h5>
    <p v-if="!responded.length" class="text-muted">Nothing here yet.</p>
    <BookingTable v-else :bookings="responded" viewer="sitter" />
  </template>
</template>