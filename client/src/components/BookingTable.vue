<script setup>
import { ref, computed } from 'vue'
import StatusPill from './StatusPill.vue'
import BookingTasks from './BookingTasks.vue'
import defaultAvatar from '../assets/img/tempProfile.jpg'
import { formatDateRange, formatPrice } from '../utils/bookingHelpers'

const props = defineProps({
  
  bookings: { type: Array, required: true },
  viewer: { type: String, default: 'owner' }, // 'owner' or 'sitter'
  busyId: { type: String, default: null }, // booking being accepted/declined right now
  showTrip: { type: Boolean, default: true } // hide the trip link on the trip page itself
})

defineEmits(['accept', 'decline'])

// only one details row open at a time
const openId = ref(null)
function toggleDetails(id) {
  openId.value = openId.value === id ? null : id
}

// the person on the other side of the booking
function otherPerson(booking) {
  const person = props.viewer === 'sitter' ? booking.ownerId : booking.sitterId
  return person?.username || person?.name || 'Unknown'
}

function petNames(booking) {
  const names = (booking.petIds || []).map((p) => p?.name).filter(Boolean)
  return names.length ? names.join(', ') : 'No pets listed'
}

function showRoute(booking) {
  return ['accepted', 'paid', 'in-progress'].includes(booking.status)
}

function showTripLink(booking) {
  return props.showTrip && props.viewer === 'owner' && booking.groupId
}
</script>

<template>
  <div class="table-responsive booking-table">
    <table class="table align-middle mb-0">
      <thead>
        <tr>
          <th>{{ viewer === 'sitter' ? 'Owner' : 'Sitter' }}</th>
          <th>Dates</th>
          <th class="d-none d-md-table-cell">Price</th>
          <th>Status</th>
          <th class="text-end">Actions</th>
        </tr>
      </thead>

      <tbody>
        <template v-for="b in bookings" :key="b._id">
          <!-- main row -->
          <tr :class="{ 'opacity-75': b.status === 'declined' }">
            <td>
              <div class="d-flex align-items-center gap-2">
                <span class="avatar">{{ otherPerson(b).charAt(0).toUpperCase() }}</span>
                <div>
                  <div class="fw-semibold">{{ otherPerson(b) }}</div>
                  <div class="small text-muted">
                    <router-link
                      v-if="showTripLink(b)"
                      :to="`/owner/bookings/group/${b.groupId}`"
                      class="trip-link"
                    >{{ b.groupName || 'Trip' }}</router-link>
                    <span v-if="showTripLink(b)"> · </span>{{ petNames(b) }}
                  </div>
                </div>
              </div>
            </td>
            <td class="text-nowrap">{{ formatDateRange(b.startDate, b.endDate, b.startTime, b.endTime) }}</td>
            <td class="d-none d-md-table-cell">{{ formatPrice(b.totalPrice) }}</td>
            <td><StatusPill :status="b.status" /></td>
            <td class="text-end">
              <div class="d-flex flex-wrap justify-content-end align-items-center gap-2">
                <template v-if="viewer === 'sitter' && b.status === 'pending'">
                  <button class="btn btn-sm btn-success" :disabled="busyId === b._id" @click="$emit('accept', b._id)">Accept</button>
                  <button class="btn btn-sm btn-outline-danger" :disabled="busyId === b._id" @click="$emit('decline', b._id)">Decline</button>
                </template>
                <router-link
                  v-if="viewer === 'owner' && b.status === 'accepted'"
                  class="btn btn-sm text-white pay-btn"
                  :to="`/bookings/${b._id}/pay`"
                >Pay now</router-link>
                <router-link
                  v-if="viewer === 'owner' && b.status === 'completed'"
                  class="btn btn-sm btn-outline-secondary"
                  :to="`/bookings/${b._id}/review`"
                >Leave review</router-link>
                <button
                  type="button"
                  class="btn btn-sm btn-link details-link text-nowrap"
                  :aria-expanded="openId === b._id"
                  @click="toggleDetails(b._id)"
                >
                  {{ openId === b._id ? 'Hide details ▲' : 'View details ▼' }}
                </button>
              </div>
            </td>
          </tr>

          <tr v-if="openId === b._id" class="details-row">
            <td colspan="5">
              <div class="row g-3 py-2">
                <div class="col-12 col-lg-4">
                  <h6 class="small text-uppercase text-muted mb-2">Booking</h6>
                  <p class="small mb-1"><strong>Pets:</strong> {{ petNames(b) }}</p>
                  <p class="small mb-1 d-md-none"><strong>Price:</strong> {{ formatPrice(b.totalPrice) }}</p>
                  <p v-if="b.notes" class="small mb-2"><strong>Notes:</strong> "{{ b.notes }}"</p>
                  <div class="d-flex flex-wrap gap-2 mt-2">
                    <router-link class="btn btn-sm btn-outline-secondary" :to="`/bookings/${b._id}`">Booking page</router-link>
                    <router-link v-if="showRoute(b)" class="btn btn-sm btn-outline-secondary" :to="`/bookings/${b._id}/route`">Walk route</router-link>
                  </div>
                </div>
                <div class="col-12 col-lg-8">
                  <BookingTasks :booking="b" />
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.booking-table {
  background: #fff;
  border: 1px solid #ede3d8;
  border-radius: 12px;
  padding: 0 0.75rem;
}
.booking-table th {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6c757d;
  white-space: nowrap;
}
.avatar {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  background: #fde9dd;
  color: #c44f1c;
}
.trip-link {
  color: #2f6f62;
  font-weight: 600;
  text-decoration: none;
}
.details-link {
  color: #2b2420;
  font-weight: 600;
  text-decoration: none;
}
.details-row td {
  background: #fffaf6;
}
.pay-btn {
  background-color: #c44f1c;
}
</style>