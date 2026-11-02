<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { currentUser } from '../services/auth.js'
import { sendNotification } from '../utils/sendNotification.js'
import { bookingsApi } from '../services/bookingApi.js'
import BookingTable from '../components/BookingTable.vue'
import BookingTabs from '../components/BookingTabs.vue'
import CancelBookingModal from '../components/CancelBookingModal.vue'
import MessageBar from '../components/MessageBar.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import { confirmDialog } from '../utils/useConfirm.js'

// /sitter/requests: every booking made with this sitter, sorted into
// To accept / Awaiting confirmation / Upcoming / Awaiting payment / Past tabs (like the tabs on the owner's My Bookings)
const TABS = [
  { key: 'pending', label: 'To accept', statuses: ['pending'] }, // new requests the sitter hasn't answered
  { key: 'awaiting-confirmation', label: 'Awaiting confirmation', statuses: ['accepted'] }, // accepted, waiting for the owner to confirm
  { key: 'upcoming', label: 'Upcoming', statuses: ['confirmed', 'in-progress'] },
  { key: 'awaiting-payment', label: 'Awaiting payment', statuses: ['completed'] }, // done, the owner hasn't paid yet
  { key: 'past', label: 'Past', statuses: ['paid', 'declined', 'cancelled', 'expired'] }
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
  sortBy.value = '' 
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
  const booking = bookings.value.find((b) => b._id === id)
  // declining a request you already accepted: check first
  const ok = await confirmDialog(
    status === 'accepted'
      ? {
          title: 'Accept this request?',
          message: 'The hours will be held for the owner while they confirm. You can still decline later if you need to.',
          confirmText: 'Accept'
        }
      : {
          title: 'Decline this request?',
          message: booking.status === 'accepted'
            ? 'You accepted it, but the owner has not confirmed yet. This cannot be undone.'
            : 'The owner will be told you declined. This cannot be undone.',
          confirmText: 'Decline',
          danger: true
        }
  )
  if (!ok) {
    return
  }
  busyId.value = id
  error.value = ''
  actionError.value = ''
  message.value = ''
  try {
    const updated = await bookingsApi.updateStatus(id, status)
    booking.status = updated.status
    sendNotification(
      id,
      status === 'accepted' ? 'booking-accepted' : 'booking-declined',
      status === 'accepted'
        ? `${currentUser.value.username} accepted your booking request. Confirm it to lock it in.`
        : `${currentUser.value.username} declined your booking request.`
    )
    message.value = status === 'accepted'
      ? 'Request accepted ✅ The hours are held for you while the owner confirms. It goes into your Google Calendar once confirmed.'
      : 'Request declined.'
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not update the booking.'
  } finally {
    busyId.value = null
  }
}

// A sitter can cancel a booking the owner has confirmed (shown under Upcoming).
// It asks for a reason first, in a small window (CancelBookingModal).
const cancellingId = ref(null) // the booking the reason window is open for (null = closed)
const cancelError = ref('') // why cancelling failed, shown inside the window
function cancelBooking(id) {
  cancelError.value = ''
  cancellingId.value = id
}
// runs when the window sends the reason
async function sendCancel(reason) {
  const id = cancellingId.value
  busyId.value = id
  error.value = ''
  actionError.value = ''
  message.value = ''
  cancelError.value = ''
  try {
    const updated = await bookingsApi.cancel(id, reason)
    const booking = bookings.value.find((b) => b._id === id)
    booking.status = updated.status
    booking.cancelledBy = updated.cancelledBy
    booking.cancelReason = updated.cancelReason
    sendNotification(id, 'booking-cancelled', `${currentUser.value.username} cancelled your booking. Reason: ${reason}. You can book another sitter.`)
    cancellingId.value = null
    message.value = 'Booking cancelled. The hours are free on your calendar again.'
  } catch (err) {
    cancelError.value = err.response?.data?.message || 'Could not cancel the booking.'
  } finally {
    busyId.value = null
  }
}

// sorting based on price
const sortBy = ref('')   
const sortedBookings = computed(() => {
  const list = [...visibleBookings.value]
  const start = (b) => new Date(b.startDate).getTime()
  const startTime = (b) => b.startTime || '00:00'
  if (sortBy.value === 'dateSoonest') {
    return list.sort((a, b) => start(a) - start(b) || startTime(a).localeCompare(startTime(b)))
  }
  if (sortBy.value === 'dateLatest') {
    return list.sort((a, b) => start(b) - start(a) || startTime(b).localeCompare(startTime(a)))
  }
  if (sortBy.value === 'priceHigh') {
    return list.sort((a, b) => Number(b.totalPrice) - Number(a.totalPrice))
  }
  if (sortBy.value === 'priceLow') {
    return list.sort((a, b) => Number(a.totalPrice) - Number(b.totalPrice))
  }
  return list
})

onMounted(loadRequests)
</script>

<template>
  <div class="br">
    <h2 class="mb-4">Booking Requests</h2>

    <MessageBar v-if="error" type="error" @close="error = ''">{{ error }}</MessageBar>
    <MessageBar v-if="message" @close="message = ''">{{ message }}</MessageBar>
    <MessageBar v-if="actionError" type="error" @close="actionError = ''">{{ actionError }}</MessageBar>

    <div v-if="loading" class="text-muted">Loading requests…</div>

    <template v-else-if="!error">
      <BookingTabs :tabs="tabsWithCounts" :active-tab="activeTab" @select="selectTab" />

      <div v-if="visibleBookings.length > 1" class="d-flex justify-content-end align-items-center gap-2 mb-2">
        <button v-if="sortBy" type="button" class="btn btn-sm p-0" style="color:#bd5679;" @click="sortBy = ''">Clear sort</button>
        <label for="reqSort" class="visually-hidden">Sort requests</label>
        <select id="reqSort" v-model="sortBy" class="form-select form-select-sm w-auto">
          <option value="" disabled>Sort by…</option>
          <optgroup label="Date">
            <option value="dateSoonest">Earliest first</option>
            <option value="dateLatest">Latest first</option>
          </optgroup>
          <optgroup label="Price">
            <option value="priceHigh">High to low</option>
            <option value="priceLow">Low to high</option>
          </optgroup>
        </select>
      </div>

      <p v-if="!visibleBookings.length" class="text-center text-muted py-5">
        {{ activeTab === 'pending' ? 'No new requests right now 🐾' : 'Nothing here yet.' }}
      </p>
      <BookingTable
        v-else
        :bookings="sortedBookings"
        viewer="sitter"
        :busy-id="busyId"
        @accept="respond($event, 'accepted')"
        @decline="respond($event, 'declined')"
        @cancel="cancelBooking"
      />
    </template>

    <!-- asks for the reason before cancelling -->
    <CancelBookingModal
      v-if="cancellingId"
      text="The owner will see it as cancelled, along with your reason, and can book another sitter. This cannot be undone."
      :busy="busyId === cancellingId"
      :error="cancelError"
      @confirm="sendCancel"
      @close="cancellingId = null"
    />
  </div>
</template>