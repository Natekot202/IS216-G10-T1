<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { currentUser } from "../services/auth.js";
import ProfileHeader from '../components/ProfileHeader.vue';
import OwnerDetails from '../components/OwnerDetails.vue'
import SitterDetails from '../components/SitterDetails.vue'
import { usersApi } from '../services/api.js'
import SitterReviews from '../components/SitterReview.vue'
import ProfileActions from '../components/ProfileActions.vue'

const route = useRoute()
const profile = ref(null)
const error = ref('')
const isMine = computed(() => !route.params.id || route.params.id === currentUser.value?._id)

async function load() {
  error.value = ''
  profile.value = null
  if (isMine.value) { 
    profile.value = currentUser.value; return 
  } try {
    profile.value = await usersApi.getById(route.params.id)
  } catch (err) {
    error.value = err.response?.status === 401 ? 'Log in to view this profile.' : 'Profile not found.'
  }
}
watch([() => route.params.id, currentUser], load, { immediate: true })
</script>

<template>
  <div class="container-fluid mt-1 mb-4">
    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <template v-else-if="profile">
      <div class="d-flex flex-wrap align-items-center justify-content-between border-bottom pb-2 mb-3">
        <h3 class="page-title">{{ isMine ? 'My Profile' : `${profile.username}'s Profile` }}</h3>
        <ProfileActions :profile="profile" :editable="isMine" />
      </div>

      <div class="row g-3">
        <div class="col-12 col-md-4 col-lg-3">
          <ProfileHeader :profile="profile" :editable="isMine" />
        </div>

        <div class="col-12 col-md-8 col-lg-9">
          <OwnerDetails v-if="profile.role === 'owner'"
              :owner-id="profile._id"
              :owner-name="profile.username"
              :editable="isMine" />
          <SitterDetails v-else :profile="profile" :editable="isMine" />
        </div>
      </div>
      <div v-if="profile.role === 'sitter'" class="mt-4">
        <SitterReviews :sitter-id="profile._id" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.page-title {
  font-family: 'fredoka', sans-serif;
  font-size: 1.9rem;
  font-weight: 600; 
  letter-spacing: -0.01em;
  margin-bottom: 0;
}
</style>