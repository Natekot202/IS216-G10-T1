<script setup>
import { onMounted, ref } from 'vue';
import { currentUser } from "../services/auth.js";
import PetCard from '../components/PetCard.vue';
import { petsApi } from '../services/api'

const pets = ref([])
const error = ref('')

async function loadPets() {
  error.value = ''
  try {
    pets.value = await petsApi.getAll()
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load pet.'
    console.error(err)
  } 
}
onMounted(loadPets)
</script>

<template>
  <div class="container mt-4 mb-5">
    <div class="d-flex align-items-center gap-3">
      <h2 class="mb-0">Your Profile</h2>
      <router-link class="btn btn-sm text-white" style="background-color:#c47756;" to="/">
        Edit
      </router-link>
    </div>
    <div class="row">
        <div class="col">
    <p
      class="text-break rounded p-2 w-50"
      :class="currentUser?.bio ? 'border border-secondary' : 'border border-secondary border-dashed text-muted fst-italic'">
        {{ currentUser?.bio || 'Tell us more about yourself!' }}
    </p>
        </div>
    </div>

    <div class="container mt-2 mb-5" v-if="currentUser.role === 'owner'">
      <h3>Your Pets</h3>
      <div v-if="!pets.length" class="text-muted">
        No pets yet &mdash;
        <router-link class="link" style="color:#c44f1c;" to="/pets">Add here!</router-link>
      </div>
      <div v-else class="row g-3">
        <PetCard v-for="pet in pets" :key="pet._id" :pet="pet"/>
      </div>
    </div>

    <div class="container my-2">
      <h3>Reviews and Ratings</h3>
    </div>

  </div>
</template>