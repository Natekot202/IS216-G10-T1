<script setup>
// One card for a whole group of requests (same trip, several sitters).
// Clicking it opens /owner/bookings/group/:groupId.
import { computed } from 'vue'
import StatusPill from './StatusPill.vue'
import { sitterName, petNames, formatDateRange, statusCounts, chosenBooking } from '../utils/bookingHelpers'

const props = defineProps({ group: { type: Object, required: true } })

// every booking in a group has the same pets and dates, so the first one is enough
const first = computed(() => props.group.bookings[0])
const counts = computed(() => statusCounts(props.group.bookings))
const chosen = computed(() => chosenBooking(props.group.bookings))
</script>

<template>
  <router-link :to="`/owner/bookings/group/${group.groupId}`" class="text-decoration-none text-reset">
    <div class="card h-100 shadow-sm">
      <div class="card-body">
        <h5 class="card-title mb-1">{{ first.groupName }}</h5>
        <p class="text-muted mb-2">{{ formatDateRange(first.startDate, first.endDate) }}</p>
        <p class="mb-1 fw-bold petNames">{{ petNames(first) }}</p>
        <p class="mb-2">{{ group.bookings.length }} requests sent</p>

        <div v-if="chosen" class="d-flex flex-wrap align-items-center gap-2">
          <span>Chosen sitter: <strong>{{ sitterName(chosen) }}</strong></span>
          <StatusPill :status="chosen.status" />
        </div>
        <div v-else class="d-flex flex-wrap gap-2">
          <span v-for="(count, status) in counts" :key="status">
            <StatusPill :status="status" /> <small class="text-muted">×{{ count }}</small>
          </span>
        </div>

        <p class="text-secondary fw-semibold mt-3 mb-0">View requests</p>
      </div>
    </div>
  </router-link>
</template>

<style scoped>
  .petNames{
    color: #2f6f62
  }
</style>
