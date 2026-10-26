<script setup>
// /bookings/:id: one booking, for the owner or the sitter on it.
// Shows who it is with, when, the pets and the owner's care checklist (look only, nothing can be ticked),
// and lets either of them cancel a pending or accepted booking.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { bookingsApi } from '../services/bookingApi.js'
import { currentUser, fetchUser } from '../services/auth.js'
import StatusPill from '../components/StatusPill.vue'
import { formatDateRange, formatPrice } from '../utils/bookingHelpers.js'

const route = useRoute()
const booking = ref(null)
const tasks = ref([]) // the care tasks the owner added: [{ title, ... }]
const loading = ref(true)
const error = ref('')
const actionError = ref('') // why cancelling failed (the page stays visible)
const busy = ref(false)

const isSitter = computed(() => currentUser.value?.role === 'sitter')
const backLink = computed(() => (isSitter.value ? '/sitter/requests' : '/owner/bookings'))
const backText = computed(() => (isSitter.value ? 'Back to Booking Requests' : 'Back to My Bookings'))

// the person on the other side of the booking
const otherPerson = computed(() => {
  const person = isSitter.value ? booking.value.ownerId : booking.value.sitterId
  return person?.username || 'Unknown'
})
const petNames = computed(() => {
  const names = (booking.value.petIds || []).map((p) => p?.name).filter(Boolean)
  return names.length ? names.join(', ') : 'No pets listed'
})
const canCancel = computed(() => ['pending', 'accepted'].includes(booking.value?.status))

async function cancelBooking() {
  if (!window.confirm('Cancel this booking? The other person will see it as cancelled. This cannot be undone.')) return
  busy.value = true
  actionError.value = ''
  try {
    const updated = await bookingsApi.cancel(booking.value._id)
    booking.value.status = updated.status
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not cancel the booking.'
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    if (!currentUser.value) await fetchUser()
    booking.value = await bookingsApi.getOne(route.params.id)
    tasks.value = (await bookingsApi.getCareTasks(route.params.id)).items
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load this booking.'
  } finally {
    loading.value = false
  }
})
// checks if the user is logged in , then gets their booking and careTasks 
</script>

<template>
  <router-link :to="backLink" class="text-secondary text-decoration-none">&larr; {{ backText }}</router-link>
  <h2 class="mt-2 mb-4">Booking Detail</h2>

  <div v-if="loading" class="text-muted">Loading this booking…</div>
  <div v-else-if="error" class="alert alert-warning">{{ error }}</div>

  <template v-else>
    <div v-if="booking.status === 'cancelled'" class="alert alert-secondary">
      This booking was cancelled. The hours are free on the sitter's calendar again.
    </div>
    <div v-if="actionError" class="alert alert-warning">{{ actionError }}</div>

    <div class="row g-4">
      <div class="col-lg-8">
        <!-- Care checklist: look only, so the boxes are switched off -->
        <div class="detail-card p-4 mb-4" :class="{ 'opacity-75': booking.status === 'cancelled' }">
          <h6 class="small text-uppercase text-muted mb-3">Care checklist</h6>
          <p v-if="!tasks.length" class="text-muted mb-0">No tasks added yet.</p>
          <div v-for="(task, i) in tasks" :key="i" class="form-check task-row">
            <input :id="`task-${i}`" class="form-check-input" type="checkbox" disabled />
            <label class="form-check-label" :for="`task-${i}`">{{ task.title }}</label>
          </div>
        </div>

        <div v-if="booking.notes" class="detail-card p-4" :class="{ 'opacity-75': booking.status === 'cancelled' }">
          <h6 class="small text-uppercase text-muted mb-2">Notes from owner</h6>
          <p class="mb-0">"{{ booking.notes }}"</p>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="detail-card p-4">
          <div class="d-flex align-items-center gap-2 mb-3">
            <span class="avatar">{{ otherPerson.charAt(0).toUpperCase() }}</span>
            <div class="flex-grow-1">
              <div class="fw-bold">{{ otherPerson }}</div>
              <div class="small text-muted">{{ isSitter ? 'Pet owner' : 'Pet sitter' }}</div>
            </div>
            <StatusPill :status="booking.status" />
          </div>
          <p class="mb-1"><span class="text-muted">When:</span> {{ formatDateRange(booking.startDate, booking.endDate, booking.startTime, booking.endTime) }}</p>
          <p class="mb-1"><span class="text-muted">Price:</span> {{ formatPrice(booking.totalPrice) }}</p>
          <p class="mb-0"><span class="text-muted">Pets:</span> {{ petNames }}</p>

          <div v-if="canCancel" class="border-top mt-3 pt-3">
            <button type="button" class="btn btn-sm btn-outline-danger" :disabled="busy" @click="cancelBooking">Cancel booking</button>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
.detail-card {
  background: #fff;
  border: 1px solid #ede3d8;
  border-radius: 12px;
}
.task-row {
  padding: 0.75rem 0 0.75rem 1.75rem;
  border-top: 1px solid #f1ece6;
}
.avatar {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.1rem;
  background: #fde9dd;
  color: #c44f1c;
}
</style>
