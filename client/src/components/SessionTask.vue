<script setup>
// One row of the Session page's care checklist, for owners and sitters.
// Normal tasks have one button per time a day. Walk tasks have one control, because they are ticked
// by doing the walk, never by hand.
import { computed, ref, watch } from 'vue'
import WalkSummary from './WalkSummary.vue'
import TaskPhotos from './TaskPhotos.vue'
import { walkApi } from '../services/walkApi.js'
import { SERVICE_LABELS } from '../utils/servicePrices.js'
import { feedText, hasDetails, medicationIncomplete, medicationText } from '../utils/careDetails.js'
import { clockText, timeOf } from '../utils/visitReport.js'

const props = defineProps({
  item: { type: Object, required: true },
  count: { type: Number, default: 0 },         // how many times it has been done today
  tickTimes: { type: Array, default: () => [] }, // when each of those was ticked
  walks: { type: Array, default: () => [] },   // the walks that ticked this task: [{ _id, walk }]
  activeWalk: { type: Object, default: null }, // the walk happening now in this session, if any
  isSitter: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false }, // is today's session in progress?
  saving: { type: Boolean, default: false },
  opening: { type: Boolean, default: false },  // this task's walk page is opening
  canAddDetails: { type: Boolean, default: false }, // owner, before the first session: details can still be added
  bookingId: { type: String, default: '' }     // for the owner's link to the booking page
})
const emit = defineEmits(['tick', 'start-walk', 'add-details'])

// A simple line drawing for each type of task
const ICONS = {
  feed: 'M5 11h14a7 7 0 0 1-14 0zM9 18h6M12 4v4',
  walk: 'M13 4a1.5 1.5 0 1 0 0 .01M10 21l2-6-3-3 2-4 3 2 3 1M7 13l1-4',
  groom: 'M7 4v16M7 8h9l2-4M7 12h8M7 16h6',
  medication: 'M8 14l6-6a3.5 3.5 0 0 1 5 5l-6 6a3.5 3.5 0 0 1-5-5zM11 11l5 5',
  clean: 'M6 7h12l-1 13H7zM4 7h16M10 7V4h4v3',
  play: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 12c5 0 8-3 8.5-8.5M12 20.5c.5-5 3.5-8 8.5-8.5'
}

const isWalk = computed(() => props.item.category === 'walk')
const allDone = computed(() => props.count >= props.item.dailyFrequency)
const details = computed(() => props.item.details ?? {})
const times = computed(() => details.value.times ?? [])
const photos = computed(() => details.value.referencePhotos ?? [])
const walkingHere = computed(() => String(props.activeWalk?.task ?? '') === String(props.item._id))
const noDetails = computed(() => !hasDetails(props.item))
// only medication gets the amber flag: the sitter must never guess a dose
const medicationFlag = computed(() => medicationIncomplete(props.item))

// "Route: SMU loop · 1.2 km", or how to walk without a route
const routeText = computed(() => {
  const r = props.item.walkRoute
  if (r?.mode === 'route') {
    const km = r.distanceM >= 1000 ? `${(r.distanceM / 1000).toFixed(1)} km` : `${r.distanceM} m`
    return `Route: ${r.name} · ${km}`
  }
  return 'No set route: follow the instructions'
})
const atTimes = computed(() => (times.value.length ? `at ${times.value.map(clockText).join(', ')}` : ''))

// The muted line under the title
const subLine = computed(() => {
  if (isWalk.value) return [routeText.value, atTimes.value].filter(Boolean).join(' · ')
  const facts = props.item.category === 'feed' ? feedText(props.item)
    : props.item.category === 'medication' ? medicationText(props.item).replace(/, (?=with food)/, ' · ')
      : (details.value.instructions ?? '').split('\n')[0]
  return [facts, atTimes.value].filter(Boolean).join(' · ')
})
// The Details disclosure: shown when there's more than the sub-line already says
const hasMore = computed(() => photos.value.length > 0 || (details.value.instructions && details.value.instructions !== subLine.value))
const preview = computed(() => details.value.instructions || `${photos.value.length} photo${photos.value.length === 1 ? '' : 's'}`)

