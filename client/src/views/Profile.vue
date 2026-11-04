<script setup>
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { currentUser, fetchUser } from "../services/auth.js";
import ProfileHeader from '../components/ProfileHeader.vue';
import OwnerDetails from '../components/OwnerDetails.vue'
import SitterDetails from '../components/SitterDetails.vue'
import { usersApi } from '../services/api.js'
import SitterReviews from '../components/SitterReview.vue'
import { useGoBack } from '../utils/backButton.js';
import BackButton from '../components/BackButton.vue';

const route = useRoute()
const router = useRouter()
const profile = ref(null)
const error = ref('')
const isMine = computed(() => !route.params.id || route.params.id === currentUser.value?._id)

const { goBack } = useGoBack()  

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

onMounted(() => {
  if (isMine.value) {
    fetchUser()
  }
})

</script>

<template>
  <div class="pf">
  
    <!-- to go back (for when viewing another person's profile) -->
    <BackButton v-if="!isMine" label="Back" />
    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-else-if="!profile" class="d-flex align-items-center text-muted">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Loading profile…
    </div>

    <template v-else-if="profile">
      <div class="d-flex flex-wrap align-items-center justify-content-between border-bottom pb-2 mb-3">
        <h3 class="page-title">{{ isMine ? 'My Profile' : `${profile.username}'s Profile` }}</h3>
      </div>

      <div class="row g-3">
        <div class="col-12 col-md-4 col-lg-3 d-flex">
          <ProfileHeader :profile="profile" :editable="isMine" />
        </div>

        <div class="col-12 col-md-8 col-lg-9">
          <OwnerDetails v-if="profile.role === 'owner'"
              :owner-id="profile._id"
              :owner-name="profile.username"
              :editable="isMine"
              :profile="profile" />
          <SitterDetails v-else :profile="profile" :editable="isMine" />
        </div>
      </div>
      <SitterReviews v-if="profile.role === 'sitter'" :sitter-id="profile._id" class="mt-3"/>
      <SitterReviews v-else-if="profile.role === 'owner'" :sitter-id="profile._id" mode="given" class="mt-3"/>
    </template>
  </div>
</template>