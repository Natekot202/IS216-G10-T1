<script setup>
// The owner's form for the extra care details on a confirmed booking (used on the Booking Detail page).
// Everything here is optional: the booking still works if the owner skips a field or the whole form.
import { ref } from 'vue'
import { bookingsApi } from '../services/bookingApi.js'
import { SERVICE_LABELS } from '../utils/servicePrices.js'

const props = defineProps({
  bookingId: { type: String, required: true },
  tasks: { type: Array, required: true }, // the booking's care tasks
  closeText: { type: String, default: 'Add later' }
})
const emit = defineEmits(['saved', 'close'])

const UNITS = ['cup', 'g', 'scoop', 'can']

// What the instructions box suggests for each type of task
const INSTRUCTION_HINTS = {
  feed: 'e.g. The food is in the top cupboard. Please top up the water too.',
  walk: 'e.g. The leash is on the hook by the door. Please avoid the dog park.',
  groom: 'e.g. The brush is in the bathroom drawer. Go gently around the ears.',
  medication: 'e.g. Hide the tablet in a treat. Call me if it gets refused.',
  clean: 'e.g. The scoop and bags are under the sink.',
  play: 'e.g. The feather toy is in the basket by the sofa.'
}

// One set of form values per task, starting from anything already saved.
// `times` has one box for each time a day, so a task done twice a day shows two boxes.
const forms = ref(props.tasks.map((task) => {
  const saved = task.details ?? {}
  return {
    taskId: task._id,
    instructions: saved.instructions ?? '',
    times: Array.from({ length: task.dailyFrequency }, (_, i) => saved.times?.[i] ?? ''),
    food: saved.food ?? '',
    amount: saved.amount ?? '',
    unit: saved.unit ?? 'cup',
    medicationName: saved.medicationName ?? '',
    dosage: saved.dosage ?? '',
    withFood: saved.withFood ?? false
  }
}))

const saving = ref(false)
const error = ref('')

async function save() {
  saving.value = true
  error.value = ''
  try {
    const tasks = forms.value.map(({ taskId, ...details }) => ({ taskId, details }))
    emit('saved', await bookingsApi.saveCareDetails(props.bookingId, tasks))
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not save the care details.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form @submit.prevent="save">
    <p class="small text-muted">
      These help the sitter care for your pets. All of them are optional, and you can change them until the first session starts.
    </p>

    <fieldset v-for="(task, i) in tasks" :key="task._id" class="care-task" :disabled="saving">
      <legend class="care-task__title">
        {{ task.title }}
        <small class="text-muted d-block">{{ SERVICE_LABELS[task.category] }}</small>
      </legend>

      <!-- feed tasks -->
      <div v-if="task.category === 'feed'" class="row g-2 mb-2">
        <div class="col-12 col-sm-6">
          <label :for="`food-${i}`" class="form-label small mb-1">Food</label>
          <input :id="`food-${i}`" v-model="forms[i].food" class="form-control form-control-sm" maxlength="100" placeholder="e.g. Kibble" />
        </div>
        <div class="col-6 col-sm-3">
          <label :for="`amount-${i}`" class="form-label small mb-1">Amount (recommended)</label>
          <input :id="`amount-${i}`" v-model.number="forms[i].amount" type="number" min="0" step="any" class="form-control form-control-sm" />
        </div>
        <div class="col-6 col-sm-3">
          <label :for="`unit-${i}`" class="form-label small mb-1">Unit</label>
          <select :id="`unit-${i}`" v-model="forms[i].unit" class="form-select form-select-sm">
            <option v-for="unit in UNITS" :key="unit" :value="unit">{{ unit }}</option>
          </select>
        </div>
      </div>

      <!-- medication tasks -->
      <div v-if="task.category === 'medication'" class="row g-2 mb-2">
        <div class="col-12 col-sm-6">
          <label :for="`medicine-${i}`" class="form-label small mb-1">Medicine name</label>
          <input :id="`medicine-${i}`" v-model="forms[i].medicationName" class="form-control form-control-sm" maxlength="100" />
        </div>
        <div class="col-12 col-sm-6">
          <label :for="`dosage-${i}`" class="form-label small mb-1">Dosage (recommended)</label>
          <input :id="`dosage-${i}`" v-model="forms[i].dosage" class="form-control form-control-sm" maxlength="100" placeholder="e.g. 1 tablet" />
        </div>
        <div class="col-12">
          <div class="form-check">
            <input :id="`with-food-${i}`" v-model="forms[i].withFood" class="form-check-input" type="checkbox" />
            <label :for="`with-food-${i}`" class="form-check-label small">Give with food</label>
          </div>
        </div>
      </div>

      <!-- every task -->
      <div class="mb-2">
        <span class="form-label small mb-1 d-block">
          {{ task.dailyFrequency > 1 ? `Times (${task.dailyFrequency} a day, or leave them all empty)` : 'Time' }}
        </span>
        <div class="d-flex flex-wrap gap-2">
          <input v-for="(_, t) in forms[i].times" :key="t" v-model="forms[i].times[t]" type="time"
                 class="form-control form-control-sm care-time" :aria-label="`${task.title}, time ${t + 1}`" />
        </div>
      </div>
      <label :for="`instructions-${i}`" class="form-label small mb-1">Instructions</label>
      <textarea :id="`instructions-${i}`" v-model="forms[i].instructions" class="form-control form-control-sm" rows="2"
                maxlength="1000" :placeholder="INSTRUCTION_HINTS[task.category]"></textarea>
    </fieldset>

    <div v-if="error" class="alert alert-warning mt-3 mb-0">{{ error }}</div>

    <div class="row g-2 mt-2">
      <div class="col-6">
        <button type="button" class="btn btn-outline-secondary w-100" :disabled="saving" @click="emit('close')">{{ closeText }}</button>
      </div>
      <div class="col-6">
        <button type="submit" class="btn btn-brand w-100" :disabled="saving">{{ saving ? 'Saving…' : 'Save care details' }}</button>
      </div>
    </div>
  </form>
</template>

<style scoped>
.care-task {
  padding: 0.9rem 0;
  border-top: 1px solid #f1ece6;
}
.care-task__title {
  float: none;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  font-weight: 700;
}
.care-time {
  width: auto;
  min-width: 7.5rem;
}
</style>