// A button's label: its scheduled time, or 1st, 2nd... A one-time task with no time just says Done.
const ORDINALS = ['1st', '2nd', '3rd']
function buttonLabel(n) {
  if (times.value[n - 1]) return clockText(times.value[n - 1])
  if (props.item.dailyFrequency === 1) return 'Done'
  return ORDINALS[n - 1] ?? `${n}th`
}

// Ticked in order: only the next one can be ticked, and only the last one unticked
function canPress(n) {
  return props.isSitter && props.isActive && !props.saving && (n === props.count + 1 || n === props.count)
}
// The owner can see when each one was ticked
const tickedAt = (n) => (n <= props.count && props.tickTimes[n - 1] ? `Ticked at ${timeOf(props.tickTimes[n - 1])}` : undefined)

const startWalkText = computed(() =>
  props.item.dailyFrequency > 1 ? `Start walk ${props.count + 1} of ${props.item.dailyFrequency}` : 'Start walk'
)
const walkCapsule = computed(() =>
  props.item.dailyFrequency > 1 ? `${props.count} of ${props.item.dailyFrequency} walks` : 'Walk'
)

// The owner's "View walk" links open a read-only summary inside the row
const openWalkId = ref(null)
const openWalk = ref(null) // the walk, once it has loaded
const walkError = ref('')

async function toggleWalk(id) {
  openWalk.value = null
  walkError.value = ''
  if (openWalkId.value === id) {
    openWalkId.value = null
    return
  }
  openWalkId.value = id
  try {
    openWalk.value = await walkApi.getById(id)
  } catch (err) {
    walkError.value = err.response?.data?.message || 'Could not load this walk.'
  }
}

// The details open and close inside the row. Medication starts open until it's done,
// because the sitter shouldn't have to look for how to give it.
const detailsOpen = ref(props.item.category === 'medication' && !allDone.value)
watch(allDone, (done) => {
  if (done) detailsOpen.value = false
})
</script>

