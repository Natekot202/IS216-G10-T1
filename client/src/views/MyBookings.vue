<script setup>
// /owner/bookings: every booking request the owner has sent, 1 row = 1 booking,
// sorted into Pending / Upcoming / Past tabs. Requests sent together for one trip
// show the trip name, which links to /owner/bookings/group/:groupId.
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bookingsApi } from '../services/bookingApi.js'
import { currentUser, fetchUser } from '../services/auth.js'
import BookingTable from '../components/BookingTable.vue'

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
const message = ref('') // e.g. "Booking cancelled."
const actionError = ref('') // why cancelling failed (the list stays visible)
const busyId = ref(null)
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

async function cancelBooking(id) {
  if (!window.confirm('Cancel this booking? The sitter will see it as cancelled. This cannot be undone.')) return
  busyId.value = id
  message.value = ''
  actionError.value = ''
  try {
    const updated = await bookingsApi.cancel(id)
    bookings.value.find((b) => b._id === id).status = updated.status
    message.value = 'Booking cancelled. You can find it under Past.'
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not cancel the booking.'
  } finally {
    busyId.value = null
  }
}

//window.confirm -> built-in browser popup with two buttons: OK and Cancel.
// if user clicks ok, returns true , so if block runs ; 
// if user clicks cancel, returns false , if block doesnt run 
// bookingsApi runs axios.patch to remove the booking via its id 

onMounted(loadBookings)
</script>

<template>
  <h2 class="mb-4">My Bookings</h2>

  <div v-if="error" class="alert alert-warning">{{ error }}</div>
  <div v-else-if="loading" class="text-muted">Loading your bookings…</div>

  <template v-else>
    <div v-if="message" class="alert alert-success">{{ message }}</div>
    <div v-if="actionError" class="alert alert-warning">{{ actionError }}</div>

    <ul class="nav nav-underline mb-4 flex-nowrap overflow-auto">
      <li v-for="tab in TABS" :key="tab.key" class="nav-item">
        <button
          type="button"
          class="nav-link text-nowrap"
          :class="{ active: activeTab === tab.key }"
          @click="selectTab(tab.key)"
        >
          {{ tab.label }}
          <span class="badge rounded-pill tab-count ms-1">{{ bookingsFor(tab.key).length }}</span>
        </button>
      </li>
    </ul>

    <div v-if="!visibleBookings.length" class="text-center text-muted py-5">
      <p class="mb-3">No bookings here yet 🐾</p>
      <router-link to="/home" class="btn text-white main-btn">Find a sitter</router-link>
    </div>

    <BookingTable v-else :bookings="visibleBookings" viewer="owner" :busy-id="busyId" @cancel="cancelBooking" />
    <!-- cancelBooking runs with the childs payload thats passed up  -->
  </template>
</template>

<style scoped>
.nav-underline .nav-link {
  color: #6c757d;
}
.nav-underline .nav-link.active {
  color: #2b2420;
  font-weight: 700;
  border-bottom-color: #c44f1c;
}
.tab-count {
  background: #f1ece6;
  color: #2b2420;
}
.main-btn {
  background-color: #c44f1c;
}
</style>