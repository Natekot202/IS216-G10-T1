<script setup>

import { currentUser } from "../services/auth.js";

</script>

<template>
  <div class="p-5 mb-4 rounded-3">
    <div class="container-fluid py-4">
      <h1 v-if="currentUser" class="display-5 fw-bold">Welcome back, {{ currentUser.username }}🐾</h1>
      <h1 v-else class="display-5 fw-bold">Welcome to Pet Society🐾</h1>

      <p class="col-md-8 fs-5">
        A community platform for you to find a trusted sitter! 
      </p>
      <router-link v-if='!currentUser' class="btn btn-lg text-white" style="background-color:#c47756;" to="/login">
        Get Started
      </router-link>
      <router-link v-else-if="currentUser.role === 'owner'" class="btn btn-lg text-white" style="background-color:#c47756;" to="/pets">
        Browse Pets
      </router-link>
    </div>
  </div>
</template>
