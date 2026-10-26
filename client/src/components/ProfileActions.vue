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
    <router-link v-if="editable" class="btn btn-sm button" style="background-color:#a85a38;" to="/editProfile">
        Edit Details
    </router-link>

    <router-link v-else-if="canRequestBooking" class="btn btn-sm button" style="background-color:#a85a38;" :to="{ path: '/bookings/new', query: { sitterId: profile._id } }">
        Request Booking
    </router-link>

    <router-link v-else-if="needsLogin" class="btn btn-sm btn-outline-dark button" to="/login">
        Log in to request a booking
    </router-link>
</template>

<style scoped>
.button {
  padding: 0.4rem 0.95rem;
  border: 0;
  background: #a85a38;
  color: #fff;
  font-weight: 600;
}
</style>