<template>
  <div class="task" :class="{ 'task--walking': walkingHere }">
    <div class="task-top">
      <svg class="task-icon" viewBox="0 0 24 24" width="22" height="22" role="img" :aria-label="SERVICE_LABELS[item.category]">
        <path :d="ICONS[item.category]" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>

      <div class="task-text">
        <span class="task-title" :class="{ 'task-title--done': allDone }">{{ item.title }}</span>
        <small v-if="subLine" class="task-line">{{ subLine }}</small>
        <small v-if="walkingHere && activeWalk.startedAt" class="task-line">Started at {{ timeOf(activeWalk.startedAt) }}</small>
        <template v-if="isWalk && walks.length">
          <!-- the sitter opens each walk's page; the owner sees a summary inside the row -->
          <small v-if="isSitter" class="d-flex flex-wrap gap-2">
            <router-link v-for="(t, i) in walks" :key="t._id" class="task-link"
                         :to="{ name: 'sitter-walk', params: { id: t.walk } }">View walk {{ i + 1 }}</router-link>
          </small>
          <small v-else class="d-flex flex-wrap gap-2">
            <button v-for="(t, i) in walks" :key="t._id" type="button" class="task-walk-link"
                    :aria-expanded="openWalkId === t.walk" @click="toggleWalk(t.walk)">View walk {{ i + 1 }}</button>
          </small>
        </template>
        <!-- other tasks without details: a quiet line (medication gets the amber flag instead) -->
        <small v-if="noDetails && !medicationFlag" class="task-line">
          <template v-if="isSitter">No details added, check with the owner</template>
          <template v-else>No details yet<template v-if="canAddDetails"> · <button type="button" class="task-walk-link" @click="emit('add-details')">Add details</button></template></template>
        </small>

        <template v-if="hasMore">
          <button type="button" class="task-more" :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen">
            <span aria-hidden="true">{{ detailsOpen ? '▾' : '▸' }}</span>
            <strong>Details</strong>
            <span v-if="!detailsOpen" class="task-preview">{{ preview }}</span>
          </button>
          <div v-if="detailsOpen" class="task-details">
            <p v-if="details.instructions" class="task-instructions">{{ details.instructions }}</p>
            <TaskPhotos v-if="photos.length" :photos="photos" />
          </div>
        </template>
      </div>

      <div class="task-controls">
        <!-- medication with its name or dosage missing -->
        <template v-if="medicationFlag">
          <span v-if="isSitter" class="task-flag">⚠ No details</span>
          <button v-else-if="canAddDetails" type="button" class="task-flag" @click="emit('add-details')">⚠ No details ›</button>
          <router-link v-else class="task-flag" :to="`/bookings/${bookingId}`">⚠ No details ›</router-link>
        </template>

        <!-- walk tasks: one control at a time -->
        <template v-if="isWalk">
          <span v-if="allDone" class="task-pill task-pill--done"><span aria-hidden="true">✓ </span>Done</span>
          <template v-else-if="walkingHere">
            <button v-if="isSitter" type="button" class="task-pill task-pill--live" :disabled="opening" @click="emit('start-walk')">
              <span class="task-dot" aria-hidden="true"></span>{{ opening ? 'Opening…' : 'Walk in progress' }}
            </button>
            <span v-else class="task-pill task-pill--live"><span class="task-dot" aria-hidden="true"></span>Walk in progress</span>
          </template>
          <button v-else-if="isSitter && isActive" type="button" class="task-pill task-pill--start" :disabled="opening" @click="emit('start-walk')">
            {{ opening ? 'Opening…' : startWalkText }}
          </button>
          <span v-else class="task-pill task-pill--still">{{ walkCapsule }}</span>
        </template>

        <!-- normal tasks: one button for each time a day -->
        <template v-else>
          <button v-for="n in item.dailyFrequency" :key="n" type="button" class="task-pill"
                  :class="{ 'task-pill--done': n <= count, 'task-pill--readonly': !isSitter }" :disabled="!canPress(n)"
                  :aria-pressed="n <= count" :title="tickedAt(n)"
                  :aria-label="`${item.title}, ${buttonLabel(n)}, ${n <= count ? 'done' : 'not done'}`"
                  @click="emit('tick', n)">
            <span v-if="n <= count" aria-hidden="true">✓ </span>{{ buttonLabel(n) }}
          </button>
        </template>
      </div>
    </div>

    <template v-if="openWalkId">
      <WalkSummary v-if="openWalk" :walk="openWalk" />
      <p v-else-if="walkError" class="task-line mt-1 mb-0">{{ walkError }}</p>
      <p v-else class="task-line mt-1 mb-0">Loading walk…</p>
    </template>
  </div>
</template>

<style scoped>
.task {
  padding: 14px 0;
}
.task + .task {
  border-top: 1px solid #f0e8e0;
}
.task--walking {
  margin: 0 -0.6rem;
  padding: 14px 0.6rem;
  border-radius: 10px;
  background: #ecf6ef;
}
.task-top {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
}
.task-icon {
  flex: none;
  margin-top: 0.1rem;
  color: var(--accent);
}
.task-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow-wrap: anywhere;
}
.task-title {
  color: #2b2420;
  font-size: 15px;
  font-weight: 700;
}
.task-title--done {
  color: #6b5f56;
  text-decoration: line-through;
}
.task-line {
  color: #6b5f56;
}
.task-link {
  color: var(--accent-deep);
  font-weight: 700;
}
.task-walk-link {
  min-height: 32px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent-deep);
  font-weight: 700;
  text-decoration: underline;
}
.task-controls {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.4rem;
  max-width: 55%;
}

