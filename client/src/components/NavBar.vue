<script setup>

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter  } from 'vue-router'
import { currentUser, logout } from "../services/auth.js";

const route = useRoute()
const router = useRouter()

const hideElem = computed(() => route.meta.hideElem === true)
const hideLinks = computed(() => route.meta.hideLinks === true)

const searchLink = computed(() => (currentUser.value ? '/home' : '/browse'))
const open = ref(false);

watch(() => route.fullPath, () => { open.value = false; });

async function handleLogout() {
  await logout();
  router.push("/");
}

</script>

<template>
  <nav class="navbar navbar-expand-md navbar-dark sidebar">
    <div class="container-fluid flex-md-column align-items-md-stretch">
    <router-link class="navbar-brand" to="/">
      <span class="brand-emoji">🐾</span> PetSociety
    </router-link>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarSupportedContent"
        aria-controls="navbarSupportedContent" 
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div
        class="collapse navbar-collapse flex-md-column align-items-md-stretch flex-md-grow-1 mt-md-4"
        id="navbarSupportedContent"
      >        
        <ul class="navbar-nav flex-md-column mb-md-auto">
            <li v-if="!hideElem && !hideLinks" class="nav-item">
              <router-link class="nav-link" :to="searchLink">{{ currentUser?.role === 'sitter' ? 'Home' : 'Search Sitters' }}</router-link>
            </li>
            <li v-if="currentUser?.role === 'owner' && !hideElem" class="nav-item">
              <router-link class="nav-link" to="/owner/bookings">My Bookings</router-link>
            </li>
            <li v-if="currentUser?.role === 'sitter' && !hideElem" class="nav-item">
              <router-link class="nav-link" to="#" active-class="" exact-active-class="">My Calendar</router-link>
            </li>
            <li v-if="currentUser?.role === 'sitter' && !hideElem" class="nav-item">
              <router-link class="nav-link" to="/sitter/requests">Booking Requests</router-link>
            </li>
            <li v-if="currentUser?.role === 'sitter' && !hideElem" class="nav-item">
              <router-link class="nav-link" to="#" active-class="" exact-active-class="">My Reviews</router-link>
            </li>
            <li v-if="currentUser && !hideElem" class="nav-item">
              <router-link class="nav-link" to="/profile"> My Profile</router-link>
            </li>
            <li v-if="currentUser?.role === 'owner' && !hideElem" class="nav-item">
              <router-link class="nav-link" to="/pets">My Pets</router-link>
            </li>
        </ul>
        <div class="mt-3 mt-md-auto pb-2 pb-md-0">
          <template v-if="currentUser">
            <button class="btn text-white w-100" style="background-color:#c44f1c;" @click="handleLogout">Log out</button>
          </template>
          <router-link v-else-if="!hideElem" class="btn text-white w-100" style="background-color:#c44f1c;" to="/login">Log in</router-link>
        </div>
      </div>
    </div>
  </nav>
</template>