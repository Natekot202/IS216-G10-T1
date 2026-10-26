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
    <h5 style="color:black; font-weight:700;">About</h5>
    <p class="ph-bio">{{ profile.bio || 'No bio yet.' }}</p>  
  </div>
</template>

<style scoped>
.ph-card {
  padding: 1.25rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #c47756;           
  border-radius: 20px;
  background: #f6e3d6;                   
  box-shadow: 0 8px 20px rgba(120, 70, 40, 0.14);
}

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
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 1.6rem;
  font-weight: 700;
  line-height: 1.15;
  color: black;
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
  color: black;
  overflow-wrap: anywhere;
}
</style>