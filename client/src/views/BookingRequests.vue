<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bookingsApi } from '../services/bookingApi.js'
import BookingTable from '../components/BookingTable.vue'
import BookingTabs from '../components/BookingTabs.vue'

// /sitter/requests: every booking made with this sitter, sorted into Pending / Upcoming / Past tabs
// (same tabs as the owner's My Bookings)
const TABS = [
  { key: 'pending', label: 'Pending', statuses: ['pending'] },
  { key: 'upcoming', label: 'Upcoming', statuses: ['accepted', 'paid', 'in-progress'] },
  { key: 'past', label: 'Past', statuses: ['completed', 'declined', 'cancelled'] }
]

const route = useRoute()
const router = useRouter()

const bookings = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const actionError = ref('') // why accepting / declining a request failed (the lists stay visible)
const busyId = ref(null)
const activeTab = ref(TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'pending')

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

function bookingsFor(tabKey) {
  const tab = TABS.find((t) => t.key === tabKey)
  const list = bookings.value.filter((b) => tab.statuses.includes(b.status))
  return tabKey === 'past' ? [...list].reverse() : list
}

const visibleBookings = computed(() => bookingsFor(activeTab.value))

// the tab list with each tab's count, handed to BookingTabs
const tabsWithCounts = computed(() => TABS.map((t) => ({ key: t.key, label: t.label, count: bookingsFor(t.key).length })))

function selectTab(key) {
  activeTab.value = key
  router.replace({ query: { tab: key } })
}

async function loadRequests() {
  loading.value = true
  error.value = ''
  try {
    bookings.value = await bookingsApi.getMine()
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
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not update the booking.'
  } finally {
    busyId.value = null
  }
}

// A sitter can cancel a booking they already accepted (shown under Upcoming)
async function cancelBooking(id) {
  if (!window.confirm('Cancel this booking? The owner will see it as cancelled and can book another sitter. This cannot be undone.')) return
  busyId.value = id
  error.value = ''
  actionError.value = ''
  message.value = ''
  try {
    const updated = await bookingsApi.cancel(id)
    bookings.value.find((b) => b._id === id).status = updated.status
    message.value = 'Booking cancelled. The hours are free on your calendar again.'
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not cancel the booking.'
  } finally {
    busyId.value = null
  }
}

onMounted(loadRequests)
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
    <BookingTabs :tabs="tabsWithCounts" :active-tab="activeTab" @select="selectTab" />

    <p v-if="!visibleBookings.length" class="text-center text-muted py-5">
      {{ activeTab === 'pending' ? 'No new requests right now 🐾' : 'Nothing here yet.' }}
    </p>
    <BookingTable
      v-else
      :bookings="visibleBookings"
      viewer="sitter"
      :busy-id="busyId"
      @accept="respond($event, 'accepted')"
      @decline="respond($event, 'declined')"
      @cancel="cancelBooking"
    />
  </template>
</template>