<script setup>
import { ref, computed, toRef, watch } from 'vue'
import StatusPill from './StatusPill.vue'
import BookingTasks from './BookingTasks.vue'
import defaultAvatar from '../assets/img/tempProfile.jpg'
import { formatDateRange, formatPrice } from '../utils/bookingHelpers'
import { usePagination } from '../utils/usePagination.js'
import PaginationBar from '../components/PaginationBar.vue'

const props = defineProps({
  
  bookings: { type: Array, required: true },
  viewer: { type: String, default: 'owner' }, // 'owner' or 'sitter'
  busyId: { type: String, default: null }, // booking being accepted/declined right now
  paginate: { type: Boolean, default: true},
  pageSize: { type: Number, default: 6 }
})

defineEmits(['accept', 'decline', 'confirm', 'cancel'])

// only one details row open at a time
const openId = ref(null)
function toggleDetails(id) {
  openId.value = openId.value === id ? null : id
}

const tableEl = ref(null)

const { page, pageItems, goPage } = usePagination(toRef(props, 'bookings'), {
  pageSize: props.pageSize,
  scrollRef: tableEl
})

const rows = computed(() => (props.paginate ? pageItems.value : props.bookings))

watch(page, () => {
  openId.value = null
})

// the person on the other side of the booking
function otherPerson(booking) {
  const person = props.viewer === 'sitter' ? booking.ownerId : booking.sitterId
  return person?.username || person?.name || 'Unknown'
}

function petNames(booking) {
  const names = (booking.petIds || []).map((p) => p?.name).filter(Boolean)
  return names.length ? names.join(', ') : 'No pets listed'
}

function canCancel(booking) {
  if (props.viewer === 'owner') {
    return ['pending', 'accepted', 'confirmed'].includes(booking.status)
  }
  return booking.status === 'confirmed'
}

// for owners, returns true if request is pending/accepted/confirmed ; "Withdraw" a request, or "Cancel" a confirmed booking
// for sitters, returns true if booking is confirmed ; before that they decline instead

function showRoute(booking) {
  return ['confirmed', 'in-progress'].includes(booking.status)
}
</script>

<template>
  <div ref="tableEl" class="data-table-wrap">
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
        <template v-for="b in rows" :key="b._id">
          <!-- main row -->
          <tr :class="{ 'opacity-75': ['declined', 'cancelled', 'expired'].includes(b.status) }">
            <td>
              <div class="d-flex align-items-center gap-2">
                <span class="avatar">{{ otherPerson(b).charAt(0).toUpperCase() }}</span>
                <div>
                  <div class="fw-semibold">{{ otherPerson(b) }}</div>
                    <div class="small text-muted">
                    {{ petNames(b) }}
                    <span v-if="b.overnight" class="badge rounded-pill text-bg-light border ms-1">🌙 Overnight</span>
                  </div>
                </div>
              </div>
            </td>
            <td class="text-nowrap">{{ formatDateRange(b.startDate, b.endDate, b.startTime, b.endTime) }}</td>
            <td class="d-none d-md-table-cell">{{ formatPrice(b.totalPrice) }}</td>
            <td>
              <StatusPill :status="b.status" />
              <div v-if="b.status === 'accepted'" class="small text-muted mt-1">
                {{ viewer === 'owner' ? 'Waiting for you to confirm' : 'Waiting for the owner to confirm' }}
              </div>
              <div v-else-if="b.status === 'cancelled' && b.cancelledBy" class="small text-muted mt-1">
                by {{ (viewer === 'owner') === (b.cancelledBy === 'owner') ? 'you' : `the ${b.cancelledBy}` }}
              </div>
            </td>
            <td class="text-end">
              <!-- sitters get their buttons stacked top to bottom, all the same width (Accept, Decline, View details); owners keep them in a row -->
              <div
                class="d-flex gap-2"
                :class="viewer === 'sitter' ? 'flex-column align-items-stretch actions-stack' : 'flex-wrap justify-content-end align-items-center'"
              >
                <template v-if="viewer === 'sitter' && b.status === 'pending'">
                  <button class="btn btn-sm btn-success" :disabled="busyId === b._id" @click="$emit('accept', b._id)">Accept</button>
                  <button class="btn btn-sm btn-outline-danger" :disabled="busyId === b._id" @click="$emit('decline', b._id)">Decline</button>
                </template>
                <!-- the sitter can still say no while waiting for the owner, so they aren't held forever -->
                <button
                  v-if="viewer === 'sitter' && b.status === 'accepted'"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="busyId === b._id"
                  @click="$emit('decline', b._id)"
                >Decline</button>
                <button
                  v-if="viewer === 'owner' && b.status === 'accepted'"
                  type="button"
                  class="btn btn-sm btn-brand"
                  :disabled="busyId === b._id"
                  @click="$emit('confirm', b._id)"
                >Confirm</button>
                <router-link
                  v-if="viewer === 'owner' && b.status === 'completed'"
                  class="btn btn-sm btn-brand"
                  :to="`/bookings/${b._id}/pay`"
                >Pay now</router-link>
                <button
                  v-if="canCancel(b)" 
                  type="button"
                  class="btn btn-sm btn-outline-danger"
                  :disabled="busyId === b._id"
                  @click="$emit('cancel', b._id)"
                >{{ viewer === 'owner' && b.status !== 'confirmed' ? 'Withdraw' : 'Cancel' }}</button>
                <!-- button only exists if they're owners ; emits the cancel event with the payload of booking_id -->
                <!-- sitters open the Booking Detail page, owners open the details row below -->
                <router-link
                  v-if="viewer === 'sitter'"
                  class="btn btn-sm btn-outline-secondary text-nowrap"
                  :to="`/bookings/${b._id}`"
                >View details</router-link>
                <!-- 
                on clicking the button, router-link component directs to that link in the router index.js, which directs it to bookingdetail.vue page 
                -->
                <button
                  v-else
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
    <PaginationBar v-if="paginate" :page="page" :total="bookings.length" :page-size="pageSize" @change="goPage" />
  </div>
</template>

<style scoped>
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
.actions-stack {
  width: 132px; /* every stacked button is this wide */
  margin-left: auto; /* keeps the stack on the right of the Actions column */
}
.details-link {
  color: #2b2420;
  font-weight: 600;
  text-decoration: none;
}
.details-row td {
  background: #fffaf6;
}
</style>