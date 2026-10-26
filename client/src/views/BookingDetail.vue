<script setup>
// /bookings/:id: one booking, for the owner or the sitter on it.
// Shows the pets (tap a pet to see its care checklist, look only, nothing can be ticked), the owner's notes,
// and a card for the person on the other side, with the buttons to accept / decline / cancel.
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { bookingsApi } from '../services/bookingApi.js'
import { currentUser, fetchUser } from '../services/auth.js'
import StatusPill from '../components/StatusPill.vue'
import ShowStarRating from '../components/ShowStarRating.vue'
import { formatDateRange, formatPrice } from '../utils/bookingHelpers.js'

const route = useRoute()
const booking = ref(null)
const tasks = ref([]) // the care tasks the owner added: [{ title, dailyFrequency, petIds, ... }]
const selectedPetId = ref(null) // the pet whose checklist is shown
const loading = ref(true)
const error = ref('')
const actionError = ref('') // why accepting / declining / cancelling failed (the page stays visible)
const message = ref('')
const busy = ref(false)

const isSitter = computed(() => currentUser.value?.role === 'sitter')
const backLink = computed(() => (isSitter.value ? '/sitter/requests' : '/owner/bookings'))
const backText = computed(() => (isSitter.value ? 'Back to Booking Requests' : 'Back to My Bookings'))

// the person on the other side of the booking
const person = computed(() => (isSitter.value ? booking.value.ownerId : booking.value.sitterId))
const personName = computed(() => person.value?.username || 'Unknown')
const personPicture = computed(() => person.value?.profilePicture?.url || '')
// Only sitters have ratings so far, so the stars are shown when the owner is looking at the sitter's card
const ratingAvg = computed(() => person.value?.sitterProfile?.ratingAvg || 0)
const ratingCount = computed(() => person.value?.sitterProfile?.ratingCount || 0)

const pets = computed(() => (booking.value.petIds || []).filter(Boolean))
const selectedPet = computed(() => pets.value.find((p) => p._id === selectedPetId.value))

// The checklist for the chosen pet. A task the owner set for both pets is in both lists.
// (Tasks saved without any pets are shown for every pet.)
const visibleTasks = computed(() =>
  tasks.value.filter((t) => !t.petIds?.length || t.petIds.map(String).includes(String(selectedPetId.value)))
)
// "Also for shrek": the other pets a task is for
function alsoFor(task) {
  return pets.value
    .filter((p) => p._id !== selectedPetId.value && task.petIds?.map(String).includes(String(p._id)))
    .map((p) => p.name)
}
function petKind(pet) {
  return [pet.species, pet.breed].filter(Boolean).join(' · ')
}

const canCancel = computed(() => ['pending', 'accepted'].includes(booking.value?.status))
const canRespond = computed(() => isSitter.value && booking.value?.status === 'pending')

async function respond(status) {
  busy.value = true
  actionError.value = ''
  message.value = ''
  try {
    const updated = await bookingsApi.updateStatus(booking.value._id, status)
    booking.value.status = updated.status
    message.value = status === 'accepted' ? 'Request accepted ✅ The owner can now pay.' : 'Request declined.'
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not update the booking.'
  } finally {
    busy.value = false
  }
}

async function cancelBooking() {
  if (!window.confirm('Cancel this booking? The other person will see it as cancelled. This cannot be undone.')) return
  busy.value = true
  actionError.value = ''
  message.value = ''
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
    selectedPetId.value = booking.value.petIds?.[0]?._id || null // start on the first pet
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load this booking.'
  } finally {
    loading.value = false
  }
})
// checks if the user is logged in , then gets their booking and careTasks
</script>

