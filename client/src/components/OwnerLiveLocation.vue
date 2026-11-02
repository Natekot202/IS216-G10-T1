<script setup>
// The owner's live location card on the Session page. The server sends `location`, and only during an active session.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import WalkMap from './WalkMap.vue'

const props = defineProps({
  location: { type: Object, required: true }, // { state, position, at, ended }
  home: { type: Array, default: null },       // [lng, lat]
  plannedRoute: { type: Array, default: () => [] } // the walk under way, if it has a route
})

const STATUS = {
  home: 'At your home',
  away: 'Not at home',
  walk: 'On a walk',
  paused: 'Location paused',
  blocked: 'Location not shared'
}

// so "20 seconds ago" keeps counting between refreshes
const now = ref(Date.now())
let clock = null
onMounted(() => {
  clock = setInterval(() => { now.value = Date.now() }, 5000)
})
onBeforeUnmount(() => clearInterval(clock))

function timeAgo(at) {
  const seconds = Math.max(0, Math.round((now.value - new Date(at).getTime()) / 1000))
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'} ago`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
}

const detail = computed(() => {
  const { state, at, ended } = props.location
  if (ended) return 'Sharing stopped after the booked time.'
  if (state === 'blocked') return 'The sitter has location switched off.'
  if (state === 'paused') return at ? `Last seen ${timeAgo(at)}` : 'Waiting for the sitter\'s location.'
  return `Updated ${timeAgo(at)}`
})
const position = computed(() => (props.location.state === 'blocked' ? null : props.location.position ?? null))
</script>

<template>
  <section class="live">
    <div class="live-head">
      <h4 class="live-title">Sitter's location</h4>
      <span class="live-status" :class="`live-status--${location.state}`">{{ STATUS[location.state] }}</span>
      <small class="live-detail">{{ detail }}</small>
    </div>
    <div class="live-map">
      <WalkMap :home="home" :position="position" :planned-route="plannedRoute" />
    </div>
  </section>
</template>

<style scoped>
.live {
  margin-bottom: 1rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}
.live-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
  margin-bottom: 0.75rem;
}
.live-title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: #2b2420;
}
.live-status {
  padding: 0.1rem 0.7rem;
  border-radius: 999px;
  background: #e4efeb;
  color: #235348;
  font-size: 0.85rem;
  font-weight: 700;
}
.live-status--away {
  background: var(--tint);
  color: #2b2420;
}
.live-status--paused,
.live-status--blocked {
  background: #fce9df;
  color: #a84217;
}
.live-detail {
  color: #6f6259;
}
.live-map {
  height: 16rem;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.live-map :deep(.map) {
  min-height: 0;
}
</style>
