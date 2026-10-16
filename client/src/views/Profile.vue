<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { currentUser } from "../services/auth.js";
import ProfileHeader from '../components/ProfileHeader.vue';
import OwnerDetails from '../components/OwnerDetails.vue'
import SitterDetails from '../components/SitterDetails.vue'
import { usersApi } from '../services/api.js'


const route = useRoute()
const profile = ref(null)
const error = ref('')
const isMine = computed(() => !route.params.id || route.params.id === currentUser.value?._id)

async function load() {
  error.value = ''
  profile.value = null
  if (isMine.value) { 
    profile.value = currentUser.value; r
    eturn 
  } try {
    profile.value = await usersApi.getById(route.params.id)
  } catch (err) {
    error.value = err.response?.status === 401 ? 'Log in to view this profile.' : 'Profile not found.'
  }
}
watch([() => route.params.id, currentUser], load, { immediate: true })
</script>

<template>
  <div class="container mt-1 mb-4">
    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <template v-else-if="profile">
      <div class="border-bottom pb-2 mb-3">
        <h3 class="mb-0">{{ isMine ? 'My Profile' : `${profile.username}'s Profile` }}</h3>
      </div>

      <div class="row g-3">
        <div class="col-12 col-md-4">
          <ProfileHeader :profile="profile" :editable="isMine" />
        </div>

        <div class="col-12 col-md-8">
          <OwnerDetails v-if="profile.role === 'owner'" :owner-id="profile._id" :editable="isMine" />
          <SitterDetails v-else :profile="profile" :editable="isMine" />
        </div>
      </div>
    </template>
  </div>
</template>