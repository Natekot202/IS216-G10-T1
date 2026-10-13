<script setup>
// One booking request (one sitter). Used on My Bookings for requests that are
// not part of a group, and on the group page for every request in the group.
import {ref} from "vue";

import StatusPill from './StatusPill.vue'
import { sitterName, petNames, formatDateRange, formatPrice } from '../utils/bookingHelpers'


const props = defineProps({
  booking: {
    type: Object,
    required: true
  },
  taskSummary: {
    type: Array,
    default: () => []
  }
})

const expanded = ref(false);

</script>

<template>
  <div class="card h-100 shadow-sm" :class="{ 'opacity-75': booking.status === 'declined' }">
    <div class="card-body d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h5 class="card-title mb-0">{{ sitterName(booking) }}</h5>
        <StatusPill :status="booking.status" />
      </div>
      <p class="fw-semibold mb-3">{{ formatPrice(booking.totalPrice) }}</p>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm mb-2 align-self-start text-decoration-none"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Hide details ▲' : 'Show details ▼' }}
      </button>

      <div v-if="expanded" :id="`details-${booking._id}`" class="border-top pt-2 mb-3">
        <h6 class="small text-uppercase text-muted mb-2">Tasks</h6>

        <ul v-if="taskSummary.length" class="list-unstyled mb-2">
          <li
            v-for="(cat, index) in taskSummary"
            :key="index"
            class="d-flex justify-content-between flex-wrap gap-1 small py-1"
          >
            <span class="fw-semibold">{{ cat.category }}</span>
            <span class="text-muted">
              {{ cat.dailyFrequency }} per day · {{ cat.bookingFrequency }} per booking
            </span>
          </li>
        </ul>
        <p v-else class="small text-muted mb-2">No tasks added yet.</p>
      </div>   
      <div class="mt-auto d-flex flex-wrap gap-2">
        <router-link
          v-if="booking.status === 'accepted'"
          :to="`/bookings/${booking._id}/pay`"
          class="btn btn-primary btn-sm"
        >
          Pay now
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .petNames{
    color: #2f6f62
  }
</style>
