<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { walkRoutesApi } from '../services/walkRouteApi.js'
import { SERVICE_PRICES, SERVICE_LABELS, SERVICE_HINTS, daysForTask, priceForTasks } from '../utils/servicePrices.js'
import { prettyDate } from '../utils/bookingTimeHelpers.js'

// The care checklist part of the booking form: the owner adds tasks (feed, walk, medication...).
// The page gives it the pets that were picked (prop), and it tells the page the list of tasks
// whenever it changes (the 'change' event).
const props = defineProps({
  pets: { type: Array, required: true }, // the selected pets, as full objects: [{ _id, name, ... }]
  dates: { type: Array, default: () => [] } // every day the booking covers: ['2026-11-03', ...] (empty = no dates yet)
})
const emit = defineEmits(['change'])

const categories = Object.keys(SERVICE_PRICES) // same 6 types the server accepts (each has a fixed price)
const tasks = ref([]) // each task: { category, title, dailyFrequency, petIds, walkRouteId, someDays, days }
const dayCount = computed(() => props.dates.length)

// The owner's recorded walking routes, for the route dropdown on walk tasks
const walkRoutes = ref([])
const routesError = ref('')

onMounted(async () => {
  try {
    walkRoutes.value = await walkRoutesApi.getMyRoutes()
  } catch {
    routesError.value = 'Could not load your walking routes.'
  }
})

