<script setup>
import { ref, computed, watch } from 'vue'
import { bookingsApi } from '../services/bookingApi.js'
import { summariseTasks, petNamesFor, scheduleText, daysText } from '../utils/taskListHelpers.js'

const props = defineProps({
  booking: { type: Object, required: true }
})

const showAll = ref(false)
const taskItems = ref([]) // the care tasks saved with this booking
// Load them from the server for this booking (and again if the booking changes)
watch(
  () => props.booking?._id,
  async (id) => {
    try {
      taskItems.value = id ? (await bookingsApi.getCareTasks(id)).items : []
    } catch {
      taskItems.value = []
    }
  },
  { immediate: true }
)
const taskSummary = computed(() => summariseTasks(taskItems.value, props.booking))
</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="small text-uppercase text-muted mb-0">Tasks</h6>
      <button
        v-if="taskItems.length"
        type="button"
        class="btn btn-link btn-sm p-0 text-decoration-none toggle-link"
        @click="showAll = !showAll"
      >
        {{ showAll ? 'Hide full details ▲' : 'Show full details ▼' }}
      </button>
    </div>

    <p v-if="!taskItems.length" class="small text-muted mb-0">No tasks added yet.</p>

    <ul v-else-if="!showAll" class="list-unstyled mb-0">
      <li
        v-for="(cat, index) in taskSummary"
        :key="index"
        class="d-flex justify-content-between flex-wrap gap-1 small py-1"
      >
        <span class="fw-semibold text-capitalize">{{ cat.category }}</span>
        <span class="text-muted">{{ cat.dailyFrequency }} per day · {{ cat.bookingFrequency }} per booking</span>
      </li>
    </ul>

    <div v-else>
      <div v-for="(task, i) in taskItems" :key="i" class="border rounded p-2 mb-2 bg-white">
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

          <template v-if="task.category === 'feed' && task.food">
            <dt class="col-4 col-sm-3">Food</dt>
            <dd class="col-8 col-sm-9">{{ task.amount }} {{ task.unit }} {{ task.food }}</dd>
          </template>

          <template v-if="task.category === 'walk' && (task.distanceKm || task.durationMinutes)">
            <dt class="col-4 col-sm-3">Walk</dt>
            <dd class="col-8 col-sm-9">
              <span v-if="task.distanceKm">{{ task.distanceKm }} km</span>
              <span v-if="task.distanceKm && task.durationMinutes"> · </span>
              <span v-if="task.durationMinutes">{{ task.durationMinutes }} min</span>
            </dd>
          </template>

          <template v-if="task.category === 'groom' && task.service">
            <dt class="col-4 col-sm-3">Service</dt>
            <dd class="col-8 col-sm-9">{{ task.service.replace('-', ' ') }}</dd>
          </template>

          <template v-if="task.category === 'medication'">
            <dt v-if="task.medicationName" class="col-4 col-sm-3">Medicine</dt>
            <dd v-if="task.medicationName" class="col-8 col-sm-9">
              {{ task.medicationName }}<span v-if="task.dosage"> · {{ task.dosage }}</span>
            </dd>
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
            class="rounded task-photo"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toggle-link {
  color: #2f6f62;
}
.task-photo {
  height: 64px;
  width: 64px;
  object-fit: cover;
}
</style>