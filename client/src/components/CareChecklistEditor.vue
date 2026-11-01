<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { walkRoutesApi } from '../services/walkRouteApi.js'
import { SERVICE_PRICES, SERVICE_LABELS, SERVICE_HINTS } from '../utils/servicePrices.js'

// The care checklist part of the booking form: the owner adds tasks (feed, walk, medication...).
// The page gives it the pets that were picked (prop), and it tells the page the list of tasks
// whenever it changes (the 'change' event).
const props = defineProps({
  pets: { type: Array, required: true }, // the selected pets, as full objects: [{ _id, name, ... }]
  days: { type: Number, default: 0 } // how many days the booking covers, for the total next to "+ Add task" (0 = no dates yet)
})
const emit = defineEmits(['change'])

const categories = Object.keys(SERVICE_PRICES) // same 6 types the server accepts (each has a fixed price)
const tasks = ref([]) // each task: { category, title, dailyFrequency, petIds, walkRouteId }

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
  tasks.value.push({ category: 'feed', title: '', dailyFrequency: 1, petIds: [], walkRouteId: '' })
}

function removeTask(index) {
  tasks.value.splice(index, 1) // remove 1 task at this position
}

// The − / + buttons for "Times a day" (1 to 10, same limits as the server)
function changeTimes(task, step) {
  task.dailyFrequency = Math.min(10, Math.max(1, (Number(task.dailyFrequency) || 1) + step))
}

// Price of one task for one day, and of all tasks for one day
const taskPrice = (task) => (SERVICE_PRICES[task.category] ?? 0) * (Number(task.dailyFrequency) || 0)
const perDay = computed(() => tasks.value.reduce((sum, t) => sum + taskPrice(t), 0))

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
  <p class="small text-muted">What should the sitter do each day? Add at least one task. The price is based on these tasks.
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
      ${{ perDay }} a day<template v-if="props.days"> × {{ props.days }} day{{ props.days === 1 ? '' : 's' }} = <strong class="cl-total">${{ perDay * props.days }}</strong></template>
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
.cl-add:hover { border-color: #c44f1c; color: #c44f1c; }
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
