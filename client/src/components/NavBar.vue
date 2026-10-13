<script setup>

import { computed, ref, watch } from 'vue'
import { useRoute, useRouter  } from 'vue-router'
import { currentUser, logout } from "../services/auth.js";

const route = useRoute()
const router = useRouter()
const hideElem = computed(() => route.meta.hideElem === true)

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
        aria-label="Toggle navigation"
        :aria-expanded="open"
        @click="open = !open"
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <div
        class="collapse navbar-collapse flex-md-column align-items-md-stretch flex-md-grow-1 mt-md-4"
        :class="{ show: open }"
      >        
        <ul class="navbar-nav flex-md-column mb-md-auto">
            <li v-if="!hideElem" class="nav-item">
              <router-link class="nav-link" to="/">Home</router-link>
            </li>
            <li v-if="!hideElem" class="nav-item">
              <router-link class="nav-link" to="/profile">Profile</router-link>
            </li>
            <li v-if="currentUser?.role === 'owner' && !hideElem" class="nav-item">
              <router-link class="nav-link" to="/pets">Pets</router-link>
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