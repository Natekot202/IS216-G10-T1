<script setup>
// /owner/bookings/group/:groupId: every request the owner sent for one trip
// (same pets and dates, different sitters), 1 row = 1 sitter's request.
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { bookingsApi } from '../services/bookingApi.js'
import BookingTable from '../components/BookingTable.vue'
import { petNames, formatDateRange, sitterName, chosenBooking } from '../utils/bookingHelpers'

const route = useRoute()
const bookings = ref([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const actionError = ref('') // why cancelling failed (the list stays visible)
const busyId = ref(null)

// every booking in a trip has the same pets and dates, so the first one is enough for the header
const first = computed(() => bookings.value[0])
const chosen = computed(() => chosenBooking(bookings.value))

async function cancelBooking(id) {
  if (!window.confirm('Cancel this request? The sitter will see it as cancelled. This cannot be undone.')) return
  busyId.value = id
  message.value = ''
  actionError.value = ''
  try {
    const updated = await bookingsApi.cancel(id)
    bookings.value.find((b) => b._id === id).status = updated.status
    message.value = 'Request cancelled.'
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not cancel the request.'
  } finally {
    busyId.value = null
  }
}

onMounted(async () => {
  try {
    // reuse GET /api/bookings and keep only this trip, so no new route is needed
    const all = await bookingsApi.getMine()
    bookings.value = all.filter((b) => b.groupId === route.params.groupId)
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load these requests. Please refresh the page.'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <router-link to="/owner/bookings" class="text-secondary text-decoration-none">&larr; Back to My Bookings</router-link>

  <div v-if="loading" class="text-muted mt-4">Loading this trip…</div>

  <div v-else-if="error" class="alert alert-warning mt-3">{{ error }}</div>

  <div v-else-if="!bookings.length" class="text-center py-5">
    <p class="text-muted">We couldn't find any requests for this trip.</p>
    <router-link to="/owner/bookings" class="btn text-white main-btn">Back to My Bookings</router-link>
  </div>

  <template v-else>
    <h1 class="mt-3 mb-1">{{ first.groupName || 'Trip' }}</h1>
    <h4 class="mb-2 pet-names">{{ petNames(first) }}</h4>
    <p class="text-muted mb-4">
      {{ formatDateRange(first.startDate, first.endDate, first.startTime, first.endTime) }} · {{ bookings.length }} requests sent
    </p>

    <div v-if="chosen" class="alert alert-success">
      You chose <strong>{{ sitterName(chosen) }}</strong> for this trip.
    </div>

    <div v-if="message" class="alert alert-success">{{ message }}</div>
    <div v-if="actionError" class="alert alert-warning">{{ actionError }}</div>

    <BookingTable :bookings="bookings" viewer="owner" :show-trip="false" :busy-id="busyId" @cancel="cancelBooking" />
  </template>
</template>

<style scoped>
.pet-names {
  color: #2f6f62;
}
</style>