<template>
  <div class="detail-wrap">
    <router-link :to="backLink" class="text-secondary text-decoration-none">&larr; {{ backText }}</router-link>

    <div v-if="loading" class="text-muted mt-3">Loading this booking…</div>
    <div v-else-if="error" class="alert alert-warning mt-3">{{ error }}</div>

    <template v-else>
      <div class="d-flex flex-wrap align-items-center gap-3 mt-2 mb-1">
        <h2 class="detail-title mb-0">Booking Detail</h2>
        <StatusPill :status="booking.status" />
      </div>
      <p class="text-muted fw-semibold mb-3">
        {{ formatDateRange(booking.startDate, booking.endDate, booking.startTime, booking.endTime) }} · {{ formatPrice(booking.totalPrice) }}
      </p>

      <div v-if="booking.status === 'cancelled'" class="alert alert-secondary">
        This booking was cancelled. The hours are free on the sitter's calendar again.
      </div>
      <div v-if="message" class="alert alert-success">{{ message }}</div>
      <div v-if="actionError" class="alert alert-warning">{{ actionError }}</div>

      <!-- Pets: tap one to show its checklist below. With one pet there is nothing to choose, so this card is left out
           and the pet's picture and name go at the top of the checklist card instead -->
      <div v-if="pets.length !== 1" class="detail-card p-4 mb-3" :class="{ 'opacity-75': booking.status === 'cancelled' }">
        <h6 class="section-title">Pets · tap a pet to see its checklist</h6>
        <p v-if="!pets.length" class="text-muted mb-0">No pets listed.</p>
        <div class="row g-2">
          <div v-for="pet in pets" :key="pet._id" class="col-12 col-sm-6">
            <button
              type="button"
              class="pet-card"
              :class="{ active: pet._id === selectedPetId }"
              :aria-pressed="pet._id === selectedPetId"
              @click="selectedPetId = pet._id"
            >
              <img v-if="pet.photo?.url" :src="pet.photo.url" :alt="pet.name" class="pet-photo" />
              <span v-else class="pet-photo pet-initial">{{ pet.name.charAt(0).toUpperCase() }}</span>
              <span>
                <strong class="pet-name d-block">{{ pet.name }}</strong>
                <small class="text-muted">{{ petKind(pet) }}</small>
              </span>
            </button>
          </div>
        </div>
      </div>

      <!-- Care checklist for the chosen pet: look only, so the boxes are switched off -->
      <div class="detail-card p-4 mb-3" :class="{ 'opacity-75': booking.status === 'cancelled' }">
        <h6 class="section-title">
          {{ pets.length > 1 && selectedPet ? `${selectedPet.name}'s checklist` : 'Care checklist' }}
          · {{ visibleTasks.length }} task{{ visibleTasks.length === 1 ? '' : 's' }}
        </h6>
        <!-- one pet: its picture, name and kind sit at the top of this card -->
        <div v-if="pets.length === 1" class="one-pet-row d-flex align-items-center gap-3">
          <img v-if="pets[0].photo?.url" :src="pets[0].photo.url" :alt="pets[0].name" class="pet-photo" />
          <span v-else class="pet-photo pet-initial">{{ pets[0].name.charAt(0).toUpperCase() }}</span>
          <span>
            <strong class="pet-name d-block">{{ pets[0].name }}</strong>
            <small class="text-muted">{{ petKind(pets[0]) }}</small>
          </span>
        </div>
        <p v-if="!visibleTasks.length" class="text-muted mb-0">No tasks added{{ pets.length > 1 && selectedPet ? ` for ${selectedPet.name}` : '' }}.</p>
        <div v-for="(task, i) in visibleTasks" :key="i" class="form-check task-row d-flex align-items-center gap-2">
          <input :id="`task-${i}`" class="form-check-input mt-0" type="checkbox" disabled />
          <label class="form-check-label flex-grow-1" :for="`task-${i}`">
            {{ task.title }}
            <small v-if="pets.length > 1" class="d-block text-muted">
              {{ alsoFor(task).length ? `Also for ${alsoFor(task).join(', ')}` : `Only for ${selectedPet?.name}` }}
            </small>
          </label>
          <span v-if="task.dailyFrequency > 1" class="freq-badge">{{ task.dailyFrequency }} times a day</span>
        </div>
      </div>

      <div v-if="booking.notes" class="detail-card p-4 mb-3" :class="{ 'opacity-75': booking.status === 'cancelled' }">
        <h6 class="section-title">Notes from owner</h6>
        <p class="mb-0">"{{ booking.notes }}"</p>
      </div>

      <!-- The other person, with the buttons at the end of the page -->
      <div class="detail-card p-4 mb-3">
        <h6 class="section-title">{{ isSitter ? 'Owner' : 'Sitter' }}</h6>
        <div class="d-flex align-items-center gap-3">
          <img v-if="personPicture" :src="personPicture" :alt="personName" class="avatar" />
          <span v-else class="avatar">{{ personName.charAt(0).toUpperCase() }}</span>
          <div class="flex-grow-1">
            <div class="fw-bold fs-5">{{ personName }}</div>
            <div class="small text-muted">{{ isSitter ? 'Pet owner' : 'Pet sitter' }}</div>
            <!-- stars from the sitter's profile (owners have no ratings yet, so the sitter doesn't see this row) -->
            <div v-if="!isSitter" class="d-flex align-items-center gap-2 mt-1">
              <template v-if="ratingCount">
                <ShowStarRating :modelValue="Math.round(ratingAvg)" :maxStars="5" />
                <span class="small"><strong>{{ ratingAvg.toFixed(1) }}</strong> from {{ ratingCount }} review{{ ratingCount === 1 ? '' : 's' }}</span>
              </template>
              <span v-else class="small text-muted">No reviews yet</span>
            </div>
          </div>
          <!-- on the right of the same row; sitters can open the owner's profile too, owners open the sitter's -->
          <router-link :to="`/users/${person._id}`" class="btn btn-outline-secondary flex-shrink-0">View profile</router-link>
        </div>

        <!-- the buttons run across the whole card, under a line -->
        <div v-if="canRespond || canCancel" class="border-top mt-3 pt-3 text-center">
          <div v-if="canRespond" class="row g-2">
            <div class="col-6"><button type="button" class="btn btn-success w-100" :disabled="busy" @click="respond('accepted')">Accept request</button></div>
            <div class="col-6"><button type="button" class="btn btn-outline-danger w-100" :disabled="busy" @click="respond('declined')">Decline</button></div>
          </div>
          <template v-else>
            <button type="button" class="btn btn-outline-danger w-100" :disabled="busy" @click="cancelBooking">Cancel booking</button>
            <p class="small text-muted mt-2 mb-0">You can cancel until the booking starts. Once it is paid, it can't be cancelled here.</p>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.detail-wrap {
  max-width: 760px;
  margin: 0 auto;
}
.detail-title {
  font-family: 'Fredoka', 'Nunito', sans-serif;
  font-weight: 600;
}
.detail-card {
  background: #fff;
  border: 1px solid #ede3d8;
  border-radius: 12px;
}
.section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #766a60;
  font-weight: 800;
  margin-bottom: 0.9rem;
}
.pet-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-align: left;
  background: #fffaf6;
  border: 1.5px solid #ede3d8;
  border-radius: 12px;
  padding: 0.7rem 0.8rem;
  cursor: pointer;
}
.pet-card:hover {
  border-color: #c47756;
}
.pet-card.active {
  border-color: #c47756;
  box-shadow: 0 0 0 3px #f6e3d9;
  background: #fff;
}
.pet-photo {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 14px;
  object-fit: cover;
}
.pet-initial {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #c47756;
  color: #fff;
  font-family: 'Fredoka', sans-serif;
  font-size: 1.5rem;
  font-weight: 600;
}
.pet-name {
  font-family: 'Fredoka', sans-serif;
  font-weight: 600;
  font-size: 1.05rem;
}
.one-pet-row {
  padding-bottom: 0.9rem;
  margin-bottom: 0.25rem;
  border-bottom: 1px dashed #ede3d8;
}
.task-row {
  padding: 0.75rem 0 0.75rem 1.75rem;
  border-top: 1px solid #f1ece6;
}
.freq-badge {
  background: #f6e3d9;
  color: #c47756;
  border-radius: 999px;
  padding: 0.1rem 0.7rem;
  font-weight: 800;
  font-size: 0.75rem;
  white-space: nowrap;
}
.avatar {
  width: 56px;
  height: 56px;
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 1.3rem;
  background: #fde9dd;
  color: #c44f1c;
}
</style>