/* the controls: pill buttons */
.task-pill {
  display: inline-flex;
  min-height: 40px;
  min-width: 3.6rem;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0 0.9rem;
  border: 1.5px solid #e2d6ca;
  border-radius: 999px;
  background: #fff;
  color: #2b2420;
  font-size: 0.88rem;
  font-weight: 700;
  white-space: nowrap;
}
.task-pill:hover:not(:disabled):not(.task-pill--readonly) {
  border-color: var(--accent-main);
}
.task-pill:disabled:not(.task-pill--done) {
  color: #6b5f56;
}
.task-pill--readonly:disabled {
  cursor: default;
}
.task-pill--done,
.task-pill--done:disabled {
  border-color: #9fd3b3;
  background: #e8f5ec;
  color: #14532d;
}
.task-pill--start {
  border-color: var(--accent);
  color: var(--accent);
}
.task-pill--start:disabled {
  opacity: 0.55;
}
.task-pill--live,
.task-pill--live:disabled {
  border-color: #9fd3b3;
  background: #e8f5ec;
  color: #14532d;
}
.task-pill--still {
  color: #6b5f56;
}
.task-pill:focus-visible,
.task-flag:focus-visible,
.task-more:focus-visible,
.task-walk-link:focus-visible {
  outline: 3px solid var(--accent-deep);
  outline-offset: 2px;
}
.task-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #1f8a4c;
  animation: task-pulse 1.6s ease-out infinite;
}
@keyframes task-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(31, 138, 76, 0.45);
  }
  100% {
    box-shadow: 0 0 0 0.45rem rgba(31, 138, 76, 0);
  }
}

/* medication with details missing */
.task-flag {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  padding: 0 0.7rem;
  border: 1px solid #f1d7a6;
  border-radius: 999px;
  background: #fdf0c4;
  color: #7a5a00;
  font-size: 0.8rem;
  font-weight: 800;
  text-decoration: none;
  white-space: nowrap;
}
a.task-flag:hover,
button.task-flag:hover {
  border-color: #c98a12;
}

/* the instructions and photos, inside the row */
.task-more {
  display: flex;
  width: 100%;
  min-height: 32px;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.2rem;
  padding: 0;
  border: 0;
  background: none;
  color: #2b2420;
  font-size: 0.88rem;
  text-align: left;
}
.task-more strong {
  flex: none; /* the preview shrinks, never the label */
}
.task-preview {
  min-width: 0;
  overflow: hidden;
  color: #6b5f56;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}
.task-instructions {
  margin: 0;
  padding: 0.5rem 0.65rem;
  border: 1px solid #f0e8e0;
  border-radius: 10px;
  background: #faf6f2;
  color: #2b2420;
  font-size: 0.9rem;
  white-space: pre-line; /* keeps the owner's line breaks */
  overflow-wrap: anywhere;
}

@media (prefers-reduced-motion: reduce) {
  .task-dot {
    animation: none;
  }
}

/* phones: the buttons stack on the right, and long titles wrap */
@media (max-width: 767.98px) {
  .task-controls {
    flex-direction: column;
    align-items: stretch;
    max-width: 45%;
  }
  .task-pill {
    min-height: 44px;
    min-width: 0;
    padding: 0.4rem 0.75rem;
    white-space: normal; /* "Walk in progress" wraps instead of running off the card */
    text-align: center;
  }
  .task-more,
  .task-walk-link {
    min-height: 44px;
  }
  .task-link {
    display: inline-block;
    padding: 0.35rem 0;
  }
}

/* small phones (under 576px): the buttons go on their own row under the task text, so the text gets the full width */
@media (max-width: 575.98px) {
  .task-top {
    flex-wrap: wrap;
  }
  .task-controls {
    flex-direction: row;
    flex-basis: calc(100% - 22px - 0.65rem);
    justify-content: flex-start;
    max-width: none;
    margin-left: calc(22px + 0.65rem); /* lines up with the text, not the icon */
  }
  .task-controls .task-pill {
    flex: 1 1 0;
  }
}

/* reference photos: the caption sits beside the picture and uses the rest of the row */
.task-details :deep(.tp) {
  flex-direction: column;
}
.task-details :deep(.tp-item) {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 0.6rem;
}
.task-details :deep(.tp-img) {
  flex: none;
}
.task-details :deep(.tp-caption) {
  flex: 1;
  min-width: 0;
  margin-top: 0;
}
</style>
