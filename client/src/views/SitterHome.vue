<script setup>
import { computed, onMounted, ref } from 'vue'
import { bookingsApi } from '../services/bookingApi.js'
import { currentUser } from '../services/auth.js'
import BookingCard from '../components/BookingCard.vue'

const bookings = ref([])
const loading = ref(true)
const error = ref('')

const newRequests = computed(() => bookings.value.filter((b) => b.status === 'pending'))
const upcoming = computed(() =>
  bookings.value.filter((b) => ['accepted', 'paid', 'in-progress'].includes(b.status))
)
const nextBooking = computed(() => upcoming.value[0])
const alsoComingUp = computed(() => upcoming.value.slice(1, 4))

function petNames(booking) {
  return booking.petIds.map((p) => p.name).join(', ')
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short'
  })
}

async function loadDashboard() {
  loading.value = true
  error.value = ''
  try {
    bookings.value = await bookingsApi.getMine('pending,accepted,paid,in-progress')
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load your dashboard.'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <h1 class="h2 fw-bold mb-1">Welcome back, {{ currentUser?.username }} 🐾</h1>
  <p class="text-muted mb-4">Here's what's happening with your bookings.</p>

  <div v-if="error" class="alert alert-warning">{{ error }}</div>
  <div v-else-if="loading" class="text-muted">Loading your dashboard…</div>

  <template v-else>
    <!-- Stat tiles -->
    <div class="row g-3 mb-4">
      <div class="col-6 col-md-4">
        <router-link to="/requests" class="card h-100 shadow-sm text-decoration-none">
          <div class="card-body">
            <div class="text-muted small">New requests</div>
            <div class="fs-2 fw-bold stat-number">{{ newRequests.length }}</div>
          </div>
        </router-link>
      </div>
      <div class="col-6 col-md-4">
        <div class="card h-100 shadow-sm">
          <div class="card-body">
            <div class="text-muted small">Upcoming bookings</div>
            <div class="fs-2 fw-bold stat-number">{{ upcoming.length }}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="row g-4">
      <!-- Next booking -->
      <div class="col-12 col-lg-6">
        <h5 class="mb-3">{{ nextBooking?.status === 'in-progress' ? 'Happening now' : 'Next booking' }}</h5>
        <BookingCard v-if="nextBooking" :booking="nextBooking" viewer="sitter" />
        <p v-else class="text-muted">No upcoming bookings yet.</p>

        <template v-if="alsoComingUp.length">
          <h6 class="mt-4 mb-2 text-muted">Also coming up</h6>
          <ul class="list-group">
            <li v-for="b in alsoComingUp" :key="b._id" class="list-group-item d-flex justify-content-between align-items-center">
              <span>{{ petNames(b) }} · {{ formatDate(b.startDate) }}</span>
              <span class="small text-muted">{{ b.status }}</span>
            </li>
          </ul>
        </template>
      </div>

      <!-- New requests preview -->
      <div class="col-12 col-lg-6">
        <h5 class="mb-3">New requests</h5>
        <template v-if="newRequests.length">
          <ul class="list-group mb-3">
            <li v-for="b in newRequests.slice(0, 3)" :key="b._id" class="list-group-item">
              <div class="fw-semibold">{{ petNames(b) }}</div>
              <div class="small text-muted">
                {{ b.ownerId?.username }} · {{ formatDate(b.startDate) }} – {{ formatDate(b.endDate) }} · ${{ b.totalPrice }}
              </div>
            </li>
          </ul>
          <router-link to="/requests" class="btn text-white main-btn">Review requests</router-link>
        </template>
        <p v-else class="text-muted">No new requests right now 🐾</p>
      </div>
    </div>

    <!-- Availability reminder -->
    <div class="alert alert-light border mt-4 d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
      <span>📅 Keep your availability up to date so owners can book you.</span>
      <router-link to="/sitter/calendar" class="btn btn-sm btn-outline-secondary">Update calendar</router-link>
    </div>
  </template>
</template>

<style scoped>
.stat-number {
  color: #c44f1c;
}
.main-btn {
  background-color: #c44f1c;
}
</style>