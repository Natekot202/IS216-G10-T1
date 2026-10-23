<script setup>

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter  } from 'vue-router'
import { currentUser, logout } from "../services/auth.js";

const route = useRoute()
const router = useRouter()

const hideElem = computed(() => route.meta.hideElem === true)
const searchLink = computed(() => (currentUser.value ? '/home' : '/browse'))

const open = ref(false);

watch(() => route.fullPath, () => {
  open.value = false; 
});

watch(open, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

function onKey(e) {
  if (e.key === 'Escape') {
    open.value = false
  }
}

function onResize() {
  if (window.innerWidth >= 992) {
    open.value = false
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', onResize)
  document.body.style.overflow = ''
})

async function handleLogout() {
  open.value = false
  await logout();
  router.push("/");
}

</script>

<template>
  <nav class="topbar navbar navbar-expand-lg navbar-dark">
    <div class="container-fluid">
    <router-link class="navbar-brand" to="/">
      <span class="brand-emoji">🐾</span> PetSociety
    </router-link>
      <template v-if="!hideElem">
        <button class="navbar-toggler" type="button" aria-label="Open menu"
                :aria-expanded="open" @click="open = !open">
          <span class="navbar-toggler-icon"></span>
        </button>

        <div v-if="open" class="nav-backdrop" @click="open = false"></div>
        <div class="nav-menu" :class="{ 'nav-menu--open': open }">
          <button type="button" class="btn-close btn-close-white d-lg-none ms-auto mb-3"
                  aria-label="Close menu" @click="open = false"></button>
          <ul class="navbar-nav ms-lg-auto align-items-lg-center">
              <li v-if="!hideElem" class="nav-item">
                <router-link class="nav-link" :to="searchLink">{{ currentUser?.role === 'sitter' ? 'Home' : 'Search Sitters' }}</router-link>
              </li>
              <li v-if="currentUser?.role === 'owner' && !hideElem" class="nav-item">
                <router-link class="nav-link" to="/owner/bookings">My Bookings</router-link>
              </li>
              <li v-if="currentUser?.role === 'sitter' && !hideElem" class="nav-item">
                <router-link class="nav-link" to="/sitter/calendar">My Calendar</router-link>
              </li>
              <li v-if="currentUser?.role === 'sitter' && !hideElem" class="nav-item">
                <router-link class="nav-link" to="/sitter/requests">Booking Requests</router-link>
              </li>
              <li v-if="currentUser?.role === 'sitter' && !hideElem" class="nav-item">
                <router-link class="nav-link" to="/sitter/reviews">Reviews & Ratings</router-link>
              </li>
              <li v-if="currentUser && !hideElem" class="nav-item">
                <router-link class="nav-link" to="/profile"> My Profile</router-link>
              </li>
          </ul>
          <div class="nav-account ms-lg-3">
            <button v-if="currentUser" class="btn text-white" style="background-color:#c44f1c;"
                    @click="handleLogout">
              Log out
            </button>
            <router-link v-else class="btn text-white" style="background-color:#c44f1c;" to="/login">
              Log in
            </router-link>
          </div>
        </div>
      </template>
    </div>
  </nav>
</template>