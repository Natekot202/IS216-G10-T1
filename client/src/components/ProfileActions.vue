<script setup>
import { computed } from 'vue'
import { currentUser } from '../services/auth.js'

const props = defineProps({
  profile: { type: Object, required: true },
  editable: { type: Boolean, default: false }
})

const canRequestBooking = computed(() => 
  !props.editable && props.profile.role === 'sitter' && currentUser.value?.role === 'owner'
)

const needsLogin = computed(() => 
  !props.editable && props.profile.role === 'sitter' && !currentUser.value
)

</script>

<template>
    <!-- sits full width in the profile card, under the name and bio -->
    <router-link v-if="editable" class="btn btn-brand w-100 button" to="/editProfile">
        Edit Details
    </router-link>

    <router-link v-else-if="canRequestBooking" class="btn btn-brand w-100 button" :to="{ path: '/bookings/new', query: { sitterId: profile._id } }">
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
