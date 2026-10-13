<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bookingsApi } from '../services/bookingApi.js'
import { currentUser, fetchUser } from '../services/auth.js'
import BookingCard from '../components/BookingCard.vue'

const TABS = [
  { key: 'pending', label: 'Pending', statuses: ['pending'] },
  { key: 'upcoming', label: 'Upcoming', statuses: ['accepted', 'paid', 'in-progress'] },
  { key: 'past', label: 'Past', statuses: ['completed', 'declined'] }
]

const route = useRoute()
const router = useRouter()

const bookings = ref([])
const loading = ref(true)
const error = ref('')
const activeTab = ref(TABS.some((t) => t.key === route.query.tab) ? route.query.tab : 'pending')

function bookingsFor(tabKey) {
  const tab = TABS.find((t) => t.key === tabKey)
  const list = bookings.value.filter((b) => tab.statuses.includes(b.status))
  return tabKey === 'past' ? [...list].reverse() : list
}

const visibleBookings = computed(() => bookingsFor(activeTab.value))

function selectTab(key) {
  activeTab.value = key
  router.replace({ query: { tab: key } })
}

async function loadBookings() {
  loading.value = true
  error.value = ''
  try {
    if (!currentUser.value) await fetchUser()
    if (!currentUser.value) {
      error.value = 'Please log in first.'
      return
    }
    if (currentUser.value.role !== 'owner') {
      error.value = 'This page is for pet owners.'
      return
    }
    bookings.value = await bookingsApi.getMine()
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load your bookings.'
  } finally {
    loading.value = false
  }
}

onMounted(loadBookings)
</script>

<template>
  <h2 class="mb-4">My Bookings</h2>

  <div v-if="error" class="alert alert-warning">{{ error }}</div>
  <div v-else-if="loading" class="text-muted">Loading your bookings…</div>

  <template v-else>
    <ul class="nav nav-pills mb-4 flex-nowrap overflow-auto">
      <li v-for="tab in TABS" :key="tab.key" class="nav-item">
        <button class="nav-link text-nowrap" :class="{ active: activeTab === tab.key }" @click="selectTab(tab.key)">
          {{ tab.label }}
          <span class="badge bg-light text-dark ms-1">{{ bookingsFor(tab.key).length }}</span>
        </button>
      </li>
    </ul>

    <p v-if="!visibleBookings.length" class="text-muted">No bookings here yet 🐾</p>

    <div class="row g-3">
      <div v-for="b in visibleBookings" :key="b._id" class="col-12 col-md-6 col-lg-4">
        <BookingCard :booking="b" viewer="owner" />
      </div>
    </div>
  </template>
</template>

<style scoped>
.nav-pills .nav-link {
  color: #2b2420;
}
.nav-pills .nav-link.active {
  background-color: #c44f1c;
  color: #fff;
}
</style>