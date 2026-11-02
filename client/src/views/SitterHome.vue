<script setup>
import { computed, onMounted, ref } from 'vue'
import { bookingsApi } from '../services/bookingApi.js'
import { currentUser } from '../services/auth.js'
import { formatTime, formatPrice, formatBookingWhen } from '../utils/bookingHelpers.js'
import ProfileChecklistCard from '../components/ProfileChecklistCard.vue'

const bookings = ref([])
const loading = ref(true)
const error = ref('')

const newRequests = computed(() => bookings.value.filter((b) => b.status === 'pending'))
const upcoming = computed(() =>
  bookings.value.filter((b) => ['confirmed', 'in-progress'].includes(b.status))
)
const nextBooking = computed(() => upcoming.value[0])

// Count bookings whose dates cover today (Singapore time), plus any already in progress
const todayCount = computed(() => {
  const sgDate = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' })
  const today = sgDate(new Date())
  return upcoming.value.filter(
    (b) => b.status === 'in-progress' || (sgDate(b.startDate) <= today && today <= sgDate(b.endDate))
  ).length
})
const alsoComingUp = computed(() => upcoming.value.slice(1, 4))

function petNames(booking) {
  return booking.petIds.map((p) => p.name).join(', ')
}

function ownerName(booking) {
  return booking.ownerId?.username || booking.ownerId?.name || 'Unknown'
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
    bookings.value = await bookingsApi.getMine('pending,confirmed,in-progress')
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load your dashboard.'
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <div class="sh">
    <div class="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
      <div>
        <h1 class="h2 fw-bold mb-1">Welcome back, {{ currentUser?.username }} 🐾</h1>
        <p class="text-muted mb-0">Here's what's happening with your bookings.</p>
      </div>
    </div>

    <ProfileChecklistCard />

    <div v-if="error" class="alert alert-warning">{{ error }}</div>
    <div v-else-if="loading" class="text-muted">Loading your dashboard…</div>

    <template v-else>
      <!-- Stat tiles -->
      <div class="row g-3 mb-4">
        <div class="col-12 col-md-4">
          <router-link to="/sitter/requests" class="card h-100 text-decoration-none text-body stat-tile">
            <div class="card-body">
              <div class="text-muted small">New requests</div>
              <div class="fs-2 fw-bold stat-number">{{ newRequests.length }}</div>
              <div class="text-muted small">Waiting for your reply</div>
            </div>
          </router-link>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="text-muted small">Upcoming bookings</div>
              <div class="fs-2 fw-bold stat-number">{{ upcoming.length }}</div>
              <div class="text-muted small">Accepted or paid</div>
            </div>
          </div>
        </div>
        <div class="col-6 col-md-4">
          <div class="card h-100">
            <div class="card-body">
              <div class="text-muted small">Today</div>
              <div class="fs-2 fw-bold stat-number">{{ todayCount }}</div>
              <div class="text-muted small">Bookings today</div>
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4">
        <!-- Main column: next booking + also coming up -->
        <div class="col-12 col-lg-8 d-flex flex-column gap-4">
          <section class="card">
            <div class="card-body p-4">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h2 class="h5 fw-bold mb-0">{{ nextBooking?.status === 'in-progress' ? 'Happening now' : 'Next booking' }}</h2>
              </div>
              <template v-if="nextBooking">
                <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
                  <img v-if="nextBooking.petIds[0]?.photo?.url" :src="nextBooking.petIds[0].photo.url"
                    :alt="nextBooking.petIds[0].name" class="pet-photo" />
                  <div v-else class="pet-photo" aria-hidden="true">🐾</div>
                  <div>
                    <div class="fs-5 fw-bold">{{ petNames(nextBooking) }}</div>
                    <div class="text-muted">Owner: {{ ownerName(nextBooking) }}</div>
                    <div>{{ formatBookingWhen(nextBooking) }}</div>
                    <div class="fw-semibold">{{ formatPrice(nextBooking.totalPrice) }}</div>
                  </div>
                </div>
                <router-link :to="`/bookings/${nextBooking._id}`" class="btn text-white main-btn">View booking details</router-link>
              </template>
              <p v-else class="text-muted mb-0">No upcoming bookings yet.</p>
            </div>
          </section>

          <section v-if="alsoComingUp.length" class="card">
            <div class="card-body p-4">
              <h2 class="h5 fw-bold mb-2">Also coming up</h2>
              <ul class="list-unstyled mb-2">
                <li v-for="b in alsoComingUp" :key="b._id" class="d-flex justify-content-between align-items-center gap-2 py-2 border-top">
                  <span><strong>{{ petNames(b) }}</strong> · {{ formatDate(b.startDate) }}{{ b.startTime ? ', ' + formatTime(b.startTime) : '' }}</span>
                  <span class="small text-muted">{{ b.status }}</span>
                </li>
              </ul>
              <router-link to="/sitter/calendar" class="fw-semibold see-all">See all in My Calendar</router-link>
            </div>
          </section>
        </div>

        <!-- Side column: new requests + availability card -->
        <div class="col-12 col-lg-4 d-flex flex-column gap-4">
          <section class="card">
            <div class="card-body p-4">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h2 class="h5 fw-bold mb-0">New requests</h2>
                <span v-if="newRequests.length" class="badge rounded-pill count-badge">{{ newRequests.length }}</span>
              </div>
              <ul v-if="newRequests.length" class="list-unstyled mb-3">
                <li v-for="b in newRequests.slice(0, 3)" :key="b._id" class="py-2 border-top">
                  <div class="fw-semibold">{{ petNames(b) }}</div>
                  <div class="small text-muted">
                    {{ ownerName(b) }} · {{ formatDate(b.startDate) }}{{ b.startTime ? ' ' + formatTime(b.startTime) : '' }} – {{ formatDate(b.endDate) }}{{ b.endTime ? ' ' + formatTime(b.endTime) : '' }} · ${{ b.totalPrice }}
                  </div>
                </li>
              </ul>
              <p v-else class="text-muted">No new requests right now 🐾</p>
              <router-link v-if="newRequests.length" to="/sitter/requests" class="btn text-white main-btn w-100">Review requests</router-link>
            </div>
          </section>

          <!-- Availability reminder -->
          <section class="card availability-card">
            <div class="card-body p-4">
              <div class="d-flex gap-3 mb-3">
                <div class="availability-icon" aria-hidden="true">📅</div>
                <div>
                  <h2 class="h5 fw-bold mb-1">Keep your availability up to date</h2>
                  <p class="small mb-0 availability-sub">Owners can only book the times you're free.</p>
                </div>
              </div>
              <router-link to="/sitter/calendar" class="btn w-100 availability-btn">Update calendar</router-link>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sh {
  /* One shadow for every card on this page: a soft edge all the way round + a deeper shadow underneath */
  --card-shadow: 0 0 0 1px rgba(120, 70, 40, 0.06), 0 2px 6px rgba(120, 70, 40, 0.12), 0 10px 24px rgba(120, 70, 40, 0.14);
}
.card {
  margin-top: 1rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid var(--line);    
  border-radius: 16px;
  background: #fff;
  box-shadow: var(--card-shadow);
}
/* The profile checklist card at the top is its own component, so give it the same shadow from here */
.sh :deep(.pc) {
  box-shadow: var(--card-shadow);
}
.stat-number {
  color: var(--accent-deep);
}
.stat-tile {
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.stat-tile:hover {
  border-color: var(--accent-deep);
  transform: translateY(-2px); /* the clickable tile lifts a little */
  box-shadow: 0 0 0 1px rgba(120, 70, 40, 0.08), 0 4px 10px rgba(120, 70, 40, 0.16), 0 14px 30px rgba(120, 70, 40, 0.18);
}
.main-btn {
  background-color: var(--accent-deep);
}
.main-btn:hover {
  background-color: #a8431a;
  color: #fff;
}
.outline-btn {
  border: 1px solid var(--accent-deep);
  color: #a8431a;
  background-color: #fff;
}
.outline-btn:hover {
  background-color: #fbeee8;
  color: #a8431a;
}
.pet-photo {
  width: 88px;
  height: 88px;
  border-radius: 12px;
  background-color: #e9ecef;
  color: #6c757d;
  font-size: 32px;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
}
.count-badge {
  background-color: var(--accent-deep);
}
.see-all {
  color: #a8431a;
}
.availability-card {
  --av-ink: #343434;
  --av-sub: rgba(56, 52, 52, 0.88);
  --av-tile: #fff;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid var(--accent);    
  border-radius: 16px;
  background-color: #f1d1db;
  color: var(--av-ink);
  box-shadow: 0 0 0 1px rgb(var(--accent-rgb) / 0.12), 0 2px 6px rgb(var(--accent-rgb) / 0.2), 0 10px 24px rgb(var(--accent-rgb) / 0.3); /* same all-round shadow, in the accent colour */
}
.availability-card h2 {
  color: var(--av-ink);
}
.availability-sub {
  color: var(--av-sub);
}
.availability-icon {
  width: 40px;
  height: 40px;
  flex: none;
  border-radius: 10px;
  background-color: var(--av-tile);
  display: flex;
  align-items: center;
  justify-content: center;
}
.availability-btn {
  border: 0;
  border-radius: 10px;
  background: #fff;
  color: var(--accent);
  font-weight: 700;
}
.availability-btn:hover,
.availability-btn:focus-visible {
  background: var(--tint-soft);
  color: var(--accent-hover);
}
.availability-btn:focus-visible {
  outline: 2px solid #fff;
  outline-offset: 2px;
}
</style>
