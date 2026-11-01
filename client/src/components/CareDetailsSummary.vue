<script setup>
// The care details the owner added to one task, to read only.
// Shows nothing if the task has no details.
import { computed } from 'vue'
import { feedText as feedFor, hasDetails, medicationText as medicationFor } from '../utils/careDetails.js'
import TaskPhotos from './TaskPhotos.vue'

const props = defineProps({
  task: { type: Object, required: true }
})

const details = computed(() => props.task.details ?? {})
const feedText = computed(() => feedFor(props.task))
const medicationText = computed(() => medicationFor(props.task))

const timesText = computed(() => (details.value.times?.length ? `At ${details.value.times.join(', ')}` : ''))
</script>

<template>
  <div v-if="hasDetails(task)" class="care-summary small">
    <div v-if="feedText">{{ feedText }}</div>
    <div v-if="medicationText">{{ medicationText }}</div>
    <div v-if="timesText">{{ timesText }}</div>
    <div v-if="details.instructions" class="care-summary__text">{{ details.instructions }}</div>
    <TaskPhotos v-if="details.referencePhotos?.length" :photos="details.referencePhotos" />
  </div>
</template>

<style scoped>
.care-summary {
  margin-top: 0.35rem;
  color: #5c524b;
  overflow-wrap: anywhere;
}
.care-summary__text {
  white-space: pre-line; /* keeps the owner's line breaks */
}
</style>
