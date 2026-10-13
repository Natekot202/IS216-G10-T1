<script setup>

import NavBar from './components/NavBar.vue'
import { onMounted } from "vue";
import { fetchUser } from "./services/auth.js";

onMounted(fetchUser);

</script>

<template>
  <div class="app-layout">
    <NavBar />
    <main class="container py-4">
      <router-view />
    </main>
  </div>
</template>
