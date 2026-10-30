<script setup>
import { computed } from 'vue'
import StatusPill from './StatusPill.vue'
import BookingTasks from './BookingTasks.vue'
import { formatDateRange, formatPrice } from '../utils/bookingHelpers'

const props = defineProps({
  booking: { type: Object, required: true },
  viewer: { type: String, default: 'owner' }, // 'owner' or 'sitter'
  busy: { type: Boolean, default: false }
})

defineEmits(['accept', 'decline'])

const otherPerson = computed(() => {
  const person = props.viewer === 'sitter' ? props.booking.ownerId : props.booking.sitterId
  return person?.username || person?.name || 'Unknown'
})

const petNames = computed(() =>
  (props.booking.petIds || []).map((p) => p?.name).filter(Boolean).join(', ')
)

const showRoute = computed(() => ['confirmed', 'in-progress'].includes(props.booking.status))
</script>

<template>
  <div class="card h-100 shadow-sm" :class="{ 'opacity-75': booking.status === 'declined' }">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h5 class="card-title mb-0">{{ petNames || 'No pets listed' }}</h5>
        <StatusPill :status="booking.status" />
      </div>
      <p class="text-muted mb-2">{{ viewer === 'sitter' ? 'Owner' : 'Sitter' }}: {{ otherPerson }}</p>
      <p class="mb-1">📅 {{ formatDateRange(booking.startDate, booking.endDate, booking.startTime, booking.endTime) }}</p>
      <p class="mb-1">💵 {{ formatPrice(booking.totalPrice) }}</p>
      <p v-if="booking.notes" class="small text-muted mb-0">"{{ booking.notes }}"</p>

      <div class="border-top pt-2 mt-3">
        <BookingTasks :booking="booking" />
      </div>
    </div>

    <div class="card-footer bg-transparent d-flex flex-wrap gap-2">
      <template v-if="viewer === 'sitter' && booking.status === 'pending'">
        <button class="btn btn-sm btn-success" :disabled="busy" @click="$emit('accept', booking._id)">Accept</button>
        <button class="btn btn-sm btn-outline-danger" :disabled="busy" @click="$emit('decline', booking._id)">Decline</button>
      </template>
      <router-link class="btn btn-sm btn-outline-secondary" :to="`/bookings/${booking._id}`">Booking page</router-link>
      <router-link v-if="showRoute" class="btn btn-sm btn-outline-secondary" :to="`/bookings/${booking._id}/route`">Walk route</router-link>
      <router-link v-if="viewer === 'owner' && booking.status === 'completed'" class="btn btn-sm btn-brand" :to="`/bookings/${booking._id}/pay`">Pay now</router-link>
    </div>
  </div>
</template>