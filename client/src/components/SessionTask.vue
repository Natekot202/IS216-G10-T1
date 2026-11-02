<script setup>
// One row of the Session page's care checklist.
// Normal tasks have one button per time a day. Walk tasks have one control, because they are ticked
// by doing the walk, never by hand.
import { computed, ref, watch } from 'vue'
import WalkSummary from './WalkSummary.vue'
import TaskPhotos from './TaskPhotos.vue'
import { walkApi } from '../services/walkApi.js'
import { SERVICE_LABELS } from '../utils/servicePrices.js'
import { feedText, hasDetails, medicationIncomplete, medicationText } from '../utils/careDetails.js'

const props = defineProps({
  item: { type: Object, required: true },
  count: { type: Number, default: 0 },         // how many times it has been done today
  walks: { type: Array, default: () => [] },   // the walks that ticked this task: [{ _id, walk }]
  activeWalk: { type: Object, default: null }, // the walk happening now in this session, if any
  isSitter: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false }, // is today's session in progress?
  saving: { type: Boolean, default: false },
  opening: { type: Boolean, default: false }   // this task's walk page is opening
})
const emit = defineEmits(['tick', 'start-walk'])

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
const preview = computed(() => details.value.instructions || `${photos.value.length} photo${photos.value.length === 1 ? '' : 's'}`)
const walkingHere = computed(() => String(props.activeWalk?.task ?? '') === String(props.item._id))
const noDetails = computed(() => !hasDetails(props.item))
const medicationWarning = computed(() => medicationIncomplete(props.item))
const facts = computed(() => feedText(props.item) || medicationText(props.item))

// "Block loop · 1.2 km", or how to walk without a route
const routeText = computed(() => {
  const r = props.item.walkRoute
  if (r?.mode === 'route') {
    const km = r.distanceM >= 1000 ? `${(r.distanceM / 1000).toFixed(1)} km` : `${r.distanceM} m`
    return `Route: ${r.name} · ${km}`
  }
  return 'No set route: follow the instructions'
})

// A button's label: its scheduled time, or 1st, 2nd... A one-time task with no time just says Done.
const ORDINALS = ['1st', '2nd', '3rd']
function buttonLabel(n) {
  if (times.value[n - 1]) return times.value[n - 1]
  if (props.item.dailyFrequency === 1) return 'Done'
  return ORDINALS[n - 1] ?? `${n}th`
}

// Ticked in order: only the next one can be ticked, and only the last one unticked
function canPress(n) {
  return props.isSitter && props.isActive && !props.saving && (n === props.count + 1 || n === props.count)
}

// What a walk row shows when there's no button: "Walk", or "1 of 2 walks"
const walkCapsule = computed(() =>
  props.item.dailyFrequency > 1 ? `${props.count} of ${props.item.dailyFrequency} walks` : 'Walk'
)
const startWalkText = computed(() =>
  props.item.dailyFrequency > 1 ? `Start walk ${props.count + 1} of ${props.item.dailyFrequency}` : 'Start walk'
)

function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
}

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

// The instructions open and close inside the row. Medication starts open until it's done,
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
        <small v-if="facts" class="task-line">{{ facts }}</small>
        <template v-if="isWalk">
          <small class="task-line">{{ routeText }}</small>
          <small v-if="times.length" class="task-line">At {{ times.join(', ') }}</small>
          <small v-if="walkingHere && activeWalk.startedAt" class="task-line">Started at {{ formatTime(activeWalk.startedAt) }}</small>
          <!-- the sitter can look back at each walk done for this task -->
          <small v-if="isSitter && walks.length" class="d-flex flex-wrap gap-2">
            <router-link v-for="(t, i) in walks" :key="t._id" class="task-link"
                         :to="{ name: 'sitter-walk', params: { id: t.walk } }">View walk {{ i + 1 }}</router-link>
          </small>
          <small v-else-if="walks.length" class="d-flex flex-wrap gap-2">
            <button v-for="(t, i) in walks" :key="t._id" type="button" class="task-walk-link"
                    :aria-expanded="openWalkId === t.walk" @click="toggleWalk(t.walk)">View walk {{ i + 1 }}</button>
          </small>
        </template>
        <small v-if="noDetails && !medicationWarning" class="task-line">No details added, check with the owner</small>
      </div>

      <div class="task-controls">
        <!-- walk tasks: one control at a time -->
        <template v-if="isWalk">
          <span v-if="allDone" class="task-capsule task-capsule--done">✓ Walk</span>
          <template v-else-if="walkingHere">
            <button v-if="isSitter" type="button" class="task-walk task-walk--live" :disabled="opening" @click="emit('start-walk')">
              <span class="task-dot" aria-hidden="true"></span>{{ opening ? 'Opening…' : 'Walk in progress' }}
            </button>
            <span v-else class="task-capsule task-capsule--live"><span class="task-dot" aria-hidden="true"></span>Walk in progress</span>
          </template>
          <button v-else-if="isSitter && isActive" type="button" class="task-walk" :disabled="opening" @click="emit('start-walk')">
            {{ opening ? 'Opening…' : startWalkText }}
          </button>
          <span v-else class="task-capsule">{{ walkCapsule }}</span>
        </template>

        <!-- normal tasks: one button for each time a day -->
        <template v-else>
          <button v-for="n in item.dailyFrequency" :key="n" type="button" class="task-tick"
                  :class="{ 'task-tick--done': n <= count }" :disabled="!canPress(n)" :aria-pressed="n <= count"
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

    <div v-if="medicationWarning" class="task-warning" role="note">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 4l9 16H3zM12 10v4M12 17v.01" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      No details added, check with the owner
    </div>

    <template v-if="details.instructions || photos.length">
      <button type="button" class="task-more" :aria-expanded="detailsOpen" @click="detailsOpen = !detailsOpen">
        <span aria-hidden="true">{{ detailsOpen ? '▾' : '▸' }}</span>
        <strong>Details</strong>
        <span v-if="!detailsOpen" class="task-preview">{{ preview }}</span>
      </button>
      <template v-if="detailsOpen">
        <p v-if="details.instructions" class="task-instructions">{{ details.instructions }}</p>
        <TaskPhotos v-if="photos.length" :photos="photos" />
      </template>
    </template>
  </div>
