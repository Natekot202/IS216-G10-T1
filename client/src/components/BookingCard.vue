<script setup>
// One booking request (one sitter). Used on My Bookings for requests that are
// not part of a group, and on the group page for every request in the group.
import {ref, computed} from "vue";

import StatusPill from './StatusPill.vue'
import { sitterName, petNames, formatDateRange, formatPrice } from '../utils/bookingHelpers'
import {findTasklist, summariseTasks, petNamesFor, scheduleText, daysText} from '../utils/taskListHelpers.js'


const props = defineProps({
  booking: {
    type: Object,
    required: true
  }
})

const expanded = ref(false);
const tasklist = computed(() => {
  return props.booking?._id ? findTasklist(props.booking._id) : null
})

const taskSummary = computed(()=> {
  const result = summariseTasks(tasklist.value.items, props.booking)
  console.log(`taskSummary` + result)
  return result
})

</script>

<template>
  <div class="card h-100 shadow-sm" :class="{ 'opacity-75': booking.status === 'declined' }">
    <div class="card-body d-flex flex-column">
      <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
        <h5 class="card-title mb-0">{{ sitterName(booking) }}</h5>
        <StatusPill :status="booking.status" />
      </div>
      <p class="fw-semibold mb-3">{{ formatPrice(booking.totalPrice) }}</p>
      <button
        type="button"
        class="btn btn-outline-secondary btn-sm mb-2 align-self-start text-decoration-none"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Hide details ▲' : 'Show details ▼' }}
      </button>

      <div v-if="!expanded" :id="`details-${booking._id}`" class="border-top pt-2 mb-3">
        <h6 class="small text-uppercase text-muted mb-2">Tasks</h6>
        <ul v-if="taskSummary.length" class="list-unstyled mb-2">
          <li
            v-for="(taskcat, index) in taskSummary"
            :key="index"
            class="d-flex justify-content-between flex-wrap gap-1 small py-1"
          >
            <span class="fw-semibold">{{ taskcat.category }}</span>
            <span class="text-muted">
              {{ taskcat.dailyFrequency }} per day · {{ taskcat.bookingFrequency }} per booking
            </span>
          </li>
        </ul>
        <p v-else class="small text-muted mb-2">No tasks added yet.</p>
      </div>  
      <div v-else>
        <h6 class="small text-uppercase text-muted mt-3 mb-2">Task details</h6>
        <p v-if="!tasklist.items.length" class="small text-muted">No tasks added yet.</p>
          <div v-for="(task, i) in tasklist.items" :key="i" class="border rounded p-2 mb-2">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="fw-semibold">{{ task.title }}</div>
                <div class="small text-muted">
                  {{ task.category }}
                  <span v-if="petNamesFor(task, booking)"> · {{ petNamesFor(task, booking) }}</span>
                </div>
              </div>
              <span v-if="task.requiresPhoto" class="badge text-bg-light border">📷 Photo required</span>
    </div>

    <dl class="row small mb-0 mt-2">
      <dt class="col-4 col-sm-3">When</dt>
      <dd class="col-8 col-sm-9">{{ scheduleText(task) }}</dd>

      <dt class="col-4 col-sm-3">Days</dt>
      <dd class="col-8 col-sm-9">{{ daysText(task) }}</dd>

      <!-- feed -->
      <template v-if="task.category === 'feed'">
        <dt class="col-4 col-sm-3">Food</dt>
        <dd class="col-8 col-sm-9">{{ task.amount }} {{ task.unit }} {{ task.food }}</dd>
      </template>

      <!-- walk -->
      <template v-if="task.category === 'walk'">
        <dt class="col-4 col-sm-3">Walk</dt>
        <dd class="col-8 col-sm-9">
          <span v-if="task.distanceKm">{{ task.distanceKm }} km</span>
          <span v-if="task.distanceKm && task.durationMinutes"> · </span>
          <span v-if="task.durationMinutes">{{ task.durationMinutes }} min</span>
        </dd>
      </template>

      <!-- groom -->
      <template v-if="task.category === 'groom' && task.service">
        <dt class="col-4 col-sm-3">Service</dt>
        <dd class="col-8 col-sm-9">{{ task.service.replace('-', ' ') }}</dd>
      </template>

      <!-- medication -->
      <template v-if="task.category === 'medication'">
        <dt v-if="task.medicationName" class="col-4 col-sm-3">Medicine</dt>
        <dd v-if="task.medicationName" class="col-8 col-sm-9">{{ task.medicationName }}<span v-if="task.dosage"> · {{ task.dosage }}</span></dd>
        <dt v-if="task.withFood" class="col-4 col-sm-3">Note</dt>
        <dd v-if="task.withFood" class="col-8 col-sm-9">Give with food</dd>
      </template>

      <template v-if="task.instructions">
        <dt class="col-4 col-sm-3">Instructions</dt>
        <dd class="col-8 col-sm-9">{{ task.instructions }}</dd>
      </template>
    </dl>
    <div v-if="task.referencePhotos?.length" class="d-flex flex-wrap gap-2 mt-2">
      <img
        v-for="p in task.referencePhotos"
        :key="p.url"
        :src="p.url"
        :alt="p.caption || 'Reference photo'"
        class="rounded"
        style="height: 64px; width: 64px; object-fit: cover"
      />
    </div>
  </div>




      </div> 
      <div class="mt-auto d-flex flex-wrap gap-2">
        <router-link
          v-if="booking.status === 'accepted'"
          :to="`/bookings/${booking._id}/pay`"
          class="btn btn-primary btn-sm"
        >
          Pay now
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .petNames{
    color: #2f6f62
  }
</style>
