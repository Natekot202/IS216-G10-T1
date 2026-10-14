<script setup>
// One booking, shown as a card. Used by:
//  - Booking Requests + Sitter Home (viewer="sitter")
//  - My Bookings + the group page (viewer="owner", the default)
import { ref, computed } from 'vue'
import StatusPill from './StatusPill.vue'
import { formatPrice } from '../utils/bookingHelpers'
import { findTasklist, summariseTasks, petNamesFor, scheduleText, daysText } from '../utils/taskListHelpers.js'

const props = defineProps({
  booking: { type: Object, required: true },
  viewer: { type: String, default: 'owner' }, // 'owner' or 'sitter'
  busy: { type: Boolean, default: false }
})

defineEmits(['accept', 'decline'])

// ----- booking info -----
const otherPerson = computed(() => {
  const person = props.viewer === 'sitter' ? props.booking.ownerId : props.booking.sitterId
  return person?.username || person?.name || 'Unknown'
})

const petNames = computed(() =>
  (props.booking.petIds || []).map((p) => p?.name).filter(Boolean).join(', ')
)

const showRoute = computed(() => ['accepted', 'paid', 'in-progress'].includes(props.booking.status))

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-SG', {
    timeZone: 'Asia/Singapore',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

const expanded = ref(false)
const tasklist = computed(() => (props.booking?._id ? findTasklist(props.booking._id) : null))
const taskItems = computed(() => tasklist.value?.items || [])
const taskSummary = computed(() => summariseTasks(taskItems.value, props.booking))
</script>

<template>
  <div class="card h-100 shadow-sm" :class="{ 'opacity-75': booking.status === 'declined' }">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h5 class="card-title mb-0">{{ petNames || 'No pets listed' }}</h5>
        <StatusPill :status="booking.status" />
      </div>
      <p class="text-muted mb-2">
        {{ viewer === 'sitter' ? 'Owner' : 'Sitter' }}: {{ otherPerson }}
      </p>
      <p class="mb-1">📅 {{ formatDate(booking.startDate) }} – {{ formatDate(booking.endDate) }}</p>
      <p class="mb-1">💵 {{ formatPrice(booking.totalPrice) }}</p>
      <p v-if="booking.notes" class="small text-muted mb-0">"{{ booking.notes }}"</p>

      <!-- Tasks -->
      <template v-if="tasklist">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm mt-3 mb-2"
          @click="expanded = !expanded"
        >
          {{ expanded ? 'Hide tasks ▲' : 'Show tasks ▼' }}
        </button>

        <!-- short summary -->
        <div v-if="!expanded" class="border-top pt-2">
          <h6 class="small text-uppercase text-muted mb-2">Tasks</h6>
          <ul v-if="taskSummary.length" class="list-unstyled mb-0">
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
          <p v-else class="small text-muted mb-0">No tasks added yet.</p>
        </div>

        <!-- full details -->
        <div v-else class="border-top pt-2">
          <h6 class="small text-uppercase text-muted mb-2">Task details</h6>
          <p v-if="!taskItems.length" class="small text-muted">No tasks added yet.</p>
          <div v-for="(task, i) in taskItems" :key="i" class="border rounded p-2 mb-2">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="fw-semibold">{{ task.title }}</div>
                <div class="small text-muted">
                  {{ task.category }}
                  <span v-if="petNamesFor(task, booking)"> · {{ petNamesFor(task, booking) }}</span>
                </div>
              </div>
              <span v-if="task.requiresPhoto" class="badge text-bg-light border">📷 Photo required</span>
            </div>

            <dl class="row small mb-0 mt-2">
              <dt class="col-4 col-sm-3">When</dt>
              <dd class="col-8 col-sm-9">{{ scheduleText(task) }}</dd>

              <dt class="col-4 col-sm-3">Days</dt>
              <dd class="col-8 col-sm-9">{{ daysText(task) }}</dd>

              <template v-if="task.category === 'feed'">
                <dt class="col-4 col-sm-3">Food</dt>
                <dd class="col-8 col-sm-9">{{ task.amount }} {{ task.unit }} {{ task.food }}</dd>
              </template>

              <template v-if="task.category === 'walk'">
                <dt class="col-4 col-sm-3">Walk</dt>
                <dd class="col-8 col-sm-9">
                  <span v-if="task.distanceKm">{{ task.distanceKm }} km</span>
                  <span v-if="task.distanceKm && task.durationMinutes"> · </span>
                  <span v-if="task.durationMinutes">{{ task.durationMinutes }} min</span>
                </dd>
              </template>

              <template v-if="task.category === 'groom' && task.service">
                <dt class="col-4 col-sm-3">Service</dt>
                <dd class="col-8 col-sm-9">{{ task.service.replace('-', ' ') }}</dd>
              </template>

              <template v-if="task.category === 'medication'">
                <dt v-if="task.medicationName" class="col-4 col-sm-3">Medicine</dt>
                <dd v-if="task.medicationName" class="col-8 col-sm-9">
                  {{ task.medicationName }}<span v-if="task.dosage"> · {{ task.dosage }}</span>
                </dd>
                <dt v-if="task.withFood" class="col-4 col-sm-3">Note</dt>
                <dd v-if="task.withFood" class="col-8 col-sm-9">Give with food</dd>
              </template>

              <template v-if="task.instructions">
                <dt class="col-4 col-sm-3">Instructions</dt>
                <dd class="col-8 col-sm-9">{{ task.instructions }}</dd>
              </template>
            </dl>

            <div v-if="task.referencePhotos?.length" class="d-flex flex-wrap gap-2 mt-2">
              <img
                v-for="p in task.referencePhotos"
                :key="p.url"
                :src="p.url"
                :alt="p.caption || 'Reference photo'"
                class="rounded task-photo"
              />
            </div>
          </div>
        </div>
      </template>
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
.pay-btn {
  background-color: #c44f1c;
}
.task-photo {
  height: 64px;
  width: 64px;
  object-fit: cover;
}
</style>