<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { currentUser } from '../services/auth.js'

const props = defineProps({
  profile: { type: Object, required: true },
  editable: { type: Boolean, default: false }
})

const canRequestBooking = computed(() => 
  !props.editable && props.profile.role === 'sitter' && currentUser.value?.role === 'owner'
)

// dates and times from the owner's search (in this page's URL), passed on so the booking form can fill them in
const route = useRoute()
const bookingQuery = computed(() => {
  const query = { sitterId: props.profile._id }
  for (const key of ['startDate', 'endDate', 'startTime', 'endTime']) {
    if (typeof route.query[key] === 'string') query[key] = route.query[key]
  }
  return query
})

const needsLogin = computed(() => 
  !props.editable && props.profile.role === 'sitter' && !currentUser.value
)

</script>

<template>
    <!-- sits full width in the profile card, under the name and bio -->
    <router-link v-if="editable" class="btn btn-brand w-100 button" to="/editProfile">
        Edit Details
    </router-link>

    <router-link v-else-if="canRequestBooking" class="btn btn-brand w-100 button" :to="{ path: '/bookings/new', query: bookingQuery }">
        Request Booking
    </router-link>

    <router-link v-else-if="needsLogin" class="btn btn-brand-outline w-100 button" to="/login">
        Log in to request a booking
    </router-link>
</template>

<style scoped>
.button {
  margin-top: 1rem;
  padding: 0.55rem 0.95rem;
  font-weight: 600;
}
</style>
