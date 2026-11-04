<script setup>
// The owner's live location card on the Session page. The server sends `location`, and only during an active session.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import WalkMap from './WalkMap.vue'

const props = defineProps({
  location: { type: Object, required: true }, // { state, position, at, ended }
  home: { type: Array, default: null },       // [lng, lat]
  plannedRoute: { type: Array, default: () => [] }, // the walk under way, if it has a route
  sitterName: { type: String, default: 'Sitter' }
})

// so "12 s ago" keeps counting between refreshes
const now = ref(Date.now())
let clock = null
onMounted(() => {
  clock = setInterval(() => { now.value = Date.now() }, 5000)
})
onBeforeUnmount(() => clearInterval(clock))

function timeAgo(at) {
  const seconds = Math.max(0, Math.round((now.value - new Date(at).getTime()) / 1000))
  return seconds < 60 ? `${seconds} s ago` : `${Math.floor(seconds / 60)} min ago`
}

// The muted text beside the label: when the location was last updated, or why there's none
const detail = computed(() => {
  const { state, at, ended } = props.location
  if (ended) return 'Sharing stopped after the booked time.'
  if (state === 'blocked') return 'The sitter has location switched off.'
  if (state === 'paused') return at ? `Location paused · last seen ${timeAgo(at)}` : "Waiting for the sitter's location."
  return `Updated ${timeAgo(at)}`
})
const warn = computed(() => props.location.ended || ['paused', 'blocked'].includes(props.location.state))
const position = computed(() => (props.location.state === 'blocked' ? null : props.location.position ?? null))
const mapRef = ref(null)
</script>

<template>
  <section class="live">
    <div class="live-head">
      <h4 class="live-label">Sitter's location</h4>
      <span v-if="location.state === 'walk'" class="live-walk">On a walk</span>
      <span v-else-if="location.state === 'home'" class="live-home">At your home</span>
      <span v-else-if="location.state === 'away'" class="live-away">Not at home</span>
      <small class="live-detail" :class="{ 'live-detail--warn': warn }">{{ detail }}</small>
    </div>
    <div class="live-map">
      <WalkMap ref="mapRef" :home="home" :position="position" :planned-route="plannedRoute" markers="dots" />
      <button v-if="position" type="button" class="live-recentre" @click="mapRef?.recentre()">Recentre</button>
      <!-- which mark is which (the same shapes as the 'dots' markers in WalkMap) -->
      <ul class="live-legend" aria-label="Map key">
        <li><svg class="live-key live-key--sitter" viewBox="0 0 24 34" aria-hidden="true"><path d="M12 1C5.9 1 1 5.9 1 12c0 8.3 11 21 11 21s11-12.7 11-21C23 5.9 18.1 1 12 1z" fill="#2563eb" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="#fff"/></svg>{{ sitterName }}</li>
        <li v-if="home"><svg class="live-key live-key--home" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 1.8 11.2h3V21.5h14.4V11.2h3z" fill="#2b2420" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><rect x="10" y="14.5" width="4" height="7" rx=".6" fill="#fff"/></svg>Home</li>
        <li v-if="plannedRoute.length"><span class="live-key live-key--route" aria-hidden="true"></span>dashed: planned route</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.live {
  padding: 1rem;
  border: 1px solid #f0e8e0;
  border-radius: 12px;
  background: #fff;
}
.live-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.6rem;
  margin-bottom: 0.75rem;
}
.live-label {
  margin: 0;
  color: #5c524b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.live-walk,
.live-home,
.live-away {
  padding: 0.1rem 0.65rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 800;
}
.live-walk {
  background: #e0ecff;
  color: #1e3a8a;
}
.live-home {
  background: #e8f5ec;
  color: #14532d;
}
.live-away {
  background: #f3ece6;
  color: #2b2420;
}
.live-detail {
  color: #6b5f56;
}
.live-detail--warn {
  color: #7a5a00;
  font-weight: 700;
}
.live-map {
  position: relative;
  height: 460px;
  overflow: hidden;
  border: 1px solid #e6dcd3;
  border-radius: 10px;
}
.live-map :deep(.map) {
  min-height: 0;
}
.live-recentre {
  position: absolute;
  top: 0.6rem;
  left: 0.6rem; /* the map's zoom buttons are top-right */
  min-height: 36px;
  padding: 0 0.8rem;
  border: 1px solid #e6dcd3;
  border-radius: 10px;
  background: #fff;
  color: #2b2420;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(43, 36, 32, 0.15);
}
.live-recentre:focus-visible {
  outline: 3px solid var(--accent-deep);
  outline-offset: 2px;
}
.live-legend {
  position: absolute;
  bottom: 0.6rem;
  left: 0.6rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem 0.75rem;
  max-width: calc(100% - 1.2rem);
  margin: 0;
  padding: 0.3rem 0.65rem;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(43, 36, 32, 0.15);
  color: #2b2420;
  font-size: 0.8rem;
  list-style: none;
}
.live-legend li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}
.live-key {
  display: inline-block;
}
.live-key--sitter {
  width: 0.8rem;
  height: 1.1rem;
}
.live-key--home {
  width: 1.1rem;
  height: 1.1rem;
}
.live-key--route {
  width: 1.1rem;
  border-top: 3px dashed #2f6f62;
}

@media (max-width: 767.98px) {
  .live-detail {
    flex: 1 1 100%;
  }
  .live-map {
    height: 340px;
  }
}
</style>
