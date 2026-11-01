<script setup>
// A finished walk, to read only: the owner opens this from the Session page's checklist.
import { computed } from 'vue'
import WalkMap from './WalkMap.vue'

const props = defineProps({
  walk: { type: Object, required: true }
})

const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m} m`)
const formatTime = (d) => new Date(d).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })

// "32 min", "1 hr 5 min", or "Under a minute"
const duration = computed(() => {
  const minutes = Math.round(props.walk.durationS / 60)
  if (minutes < 1) return 'Under a minute'
  const hours = Math.floor(minutes / 60)
  return hours ? `${hours} hr ${minutes % 60} min` : `${minutes} min`
})

const walkedPath = computed(() => props.walk.walkedPath?.coordinates ?? [])
const plannedRoute = computed(() => props.walk.plannedPath?.coordinates ?? [])
const offRoute = computed(() => props.walk.deviations ?? [])

// Instructions walks have no route to check against
const routeCheck = computed(() => {
  if (props.walk.mode === 'instructions') return 'Not checked'
  const times = offRoute.value.length
  if (!times) return 'Stayed on route'
  return `Off route ${times} time${times === 1 ? '' : 's'}`
})
</script>

<template>
  <div class="ws">
    <div class="ws-stats">
      <div><span class="ws-label">Distance</span>{{ walkedPath.length ? formatDistance(walk.distanceM) : '–' }}</div>
      <div><span class="ws-label">Duration</span>{{ duration }}</div>
      <div><span class="ws-label">Route check</span>{{ routeCheck }}</div>
    </div>

    <p v-if="walk.status === 'ended-early'" class="ws-note">Ended early: {{ walk.endedEarlyReason }}</p>

    <ul v-if="offRoute.length" class="ws-list">
      <li v-for="d in offRoute" :key="d._id">
        Off route at {{ formatTime(d.startedAt) }}<template v-if="d.endedAt"> to {{ formatTime(d.endedAt) }}</template>,
        up to {{ Math.round(d.maxDistanceM) }} m away
      </li>
    </ul>

    <div v-if="walkedPath.length || plannedRoute.length" class="ws-map">
      <WalkMap :home="walk.home?.coordinates" :walked-path="walkedPath" :planned-route="plannedRoute" />
    </div>
    <p v-if="!walkedPath.length" class="ws-none">No path was recorded for this walk.</p>
  </div>
</template>

<style scoped>
.ws {
  margin-top: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--tint-soft);
  color: #2b2420;
  font-size: 0.9rem;
}
.ws-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
  gap: 0.5rem;
  font-weight: 600;
}
.ws-label {
  display: block;
  color: #6f6259;
  font-size: 0.8rem;
  font-weight: 400;
}
.ws-note {
  margin: 0.6rem 0 0;
  padding: 0.45rem 0.6rem;
  border-radius: 10px;
  background: #fce9df;
  color: #a84217;
  overflow-wrap: anywhere;
}
.ws-list {
  margin: 0.6rem 0 0;
  padding-left: 1.1rem;
}
.ws-map {
  height: 14rem;
  margin-top: 0.6rem;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.ws-map :deep(.map) {
  min-height: 0;
}
.ws-none {
  margin: 0.6rem 0 0;
  color: #6f6259;
}
</style>