</template>

<style scoped>
.task {
  padding: 0.7rem 0;
}
.task + .task {
  border-top: 1px solid var(--line);
}
.task--walking {
  margin: 0 -0.6rem;
  padding: 0.7rem 0.6rem;
  border-radius: 10px;
  background: #e4efeb;
}
.task-top {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
}
.task-icon {
  flex: none;
  margin-top: 0.1rem;
  color: #6f6259;
}
.task-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow-wrap: anywhere;
}
.task-title {
  font-weight: 600;
  color: #2b2420;
}
.task-title--done {
  color: #6f6259;
  text-decoration: line-through;
}
.task-line {
  color: #6f6259;
}
.task-link {
  color: var(--accent);
  font-weight: 700;
}
.task-walk-link {
  min-height: 32px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  font-weight: 700;
  text-decoration: underline;
}
.task-controls {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
  max-width: 55%;
}

/* a normal task's time buttons */
.task-tick {
  min-height: 36px;
  min-width: 3.4rem;
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: #2b2420;
  font-size: 0.9rem;
  font-weight: 600;
}
.task-tick:hover:not(:disabled) {
  border-color: #2f6f62;
}
.task-tick:disabled {
  color: #6f6259;
  cursor: not-allowed;
}
.task-tick--done,
.task-tick--done:disabled {
  border-color: #2f6f62;
  background: #2f6f62;
  color: #fff;
}

/* a walk's single control */
.task-walk {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.8rem;
  border: 0;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 700;
}
.task-walk:hover:not(:disabled) {
  background: var(--accent-hover);
}
.task-walk:disabled {
  opacity: 0.55;
}
.task-walk--live,
.task-walk--live:hover:not(:disabled) {
  background: #2f6f62;
}
.task-capsule {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 0.4rem;
  padding: 0.2rem 0.8rem;
  border-radius: 10px;
  background: var(--tint-soft);
  color: #2b2420;
  font-size: 0.9rem;
  font-weight: 600;
}
.task-capsule--done {
  background: #2f6f62;
  color: #fff;
}
.task-capsule--live {
  background: #2f6f62;
  color: #fff;
}
.task-dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: #e4efeb;
  animation: task-pulse 1.6s ease-out infinite;
}
@keyframes task-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(228, 239, 235, 0.7);
  }
  100% {
    box-shadow: 0 0 0 0.5rem rgba(228, 239, 235, 0);
  }
}

/* medication with details missing: always visible */
.task-warning {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.45rem;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  background: #fce9df;
  color: #a84217;
  font-size: 0.9rem;
  font-weight: 700;
}
.task-warning svg {
  flex: none;
}

/* the instructions, inside the row */
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
  font-size: 0.9rem;
  text-align: left;
}
.task-preview {
  min-width: 0;
  overflow: hidden;
  color: #6f6259;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.task-instructions {
  margin: 0.2rem 0 0;
  padding: 0.5rem 0.65rem;
  border-radius: 10px;
  background: var(--tint-soft);
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

/* phones: the controls move under the text, at a size that's easy to tap */
@media (max-width: 767.98px) {
  .task-top {
    flex-wrap: wrap;
  }
  .task-text {
    flex: 1 1 calc(100% - 2rem);
  }
  .task-controls {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
  }
  .task-tick,
  .task-walk,
  .task-capsule {
    min-height: 44px;
  }
  .task-tick {
    flex: 1 1 4.5rem;
  }
  .task-walk {
    flex: 1 1 100%;
    justify-content: center;
  }
  .task-more {
    min-height: 44px;
  }
  .task-link {
    display: inline-block;
    padding: 0.35rem 0;
  }
  .task-walk-link {
    min-height: 44px;
  }
}
</style>
