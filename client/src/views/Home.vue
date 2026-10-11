<script setup>

import { currentUser } from "../services/auth.js";

</script>

<template>
  <div class="p-5 mb-4 bg-light rounded-3">
    <div class="container-fluid py-4">
      <h1 v-if="currentUser" class="display-5 fw-bold">Welcome back, {{ currentUser.username }}🐾</h1>
      <h1 v-else class="display-5 fw-bold">Welcome to Pet Society🐾</h1>

      <p class="col-md-8 fs-5">
        A community platform for pet lovers - find, list, and connect
        over pets that need a home. 
      </p>
    <router-link v-if="isOwner" class="btn btn-primary btn-lg" to="/pets">My Pets</router-link>
    <router-link v-else-if="!currentUser" class="btn btn-primary btn-lg" to="/register">Get Started</router-link>
    </div>
  </div>
</template>
