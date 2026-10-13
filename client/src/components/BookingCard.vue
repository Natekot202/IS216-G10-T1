<script setup>
// One booking request (one sitter). Used on My Bookings for requests that are
// not part of a group, and on the group page for every request in the group.
import StatusPill from './StatusPill.vue'
import { sitterName, petNames, formatDateRange, formatPrice } from '../utils/bookingHelpers'

defineProps({ booking: { type: Object, required: true } })
</script>

<template>
  <div class="card h-100 shadow-sm" :class="{ 'opacity-75': booking.status === 'declined' }">
    <div class="card-body d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h5 class="card-title mb-0">{{ sitterName(booking) }}</h5>
        <StatusPill :status="booking.status" />
      </div>
      <p class="fw-semibold mb-3">{{ formatPrice(booking.totalPrice) }}</p>

      <div class="mt-auto d-flex flex-wrap gap-2">
        <router-link :to="`/bookings/${booking._id}`" class="btn btn-outline-secondary btn-sm">
          View details
        </router-link>
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
