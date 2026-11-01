<script setup>
// /session: today's sessions, for sitters and owners. One session shows at a time.
// Every session's card stays on the page (only hidden), so a half-written report or a chat
// keeps going while the sitter looks at another session.
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { currentUser } from '../services/auth.js'
import { visitsApi } from '../services/api.js'
import SessionCard from '../components/SessionCard.vue'

const data = ref(null)
const loading = ref(true)
const error = ref('')

// The booking id, not a position in the list, so a refresh can't switch sessions
const selectedId = ref(null)
const listOpen = ref(false)
const unread = reactive({}) // unread chat messages per booking id

const isSitter = computed(() => currentUser.value?.role === 'sitter')
const sessions = computed(() => data.value?.sessions ?? [])

const allDone = computed(
  () => sessions.value.length > 0 && sessions.value.every((s) => s.visit?.status === 'completed')
)

function fmt(d) {
  return new Date(`${d}T00:00:00+08:00`).toLocaleDateString('en-SG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}

// Today's session, not the booking: 'not-started', 'in-progress' or 'completed'
function sessionState(s) {
  if (!s.visit) return 'not-started'
  return s.visit.status === 'active' ? 'in-progress' : 'completed'
}
const STATE_LABELS = { 'not-started': 'Not started', 'in-progress': 'In progress', completed: 'Completed' }

const isInProgress = (s) => sessionState(s) === 'in-progress'
const selectedNumber = computed(() => sessions.value.findIndex((s) => s.booking._id === selectedId.value) + 1)

// The session in progress, then the next unfinished one, then the last of the day
function pickDefault() {
  const list = sessions.value
  const pick = list.find(isInProgress) ?? list.find((s) => sessionState(s) === 'not-started') ?? list[list.length - 1]
  return pick?.booking._id ?? null
}

function selectSession(id) {
  selectedId.value = id
  listOpen.value = false
}

async function load(quiet = false) {
  try {
    data.value = await visitsApi.today()
    error.value = ''
    if (!sessions.value.some((s) => s.booking._id === selectedId.value)) {
      selectedId.value = pickDefault()
      listOpen.value = !sessions.value.some(isInProgress) // the list stays out of the way during a session
    }
  } catch (err) {
    if (!quiet) {
      error.value = err.response?.data?.message || 'Could not load today’s sessions.'
    }
  } finally {
    loading.value = false
  }
}

// the owner's page refreshes itself while a sitter works
let timer = null
onMounted(() => {
  load()
  timer = setInterval(() => {
    if (!isSitter.value && !document.hidden && sessions.value.length && !allDone.value) {
      load(true)
    }
  }, 10000)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="sesh">
    <div class="sesh-head">
      <div>
        <h3 class="mb-0">Today's sessions</h3>
        <p v-if="data" class="text-muted small mb-0">{{ fmt(data.today) }}</p>
      </div>
      <button v-if="sessions.length > 1" type="button" class="sesh-switch" :aria-expanded="listOpen"
              @click="listOpen = !listOpen">
        Session {{ selectedNumber }} of {{ sessions.length }}
        <span aria-hidden="true">{{ listOpen ? '▴' : '▾' }}</span>
      </button>
    </div>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-else-if="loading" class="d-flex align-items-center text-muted">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Loading today's sessions…
    </div>

    <div v-else-if="!sessions.length" class="text-center text-muted py-5">
      <p class="fs-5 mb-1">No sessions for today</p>
      <p class="small mb-0">Confirmed bookings that are happening today will show up here.</p>
    </div>

    <template v-else>
      <ul v-if="listOpen && sessions.length > 1" class="sesh-list" aria-label="Today's sessions">
        <li v-for="s in sessions" :key="s.booking._id">
          <button type="button" class="sesh-item" :class="{ 'sesh-item--on': s.booking._id === selectedId }"
                  :aria-current="s.booking._id === selectedId ? 'true' : undefined"
                  @click="selectSession(s.booking._id)">
            <span class="sesh-item__time">{{ s.booking.startTime }} – {{ s.booking.endTime }}</span>
            <span class="sesh-item__pets">{{ s.booking.pets.map((p) => p.name).join(', ') }}</span>
            <span class="sesh-state" :class="`sesh-state--${sessionState(s)}`">
              <span class="sesh-state__dot" aria-hidden="true"></span>{{ STATE_LABELS[sessionState(s)] }}
            </span>
            <span v-if="unread[s.booking._id]" class="sesh-item__unread">
              <span class="visually-hidden">{{ unread[s.booking._id] }} new messages</span>
            </span>
          </button>
        </li>
      </ul>

      <SessionCard v-for="s in sessions" v-show="s.booking._id === selectedId" :key="s.booking._id" :session="s"
                   :is-sitter="isSitter" :active="s.booking._id === selectedId"
                   @visit-change="s.visit = $event" @unread="unread[s.booking._id] = $event" />
    </template>
  </div>
</template>

<style scoped>
.sesh-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--line);
}
.sesh-switch {
  min-height: 44px;
  padding: 0 0.9rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: #2b2420;
  font-weight: 700;
}
.sesh-switch:hover {
  background: var(--tint-soft);
}

/* the session list scrolls sideways inside its own row */
.sesh-list {
  display: flex;
  gap: 0.6rem;
  margin: 0 0 1rem;
  padding: 0 0 0.25rem;
  overflow-x: auto;
  list-style: none;
}
.sesh-list li {
  flex: 0 0 12.5rem;
}
.sesh-item {
  position: relative;
  display: flex;
  width: 100%;
  height: 100%;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: #2b2420;
  text-align: left;
}
.sesh-item:hover {
  background: var(--tint-soft);
}
.sesh-item--on {
  border-color: var(--accent-deep);
  box-shadow: inset 0 0 0 1px var(--accent-deep);
}
.sesh-item__time {
  font-weight: 700;
}
.sesh-item__pets {
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}
.sesh-item__unread {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  background: var(--accent-deep);
}
.sesh-state {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 700;
}
.sesh-state__dot {
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: currentColor;
}
.sesh-state--not-started {
  color: #6f6259;
}
.sesh-state--in-progress {
  color: #a84217;
}
.sesh-state--completed {
  color: #2f6f62;
}
</style>
