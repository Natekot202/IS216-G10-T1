<script setup>
// The care details the owner added to one task, to read only.
// Shows nothing if the task has no details.
import { computed } from 'vue'

const props = defineProps({
  task: { type: Object, required: true }
})

const details = computed(() => props.task.details ?? {})

// "1.5 scoops of kibble"
const feedText = computed(() => {
  const { amount, unit, food } = details.value
  if (props.task.category !== 'feed') return ''
  const hasAmount = amount !== undefined && amount !== null
  const size = hasAmount ? `${amount} ${unit ?? ''}${amount > 1 && unit !== 'g' ? 's' : ''}`.trim() : ''
  return size && food ? `${size} of ${food}` : size || food || ''
})

// "Heartworm chewable, 1 tablet, with food"
const medicationText = computed(() => {
  const { medicationName, dosage, withFood } = details.value
  if (props.task.category !== 'medication') return ''
  return [medicationName, dosage, withFood ? 'with food' : ''].filter(Boolean).join(', ')
})

const timesText = computed(() => (details.value.times?.length ? `At ${details.value.times.join(', ')}` : ''))
</script>

<template>
  <div v-if="feedText || medicationText || timesText || details.instructions" class="care-summary small">
    <div v-if="feedText">{{ feedText }}</div>
    <div v-if="medicationText">{{ medicationText }}</div>
    <div v-if="timesText">{{ timesText }}</div>
    <div v-if="details.instructions" class="care-summary__text">{{ details.instructions }}</div>
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
