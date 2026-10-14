<script setup>
import { computed, onMounted, ref } from 'vue'
import { bookingsApi } from '../services/bookingApi.js'
import BookingTable from '../components/BookingTable.vue'

const bookings = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const busyId = ref(null)

const newRequests = computed(() => bookings.value.filter((b) => b.status === 'pending'))
const responded = computed(() => bookings.value.filter((b) => b.status !== 'pending'))

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
  message.value = ''
  try {
    const updated = await bookingsApi.updateStatus(id, status)
    const booking = bookings.value.find((b) => b._id === id)
    booking.status = updated.status
    message.value = status === 'accepted' ? 'Request accepted ✅ The owner can now pay.' : 'Request declined.'
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not update the booking.'
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

  <div v-if="loading" class="text-muted">Loading requests…</div>

   <template v-else-if="!error">
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