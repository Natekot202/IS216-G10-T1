<script setup>
// /owner/bookings: one card per trip (group) plus single-sitter requests.
import { ref, computed, onMounted } from 'vue'
import { API } from "../services/api.js";
import GroupCard from '../components/GroupCard.vue'
import { groupBookings } from '../utils/bookingHelpers'

import {sampleBookings} from '../sampleData/bookings.js'

const bookings = ref([])
const loading = ref(true)
const error = ref('')

const items = computed(() => groupBookings(bookings.value))
/*
onMounted(async () => {
  try {
    const res = await API.get('/bookings') // ASSUMPTION: api.js baseURL already ends in /api
    bookings.value = res.data
  } catch (err) {
    error.value = 'Could not load your bookings. Check your connection and refresh the page.'
  } finally {
    loading.value = false
  }
})
*/

onMounted(()=>{
bookings.value = sampleBookings;
loading.value = false;
})
</script>

<template>
  <div class="container py-4">
    <h1 class="mb-4">My Bookings</h1>

    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
    </div>

    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-else-if="items.length === 0" class="text-center py-5">
      <p class="text-muted">You haven't sent any booking requests yet.</p>
      <router-link to="/search" class="btn btn-primary">Find a sitter</router-link>
    </div>

    <div v-else class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
      <div v-for="item in items" :key="item.key" class="col">
        <!-- 2+ requests with the same groupId -> group card; otherwise a normal booking card -->
        <GroupCard :group="item" />
      </div>
    </div>
  </div>
</template>
