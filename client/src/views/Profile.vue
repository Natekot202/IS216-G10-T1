<script setup>
import { currentUser } from "../services/auth.js";

</script>

<template>
  <div class="container my-4" v-if="currentUser">
    <h1 class="display-5" style="font-family:'Trebuchet MS', 'Lucida Sans Unicode', 'Lucida Grande', 'Lucida Sans', Arial, sans-serif">
        {{ currentUser.username }}'s profile</h1>
    <div class="row">
        <div class="col">
    <p
      class="text-break rounded p-2 w-50"
      :class="currentUser?.bio ? 'border border-info' : 'border border-secondary border-dashed text-muted fst-italic'">
        {{ currentUser?.bio || 'Tell us more about yourself!' }}
    </p>
        </div>
    </div>

  </div>
  <p v-else class="container my-4">
    Want your own profile? 
    <router-link to="/login">Log in here!</router-link>
  </p>
</template>