const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`)

function addTask() {
  // petIds: [] means "all the selected pets"
  // walkRouteId (walk tasks only): a route's id, 'instructions', or '' (not chosen yet)
  // someDays: false = every day; true = only on the dates in `days`
  tasks.value.push({ category: 'feed', title: '', dailyFrequency: 1, petIds: [], walkRouteId: '', someDays: false, days: [] })
}

function removeTask(index) {
  tasks.value.splice(index, 1) // remove 1 task at this position
}

// The − / + buttons for "Times a day" (1 to 10, same limits as the server)
function changeTimes(task, step) {
  task.dailyFrequency = Math.min(10, Math.max(1, (Number(task.dailyFrequency) || 1) + step))
}

// Price of one task for one day, and of all the tasks for the whole booking
const taskPrice = (task) => (SERVICE_PRICES[task.category] ?? 0) * (Number(task.dailyFrequency) || 0)
const total = computed(() => priceForTasks(tasks.value, dayCount.value))

function setSomeDays(task, someDays) {
  task.someDays = someDays
  if (!someDays) task.days = []
}

function toggleTaskDay(task, date) {
  if (task.days.includes(date)) task.days = task.days.filter((d) => d !== date)
  else task.days.push(date)
}

// "Tue, 3 Nov"
const shortDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })

// Changing the booking's dates: a task can't stay on a day that's no longer booked,
// and with only one day there's nothing to choose
watch(() => props.dates, (dates) => {
  for (const task of tasks.value) {
    task.days = task.days.filter((d) => dates.includes(d))
    if (dates.length < 2) setSomeDays(task, false)
  }
})

// Same idea as togglePet (on the booking page), but for the pets chosen on one task
function toggleTaskPet(task, id) {
  if (task.petIds.includes(id)) task.petIds = task.petIds.filter((p) => p !== id)
  else task.petIds.push(id)
}

// Tell the page whenever the tasks change (deep: also when a task's title or pets change)
watch(tasks, () => emit('change', tasks.value), { deep: true })
</script>

<template>
  <h3 class="h6 text-uppercase text-muted fw-bold mt-4">Care Checklist</h3>
  <p class="small text-muted">What should the sitter do? Tasks are done every day unless you choose certain days, and every day needs at least one task. The price is based on these tasks.
    Pick the type that really matches the job; the sitter can decline a request whose tasks don't match.</p>

  <!-- Labels written once, above every task (on phones each task shows its own labels instead) -->
  <div v-if="tasks.length" class="cl-grid cl-head">
    <span>Type</span><span>What to do</span><span>Times a day</span><span class="text-end">Per day</span><span></span>
  </div>

  <div v-for="(task, i) in tasks" :key="i" class="cl-task">
    <!-- one row: every task uses the same columns, so the boxes and buttons line up -->
    <div class="cl-grid">
      <div class="cl-type">
        <label class="cl-label" :for="`task-type-${i}`">Type</label>
        <select :id="`task-type-${i}`" v-model="task.category" class="form-select form-select-sm">
          <option v-for="c in categories" :key="c" :value="c">{{ SERVICE_LABELS[c] }} (${{ SERVICE_PRICES[c] }})</option>
        </select>
      </div>
      <div class="cl-what">
        <label class="cl-label" :for="`task-title-${i}`">What to do</label>
        <input :id="`task-title-${i}`" v-model="task.title" type="text" maxlength="120" class="form-control form-control-sm" placeholder="e.g. Feed 1 cup kibble at 8am" />
      </div>
      <div>
        <span class="cl-label">Times a day</span>
        <div class="stepper" role="group" :aria-label="`Times a day for task ${i + 1}`">
          <button type="button" aria-label="Fewer times" :disabled="task.dailyFrequency <= 1" @click="changeTimes(task, -1)">−</button>
          <span>{{ task.dailyFrequency }}</span>
          <button type="button" aria-label="More times" :disabled="task.dailyFrequency >= 10" @click="changeTimes(task, 1)">+</button>
        </div>
      </div>
      <div class="cl-price"><span class="cl-label">Per day</span>${{ taskPrice(task) }}</div>
      <div class="cl-x-cell">
        <button type="button" class="cl-x" aria-label="Remove task" @click="removeTask(i)">✕</button>
      </div>
    </div>

    <!-- the extras sit under "What to do", all at the same indent -->
    <div class="cl-sub"><span></span><span class="small text-muted">{{ SERVICE_HINTS[task.category] }}</span></div>

    <!-- Walk tasks: which route the sitter should follow -->
    <div v-if="task.category === 'walk'" class="cl-sub">
      <label class="cl-sub-label" :for="`walk-route-${i}`">Route</label>
      <div>
        <select :id="`walk-route-${i}`" v-model="task.walkRouteId" class="form-select form-select-sm">
          <option value="" disabled>Choose a route…</option>
          <option v-for="r in walkRoutes" :key="r._id" :value="r._id">{{ r.name }} · {{ formatDistance(r.distanceM) }}</option>
          <option value="instructions">No route – follow my instructions</option>
        </select>
        <p v-if="routesError" class="small text-danger mb-0 mt-1">{{ routesError }}</p>
        <p v-else-if="walkRoutes.length === 0" class="small text-muted mb-0 mt-1">
          You haven't recorded any routes yet.
          <router-link to="/owner/routes/new" target="_blank">Record a route</router-link>, or choose "follow my instructions".
        </p>
        <p v-else-if="task.walkRouteId === 'instructions'" class="small text-muted mb-0 mt-1">
          Put the instructions in "What to do". The walk is still tracked, but can't be checked against a route.
        </p>
      </div>
    </div>

    <!-- Only worth choosing days when the booking covers more than one -->
    <div v-if="dates.length > 1" class="cl-sub">
      <span class="cl-sub-label">Days</span>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button type="button" class="btn btn-sm rounded-pill px-2 py-0"
                :class="task.someDays ? 'btn-outline-secondary' : 'btn-dark'" @click="setSomeDays(task, false)">Every day</button>
        <button type="button" class="btn btn-sm rounded-pill px-2 py-0"
                :class="task.someDays ? 'btn-dark' : 'btn-outline-secondary'" @click="setSomeDays(task, true)">Certain days</button>
        <template v-if="task.someDays">
          <button v-for="d in dates" :key="d" type="button" class="btn btn-sm rounded-pill px-2 py-0"
                  :class="task.days.includes(d) ? 'btn-dark' : 'btn-outline-secondary'"
                  :aria-pressed="task.days.includes(d)" :aria-label="prettyDate(d)" @click="toggleTaskDay(task, d)">{{ shortDate(d) }}</button>
          <span v-if="!task.days.length" class="small text-muted">(choose at least one)</span>
          <span v-else class="small text-muted">{{ daysForTask(task, dayCount) }} day{{ task.days.length === 1 ? '' : 's' }}</span>
        </template>
      </div>
    </div>

    <!-- Only worth choosing pets when more than one is selected -->
    <div v-if="pets.length > 1" class="cl-sub">
      <span class="cl-sub-label">For</span>
      <div class="d-flex flex-wrap align-items-center gap-2">
        <button
          v-for="pet in pets"
          :key="pet._id"
          type="button"
          class="btn btn-sm rounded-pill px-2 py-0"
          :class="task.petIds.includes(pet._id) ? 'btn-dark' : 'btn-outline-secondary'"
          @click="toggleTaskPet(task, pet._id)"
        >
          {{ pet.name }}
        </button>
        <span v-if="task.petIds.length === 0" class="small text-muted">(all selected pets)</span>
      </div>
    </div>
  </div>

  <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
    <button type="button" class="cl-add" @click="addTask">+ Add task</button>
    <span v-if="tasks.length" class="small">
      <template v-if="dayCount">{{ dayCount }} day{{ dayCount === 1 ? '' : 's' }} booked · <strong class="cl-total">${{ total }}</strong></template>
    </span>
  </div>
</template>

<style scoped>
/* One grid for the label row and every task, so all the columns line up:
   Type | What to do | Times a day | Per day | ✕ */
.cl-grid {
  display: grid;
  grid-template-columns: 150px minmax(0, 1fr) 112px 64px 34px;
  gap: 10px;
  align-items: center;
}
.cl-head {
  padding: 0 12px 4px;
  font-size: 0.7rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #766a60;
}
.cl-task {
  border: 1px solid #e4dbd0;
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}
.cl-label { display: none; font-size: 0.68rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #766a60; } /* phones only */
.cl-sub { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 10px; align-items: center; } /* lines up with "What to do" */
.cl-sub-label { font-size: 0.78rem; font-weight: 700; color: #766a60; }
.stepper { display: inline-flex; align-items: center; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; height: 32px; }
.stepper button { width: 32px; height: 100%; border: 0; background: #f6f2ee; font-weight: 800; }
.stepper button:disabled { opacity: 0.4; }
.stepper span { width: 40px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
.cl-price { text-align: right; font-weight: 800; color: #3f8a4a; font-variant-numeric: tabular-nums; }
.cl-x { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #e4dbd0; background: transparent; color: #766a60; }
.cl-x:hover { border-color: #b3412b; color: #b3412b; }
.cl-add { border: 1.5px dashed #c9bfb3; background: transparent; border-radius: 10px; padding: 6px 14px; font-weight: 700; font-size: 0.9rem; }
.cl-add:hover { border-color: var(--accent-deep); color: var(--accent-deep); }
.cl-total { color: #3f8a4a; }

@media (max-width: 640px) { /* phones: each task becomes a small card with its own labels */
  .cl-head { display: none; }
  .cl-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .cl-type { grid-column: 1 / -1; padding-right: 40px; }
  .cl-what { grid-column: 1 / -1; }
  .cl-label { display: block; margin-bottom: 2px; }
  .cl-price { text-align: left; }
  .cl-x-cell { position: absolute; top: 10px; right: 10px; }
  .cl-sub { grid-template-columns: minmax(0, 1fr); gap: 2px; }
}
</style>
