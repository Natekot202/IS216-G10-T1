<script setup>
import { computed } from 'vue'

const props = defineProps({
  booking: { type: Object, required: true },
  viewer: { type: String, required: true }, // 'owner' or 'sitter'
  busy: { type: Boolean, default: false }
})

defineEmits(['accept', 'decline'])

const otherPerson = computed(() =>
  props.viewer === 'sitter' ? props.booking.ownerId?.username : props.booking.sitterId?.username
)

const petNames = computed(() => props.booking.petIds.map((p) => p.name).join(', '))

const showRoute = computed(() => ['accepted', 'paid', 'in-progress'].includes(props.booking.status))

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="card h-100 shadow-sm">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h5 class="card-title mb-0">{{ petNames || 'No pets listed' }}</h5>
        <span class="badge rounded-pill" :class="`status-${booking.status}`">{{ booking.status }}</span>
      </div>
      <p class="text-muted mb-2">
        {{ viewer === 'sitter' ? 'Owner' : 'Sitter' }}: {{ otherPerson || 'Unknown' }}
      </p>
      <p class="mb-1">📅 {{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</p>
      <p class="mb-1">💵 ${{ booking.totalPrice }}</p>
      <p v-if="booking.notes" class="small text-muted mb-0">"{{ booking.notes }}"</p>
    </div>

    <div class="card-footer bg-transparent d-flex flex-wrap gap-2">
      <template v-if="viewer === 'sitter' && booking.status === 'pending'">
        <button class="btn btn-sm btn-success" :disabled="busy" @click="$emit('accept', booking._id)">Accept</button>
        <button class="btn btn-sm btn-outline-danger" :disabled="busy" @click="$emit('decline', booking._id)">Decline</button>
      </template>

      <router-link class="btn btn-sm btn-outline-secondary" :to="`/bookings/${booking._id}`">Details</router-link>
      <router-link v-if="showRoute" class="btn btn-sm btn-outline-secondary" :to="`/bookings/${booking._id}/route`">Walk Route</router-link>
      <router-link v-if="viewer === 'owner' && booking.status === 'accepted'" class="btn btn-sm text-white pay-btn" :to="`/bookings/${booking._id}/pay`">Pay now</router-link>
      <router-link v-if="viewer === 'owner' && booking.status === 'completed'" class="btn btn-sm btn-outline-secondary" :to="`/bookings/${booking._id}/review`">Leave review</router-link>
    </div>
  </div>
</template>

<style scoped>
.status-pending { background-color: #f2b33d; color: #2b2420; }
.status-accepted { background-color: #3b7dd8; }
.status-declined { background-color: #d9534f; }
.status-paid { background-color: #2f6f62; }
.status-in-progress { background-color: #7b5cc4; }
.status-completed { background-color: #8aa67a; }
.pay-btn { background-color: #c44f1c; }
</style>