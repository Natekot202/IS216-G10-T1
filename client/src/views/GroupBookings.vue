<script setup>
// /owner/bookings/group/:groupId: every request sent for one trip, with its status.
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import BookingCard from '../components/BookingCard.vue'
import { petNames, formatDateRange, sitterName, chosenBooking } from '../utils/bookingHelpers'

import {sampleBookings} from '../sampleData/bookings.js'
import {sampleTasklists} from '../sampleData/taskLists.js'


const route = useRoute()
const bookings = ref([])
const loading = ref(true)
const error = ref('')

const first = computed(() => bookings.value[0])
const chosen = computed(() => chosenBooking(bookings.value))

/* 
onMounted(async () => {
  try {
    // reuse GET /api/bookings and keep only this group, so no new route is needed
    const res = await axios.get('/bookings')
    bookings.value = res.data.filter((b) => String(b.groupId) === route.params.groupId)
  } catch (err) {
    error.value = 'Could not load these requests. Check your connection and refresh the page.'
  } finally {
    loading.value = false
  }
})
*/
// temporary bookings
onMounted(()=>{
bookings.value = sampleBookings;

bookings.value = bookings.value.filter((b) => String(b.groupId) === route.params.groupId)
loading.value = false;
})
</script>

<template>
  <div class="container py-4">
    <router-link to="/owner/bookings" class="text-secondary text-decoration-none">&larr; Back to My Bookings</router-link>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
    </div>

    <div v-else-if="error" class="alert alert-danger mt-3">{{ error }}</div>

    <div v-else-if="bookings.length === 0" class="text-center py-5">
      <p class="text-muted">We couldn't find any requests for this trip.</p>
      <router-link to="/owner/bookings" class="btn btn-primary">Back to My Bookings</router-link>
    </div>

    <template v-else>
      <h1 class="mt-3 mb-1">{{ bookings[0].groupName }}</h1>
      <h4 class="mb-2 petNames">{{ petNames(first) }}</h4>
      <p class="text-muted mb-4">
        {{ formatDateRange(first.startDate, first.endDate) }} · {{ bookings.length }} requests sent
      </p>

      <div v-if="chosen" class="alert alert-success">
        You chose <strong>{{ sitterName(chosen) }}</strong>. The other requests were declined.
      </div>

      <div class="row row-cols-1 row-cols-md-2 g-3">
        <div v-for="b in bookings" :key="b._id" class="col">
          <BookingCard :booking="b" />
        </div>
      </div>
    </template>
  </div>
</template>
