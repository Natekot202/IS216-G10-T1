<script setup>
import defaultAvatar from '../assets/img/tempProfile.jpg'

const props = defineProps({
  profile: { type: Object, required: true },
  editable: { type: Boolean, default: false }
})

</script>

<template>
  <div class="ph-card">
    <img :src="profile.profilePicture?.url || defaultAvatar" alt="Profile picture" class="ph-photo" />
    <p class="ph-name">{{ profile.username }}</p>
    <p v-if="editable && profile.email" class="ph-email">{{ profile.email }}</p>
    <h5 v-if="profile.role === 'sitter'" style="font-family: 'Trirong', serif; font-weight:700;">About</h5>
    <p class="ph-bio">{{ profile.bio || 'No bio yet.' }}</p>  
  </div>
</template>

<style scoped>
.ph-photo {
  display: block;
  width: 100%;
  max-width: 220px;
  aspect-ratio: 1;
  margin-bottom: 1rem;
  border-radius: 20px;
  object-fit: cover;
}
.ph-name {
  margin: 0 0 0.15rem;
  font-family: 'Trirong', serif;
  font-size: 1.8rem;
  font-weight: 700;
  line-height: 1.15;
  color: #2b2420;
}
.ph-email {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #5c524b;
  overflow-wrap: anywhere;
}
.ph-bio {
  max-width: 30ch;
  margin: 0.5rem 0 1rem;
  color: #2b2420;
  overflow-wrap: anywhere;
}
</style>