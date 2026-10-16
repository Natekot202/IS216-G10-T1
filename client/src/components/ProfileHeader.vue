<script setup>
import defaultAvatar from '../assets/img/tempProfile.jpg'

defineProps({
  profile: { type: Object, required: true },
  editable: { type: Boolean, default: false }
})

</script>

<template>
  <div class="p-2">
    <img
      :src="profile.profilePicture?.url || defaultAvatar"
      alt="Profile picture"
      class="rounded mb-2"
      width="300"
      style="aspect-ratio: 1; object-fit: cover;"/>
    <p class="fw-bold mb-1">{{ profile.username }}</p>
    <p v-if="editable && profile.email" class="text-muted mb-2">{{ profile.email }}</p>
    <p class="text-break">{{ profile.bio || 'No bio yet.' }}</p>

    <router-link
      v-if="editable"
      class="btn btn-sm text-white"
      style="background-color:#c47756;"
      to="/editProfile">
      Edit Details
    </router-link>
  </div>
</template>