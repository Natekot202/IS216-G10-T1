<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { visitsApi, reviewsApi } from '../services/api.js'
import { walkApi } from '../services/walkApi.js'
import { usePhotoPicker } from '../utils/usePhotoPicker.js'
import { sendPaymentNotification } from '../utils/sendNotification.js'
import { medicationIncomplete } from '../utils/careDetails.js'
import { getCurrentLocation } from '../utils/currentLocation.js'
import ReviewForm from '../components/ReviewForm.vue'
import SessionChat from '../components/SessionChat.vue'
import SessionTask from '../components/SessionTask.vue'
import WalkMap from '../components/WalkMap.vue'

const props = defineProps({
  session: { type: Object, required: true },    
  isSitter: { type: Boolean, default: false },
  active: { type: Boolean, default: true } // false while another session is showing
})
const emit = defineEmits(['visit-change', 'unread'])

const initial = computed(() => (other.value?.username || '?').trim().charAt(0).toUpperCase())


const timeRange = computed(() => {
  const b = props.session.booking
  return b.startDate === b.endDate && b.startTime && b.endTime ? `${b.startTime} to ${b.endTime}` : ''
})

const totalTicks = computed(() => props.session.items.reduce((sum, it) => sum + it.dailyFrequency, 0))
const doneTicks = computed(() =>
  props.session.items.reduce((sum, it) => sum + Math.min(countFor(it), it.dailyFrequency), 0)
)

const visit = ref(props.session.visit)
const status = ref(props.session.booking.status)
watch(() => props.session, (s) => {
  visit.value = s.visit
  status.value = s.booking.status
})

const actionError = ref('')
const starting = ref(false)
const checking = ref(false) // waiting for the browser's location
const reading = ref(null) // the last location reading: { location, accuracy }, or null
const startProblem = ref(null) // why the location check didn't pass: { check, distanceM }
const writingNote = ref(false)
const startNote = ref('')
const startNoteError = ref('')
const savingTask = ref(false)
const ending = ref(false)
const confirmingEnd = ref(false) // asking "End anyway?" because some tasks aren't ticked
const notes = ref('')

const slots = [0, 1, 2].map(() => reactive(usePhotoPicker()))
const photoError = computed(() => slots.map((s) => s.error).find(Boolean) || '')

const isActive = computed(() => visit.value?.status === 'active')
const isCompleted = computed(() => visit.value?.status === 'completed')
const canStart = computed(() => !visit.value && ['confirmed', 'in-progress'].includes(status.value))
const canChat = computed(() => ['confirmed', 'in-progress'].includes(status.value))
const missingMedication = computed(() => !visit.value && props.session.items.some(medicationIncomplete))

// The session bar's wording. Today's session, not the booking: it can be finished for today on a multi-day booking.
const startedText = computed(() => (visit.value ? `Started at ${formatTime(visit.value.startedAt)}` : ''))
// Reminds the sitter once the booked time is over. The session itself closes 6 hours later (utils/endForgottenSessions.js).
const AUTO_END_MS = 6 * 60 * 60 * 1000
const now = ref(Date.now())
let clock = null
onMounted(() => {
  clock = setInterval(() => { now.value = Date.now() }, 60000)
})
onBeforeUnmount(() => clearInterval(clock))

const bookedEnd = computed(() => {
  if (!visit.value) return null
  const [h, m] = (props.session.booking.endTime || '24:00').split(':').map(Number)
  return new Date(`${visit.value.date}T00:00:00+08:00`).getTime() + (h * 60 + m) * 60000
})
const pastBookedEnd = computed(() => props.isSitter && isActive.value && now.value >= bookedEnd.value)
const autoEndText = computed(() => formatTime(bookedEnd.value + AUTO_END_MS))

const formatDistance = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`)
const outOfRange = computed(() => startProblem.value?.check === 'out-of-range')
const problemText = computed(() => (outOfRange.value
  ? `You're ${formatDistance(startProblem.value.distanceM)} from the home. Sessions start within 75 m.`
  : "We couldn't get your location."))
const noteHint = computed(() => (outOfRange.value
  ? 'The owner will be notified, and your location will be shared as usual.'
  : "The owner will be notified and will see 'Location not shared'. Walks can't start until location is on."))
const barClass = computed(() => {
  if (isCompleted.value) return 'sc-bar--done'
  if (isActive.value) return 'sc-bar--live'
  return props.isSitter ? 'sc-bar--start' : 'sc-bar--idle'
})
const other = computed(() => (props.isSitter ? props.session.booking.owner : props.session.booking.sitter))

function fmt(d) {
  return new Date(`${d}T00:00:00+08:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const dateRange = computed(() => {
  const b = props.session.booking
  return b.startDate === b.endDate ? fmt(b.startDate) : `${fmt(b.startDate)} – ${fmt(b.endDate)}`
})

function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' })
}

function clearStartProblem() {
  startProblem.value = null
  writingNote.value = false
  startNote.value = ''
  startNoteError.value = ''
}

// Sends the start to the server, which checks the location. `note` is for starting without passing the check.
async function sendStart(note) {
  starting.value = true
  actionError.value = ''
  try {
    visit.value = await visitsApi.start(props.session.booking._id, { ...reading.value, note })
    status.value = 'in-progress'
    emit('visit-change', visit.value)
    clearStartProblem()
  } catch (err) {
    if (err.response?.status === 409 && err.response.data.check) {
      startProblem.value = { check: err.response.data.check, distanceM: err.response.data.distanceM }
    } else {
      actionError.value = err.response?.data?.message || 'Could not start the session.'
    }
  } finally {
    starting.value = false
  }
}

// Also the "Check again" button, so it clears any note being written
async function startSession() {
  clearStartProblem()
  checking.value = true
  reading.value = await getCurrentLocation()
  checking.value = false
  await sendStart()
}

function startWithNote() {
  if (!startNote.value.trim()) {
    startNoteError.value = 'Add a quick note first.'
    return
  }
  sendStart(startNote.value.trim())
}

function countFor(item) {
  if (!visit.value) {
    return 0
  }
  return visit.value.completedTasks.filter((t) => String(t.task) === String(item._id)).length
}

async function tick(item, n) {
  savingTask.value = true
  actionError.value = ''
  try {
    visit.value = await visitsApi.setTask(visit.value._id, item._id, n <= countFor(item) ? n - 1 : n)
    emit('visit-change', visit.value)
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not save. Try again.'
  } finally {
    savingTask.value = false
  }
}

// ---- Walk tasks: ticked by doing a tracked walk, not by hand ----
const router = useRouter()
const startingWalk = ref(null) // id of the walk task being started

// the walks that ticked this task today: [{ walk: walkId, ... }]
function walksFor(item) {
  return (visit.value?.completedTasks ?? []).filter((t) => String(t.task) === String(item._id) && t.walk)
}

// Opens the walk page for this task. The server gives back the walk already under way
// for this task if there is one, so pressing this again carries on with the same walk.
async function startWalk(item) {
  startingWalk.value = item._id
  actionError.value = ''
  try {
    const walk = await walkApi.create({ visitId: visit.value._id, taskId: item._id })
    router.push({ name: 'sitter-walk', params: { id: walk._id } })
  } catch (err) {
    if (err.response?.status === 409 && err.response.data.walkId) {
      // already on another walk: go back to that one
      router.push({ name: 'sitter-walk', params: { id: err.response.data.walkId } })
      return
    }
    actionError.value = err.response?.data?.message || 'Could not start the walk.'
  } finally {
    startingWalk.value = null
  }
}

// End session: a walk still running comes first, then the notes, then a check for unticked tasks.
// (The server refuses while a walk is running too, in case this page is out of date.)
function endSession() {
  actionError.value = ''
  if (props.session.activeWalk) {
    actionError.value = 'Finish or end the walk you are on before submitting the report.'
    return
  }
  if (!notes.value.trim()) {
    actionError.value = 'Add your notes for the owner before ending the session.'
    return
  }
  const unfinished = props.session.items.some((item) => countFor(item) < item.dailyFrequency)
  if (unfinished) {
    confirmingEnd.value = true
    return
  }
  submitReport()
}

async function submitReport() {
  confirmingEnd.value = false
  ending.value = true
  actionError.value = ''
  try {
    const form = new FormData()
    form.append('notes', notes.value.trim())
    slots.forEach((s) => {
      if (s.file) {
        form.append('photos', s.file)       
      }
    })
    visit.value = await visitsApi.end(visit.value._id, form)
    emit('visit-change', visit.value)
    if (visit.value.date === props.session.booking.endDate) {
      status.value = 'completed'
      sendPaymentNotification(props.session.booking._id)
    }
    slots.forEach((s) => s.clear())
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not submit the report.'
  } finally {
    ending.value = false
  }
}

const review = ref(null)
const reviewLoaded = ref(false)

const reviewStars = computed(() =>
  review.value ? '★'.repeat(review.value.rating) + '☆'.repeat(5 - review.value.rating) : ''
)

// getting address into google maps
const address = computed(() => props.session.ownerAddress)
const mapsUrl = computed(() =>
  address.value
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address.value.line1} Singapore ${address.value.postalCode}`)}`
    : ''
)

// "Where to go": open before the session, a slim row during and after it
const whereOpen = ref(!visit.value)
const showWhere = computed(() => props.session.ownerAddress !== undefined && ['confirmed', 'in-progress'].includes(status.value))
watch(visit, (v) => {
  if (v) whereOpen.value = false
})
watch(() => props.active, (isActive) => {
  if (!isActive) {
    confirmingEnd.value = false
    clearStartProblem()
  }
})

watch(status, async (s) => {
  if (['completed', 'paid'].includes(s) && !reviewLoaded.value) {
    try {
      review.value = await reviewsApi.getForBooking(props.session.booking._id)
    } catch (err) {
      console.warn('Could not load review', err)
    } finally {
      reviewLoaded.value = true
    }
  }
}, { immediate: true })

</script>

<template>
  <article class="sc">
    <div class="sc-top">
      <!-- main bar: who, which pets, when, and how far along -->
      <header class="sc-main">
        <div class="sc-who">
          <span class="sc-avatar" aria-hidden="true">
            <img v-if="other?.profilePicture?.url" :src="other.profilePicture.url" alt="" />
            <template v-else>{{ initial }}</template>
          </span>
          <div class="sc-who__text">
            <router-link v-if="other" :to="`/users/${other._id}`" class="sc-name">{{ other.username }}</router-link>
            <span class="sc-role">{{ isSitter ? 'Owner' : 'Sitter' }}</span>
          </div>
        </div>

        <div class="sc-meta">
          <span class="sc-pets">
            <span v-for="p in session.booking.pets" :key="p._id" class="sc-pet">{{ p.name }}</span>
          </span>
          <span class="sc-when">{{ dateRange }}<template v-if="timeRange">, {{ timeRange }}</template></span>
        </div>

        <div v-if="totalTicks" class="sc-done">
          <span class="sc-count">{{ doneTicks }} of {{ totalTicks }} done</span>
          <div class="sc-progress" role="progressbar" aria-label="Checklist progress"
               aria-valuemin="0" :aria-valuemax="totalTicks" :aria-valuenow="doneTicks">
            <span :style="{ width: `${(doneTicks / totalTicks) * 100}%` }"></span>
          </div>
        </div>
      </header>

      <!-- the session bar: under the main bar on computers, fixed to the bottom of the screen on phones -->
      <div class="sc-dock">
        <div class="sc-bar" :class="barClass">
          <SessionChat :booking-id="session.booking._id" :is-sitter="isSitter" :can-send="canChat" :active="active"
                       @unread="emit('unread', $event)" />

          <div class="sc-bar__status">
            <template v-if="isCompleted"><strong>Completed</strong></template>
            <template v-else-if="isActive">
              <span class="sc-live__dot" aria-hidden="true"></span>
              <strong>Session in progress</strong>
              <span class="sc-bar__sub">{{ startedText }}</span>
            </template>
            <strong v-else>{{ checking ? 'Checking your location…' : 'Not started' }}</strong>
          </div>

          <span v-if="isCompleted" class="sc-bar__text">Today's session is complete.</span>
          <template v-else-if="isSitter">
            <button v-if="isActive" type="button" class="sc-btn sc-btn--end" :disabled="ending" @click="endSession">
              <span v-if="ending" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ ending ? 'Ending…' : 'End session' }}
            </button>
            <button v-else type="button" class="sc-btn sc-btn--start" :disabled="!canStart || starting || checking" @click="startSession">
              <span v-if="starting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ starting ? 'Starting…' : 'Start session' }}
            </button>
          </template>
          <span v-else class="sc-bar__text">{{ isActive ? (session.activeWalk ? 'On a walk' : 'Sitter is working') : "The sitter hasn't started today's session yet." }}</span>
        </div>

        <!-- the location check didn't pass: try again, or start with a note for the owner -->
        <div v-if="startProblem" class="sc-panel" role="alert">
          <p class="mb-2">{{ problemText }}</p>
          <div v-if="!writingNote" class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-brand sc-panel__btn" :disabled="checking || starting" @click="startSession">Check again</button>
            <button type="button" class="btn btn-outline-secondary sc-panel__btn" @click="writingNote = true">
              {{ outOfRange ? "I'm out of range" : 'I have no location access' }}
            </button>
          </div>
          <form v-else @submit.prevent="startWithNote">
            <label :for="`start-note-${session.booking._id}`" class="form-label small mb-1">Quick note to the owner</label>
            <textarea :id="`start-note-${session.booking._id}`" v-model="startNote" class="form-control mb-1" rows="2" maxlength="200"></textarea>
            <p v-if="startNoteError" class="text-danger small mb-1">{{ startNoteError }}</p>
            <p class="sc-hint mb-2">{{ noteHint }}</p>
            <div class="d-flex flex-wrap gap-2">
              <button type="submit" class="btn btn-brand sc-panel__btn" :disabled="starting">{{ starting ? 'Starting…' : 'Start and notify owner' }}</button>
              <button type="button" class="btn btn-outline-secondary sc-panel__btn" @click="clearStartProblem">Cancel</button>
            </div>
          </form>
        </div>

        <div v-if="confirmingEnd" class="sc-panel" role="alert">
          <p class="mb-2">Some tasks aren't ticked. End the session and submit the report anyway?</p>
          <div class="d-flex flex-wrap gap-2">
            <button type="button" class="btn btn-outline-secondary sc-panel__btn" @click="confirmingEnd = false">Keep working</button>
            <button type="button" class="btn btn-brand sc-panel__btn" @click="submitReport">End session</button>
          </div>
        </div>

        <!-- on phones the error also shows here, because the checklist may be scrolled out of view -->
        <div v-if="actionError" class="alert alert-warning sc-dock__error" role="alert">{{ actionError }}</div>
      </div>
    </div>

    <!-- the session started without a location check -->
    <div v-if="visit?.startCheck && !isCompleted" class="sc-notice" role="status">
      <template v-if="isSitter">Started without a location check. The owner has been notified.</template>
      <template v-else>The sitter started without a location check: {{ visit.startCheck.note }}</template>
    </div>

    <div v-if="pastBookedEnd" class="sc-notice" role="status">
      Your booking time has ended. End the session and submit your report. It ends automatically at {{ autoEndText }}.
    </div>
    <div v-if="visit?.autoEnded" class="sc-notice" role="status">This session ended automatically, 6 hours after the booked end time.</div>

    <section v-if="showWhere" class="sc-card">
      <button type="button" class="sc-where" :aria-expanded="whereOpen" @click="whereOpen = !whereOpen">
        <span class="sc-title mb-0">Where to go</span>
        <span v-if="!whereOpen && address" class="sc-where__short">
          {{ address.line1 }}<template v-if="address.instructions"> · Getting in notes</template>
        </span>
        <span class="ms-auto" aria-hidden="true">{{ whereOpen ? '▾' : '▸' }}</span>
      </button>

      <div v-if="whereOpen" class="mt-3">
        <div v-if="address?.location && active" class="sc-map">
          <WalkMap :home="address.location" />
        </div>
        <template v-if="address?.line1">
          <address class="sc-address">
            <strong>{{ address.line1 }}</strong>
            <span v-if="address.unit">{{ address.unit }}</span>
            <span v-if="address.postalCode">Singapore {{ address.postalCode }}</span>
          </address>
          <a :href="mapsUrl" target="_blank" rel="noopener" class="sc-link">Open in Google Maps</a>
        </template>
        <p v-else class="sc-hint mb-0">The owner hasn't added an address yet.</p>

        <template v-if="address?.instructions">
          <h4 class="sc-title sc-title--small mt-3">Getting in</h4>
          <p class="sc-instructions">{{ address.instructions }}</p>
        </template>

        <p v-if="!visit" class="sc-hint mt-2 mb-0">Starting checks you're within 75 m of the home, then shares your location with the owner until the session ends.</p>
        <p v-if="address?.line1" class="sc-hint mt-2 mb-0">Shared with you because this booking is confirmed. Do <strong>not</strong> share this with anyone else.</p>
      </div>
    </section>

    <div class="sc-cols">
      <!-- care checklist -->
      <section class="sc-card">
        <h4 class="sc-title">Care checklist</h4>

        <div v-if="actionError" class="alert alert-warning">{{ actionError }}</div>

        <div v-if="missingMedication" class="alert alert-warning">
          {{ isSitter ? 'A medication task has no details. Check with the owner before you start.'
                      : 'A medication task has no details. Add them on the booking page.' }}
        </div>

        <div v-if="session.booking.notes" class="sc-notes-box">
          <strong class="d-block">{{ isSitter ? 'Notes from the owner' : 'Your notes for the sitter' }}</strong>
          <p class="sc-notes">{{ session.booking.notes }}</p>
        </div>

        <p v-if="!session.items.length" class="sc-hint mb-0">No care checklist was added to this booking.</p>
        <div v-else>
          <SessionTask v-for="item in session.items" :key="item._id" :item="item" :count="countFor(item)"
                       :walks="walksFor(item)" :active-walk="session.activeWalk" :is-sitter="isSitter"
                       :is-active="isActive" :saving="savingTask" :opening="startingWalk === item._id"
                       @tick="tick(item, $event)" @start-walk="startWalk(item)" />
        </div>
      </section>

      <div>
        <!-- completion report -->
        <section class="sc-card">
          <h4 class="sc-title">Visit report</h4>

          <template v-if="isCompleted">
            <p class="text-break" style="white-space: pre-line">{{ visit.report.notes }}</p>
            <div class="d-flex flex-wrap gap-2">
              <img v-for="p in visit.report.photos" :key="p.url" :src="p.url" alt="Report photo"
                   class="rounded" style="width: 120px; height: 120px; object-fit: cover;" />
            </div>
          </template>

          <form v-else-if="isSitter && isActive" @submit.prevent>
            <fieldset :disabled="ending">
              <label :for="`notes-${session.booking._id}`" class="form-label small">Notes for the owner</label>
              <textarea :id="`notes-${session.booking._id}`" v-model="notes" class="form-control mb-3" rows="4"
                        maxlength="2000" placeholder="What did you do this visit?"></textarea>

              <div class="row g-2 mb-2">
                <div v-for="(slot, i) in slots" :key="i" class="col-4">
                  <label class="photo-slot">
                    <img v-if="slot.preview" :src="slot.preview" alt="Report photo" class="photo-slot__img" />
                    <span v-else>+ photo</span>
                    <input :ref="(el) => (slot.input = el)" type="file" accept="image/jpeg,image/png,image/webp"
                           class="d-none" @change="slot.onPick" />
                    <button v-if="slot.preview" type="button" class="btn-close photo-slot__remove bg-white p-1"
                            aria-label="Remove photo" @click.prevent="slot.clear()"></button>
                  </label>
                </div>
              </div>
              <div v-if="photoError" class="alert alert-warning py-1">{{ photoError }}</div>
              <p class="sc-hint mb-0">Ending the session submits this report.</p>
            </fieldset>
          </form>

          <p v-else-if="isSitter" class="sc-hint mb-0">Start the session to fill in the report.</p>
          <p v-else class="sc-hint mb-0">The sitter's report will appear here once the visit ends.</p>
        </section>

        <!-- owner: optional review -->
        <section v-if="!isSitter && status === 'completed' && reviewLoaded" class="sc-card">
          <h4 class="sc-title">Review your sitter (optional)</h4>

          <template v-if="review">
            <div class="fs-5 sc-stars">{{ reviewStars }}</div>
            <p v-if="review.comment" class="mb-1 text-break">{{ review.comment }}</p>
            <p class="sc-hint mb-0">Thanks, your review has been posted.</p>
          </template>

          <ReviewForm v-else :booking-id="session.booking._id" @saved="review = $event" />
        </section>

        <!-- sitter: the owner's review -->
        <section v-if="isSitter && status === 'completed' && reviewLoaded" class="sc-card">
          <h4 class="sc-title">Owner's review</h4>

          <template v-if="review">
            <div class="fs-5 sc-stars">{{ reviewStars }}</div>
            <p v-if="review.comment" class="mb-0 text-break">{{ review.comment }}</p>
          </template>

          <p v-else class="sc-hint mb-0">The owner hasn't reviewed you yet.</p>
        </section>
      </div>
    </div>
  </article>
</template>

<style scoped>
/* the main bar and session bar stay together at the top while scrolling on computers */
.sc-top {
  position: sticky;
  top: 4.5rem;
  z-index: 1000;
  margin-bottom: 1rem;
}
.sc-main {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem 1.5rem;
  padding: 0.8rem 1rem;
  border: 1px solid var(--line);
  border-bottom: 0;
  border-radius: 10px 10px 0 0;
  background: #fff;
}
.sc-who {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.sc-avatar {
  flex: none;
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: var(--accent-main);
  color: #fff;
  font-weight: 700;
}
.sc-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sc-who__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}
.sc-name {
  color: #2b2420;
  font-size: 1.1rem;
  font-weight: 700;
  text-decoration: none;
  overflow-wrap: anywhere;
}
.sc-name:hover {
  text-decoration: underline;
}
.sc-role,
.sc-when,
.sc-count {
  font-size: 0.85rem;
  color: #6f6259;
}
.sc-meta {
  display: flex;
  flex: 1 1 12rem;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
}
.sc-pets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.sc-pet {
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  background: var(--tint-soft);
  color: #2b2420;
  font-size: 0.8rem;
  font-weight: 600;
}
.sc-done {
  flex: 0 1 11rem;
  min-width: 8rem;
}
.sc-progress {
  height: 0.4rem;
  margin-top: 0.25rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--bar-track);
}
.sc-progress span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #2f6f62;
  transition: width 0.4s ease;
}

/* the session bar: colour shows the state */
.sc-dock {
  display: flex;
  flex-direction: column;
}
.sc-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 3.75rem;
  padding: 0.5rem 1rem;
  border-radius: 0 0 10px 10px;
}
.sc-bar--start {
  background: var(--accent-deep);
  color: #fff;
}
.sc-bar--live {
  background: #2b2420;
  color: #fff;
}
.sc-bar--done {
  background: #e4efeb;
  color: #235348;
}
.sc-bar--idle {
  background: var(--line);
  color: #2b2420;
}
.sc-bar__status {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.1rem 0.5rem;
  min-width: 0;
}
.sc-bar__sub {
  font-size: 0.85rem;
  opacity: 0.85;
}
.sc-bar__text {
  font-size: 0.9rem;
  text-align: right;
}
.sc-live__dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: #e4efeb;
  animation: sc-pulse 1.6s ease-out infinite;
}
@keyframes sc-pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(228, 239, 235, 0.6);
  }
  100% {
    box-shadow: 0 0 0 0.6rem rgba(228, 239, 235, 0);
  }
}
.sc-panel {
  margin-top: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  color: #2b2420;
}
.sc-notice {
  margin-bottom: 1rem;
  padding: 0.6rem 0.9rem;
  border-radius: 10px;
  background: #fce9df;
  color: #a84217;
  overflow-wrap: anywhere;
}
.sc-panel__btn {
  min-height: 44px;
}
.sc-dock__error {
  display: none;
}

.sc-btn {
  flex: none;
  min-height: 44px;
  padding: 0.5rem 1.25rem;
  border: 0;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  transition: background 0.2s;
}
.sc-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}
.sc-btn:disabled {
  opacity: 0.55;
}
.sc-btn--start,
.sc-btn--start:hover:not(:disabled) {
  background: #fff;
  color: var(--accent-deep);
}
.sc-btn--end {
  background: var(--accent-deep);
}

.sc-card {
  min-width: 0;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}
.sc-card + .sc-card {
  margin-top: 1rem;
}
.sc-cols {
  margin-top: 1rem;
}
.sc-cols > * + * {
  margin-top: 1rem;
}
@media (min-width: 992px) {
  .sc-cols {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 1rem;
    align-items: start;
  }
  .sc-cols > * + * {
    margin-top: 0;
  }
}
.sc-title {
  margin: 0 0 0.6rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: #2b2420;
}
.sc-title--small {
  margin-bottom: 0.25rem;
  font-size: 1rem;
}
.sc-hint {
  font-size: 0.9rem;
  color: #6f6259;
}
.sc-stars {
  color: var(--accent-deep);
}

/* where to go */
.sc-where {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 0.75rem;
  padding: 0;
  border: 0;
  background: none;
  color: #2b2420;
  text-align: left;
}
.sc-where__short {
  min-width: 0;
  overflow: hidden;
  color: #6f6259;
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sc-map {
  height: 12rem;
  margin-bottom: 0.75rem;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.sc-map :deep(.map) {
  min-height: 0;
}
.sc-address {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  margin: 0 0 0.6rem;
  font-style: normal;
  color: #2b2420;
  overflow-wrap: anywhere;
}
.sc-instructions {
  margin: 0 0 0.6rem;
  color: #2b2420;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.sc-link {
  color: var(--accent);
  font-weight: 700;
}

/* checklist */
.sc-notes-box {
  margin-bottom: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 10px;
  background: var(--tint-soft);
  overflow-wrap: anywhere;
}
.sc-notes {
  margin: 0;
  color: #2b2420;
  white-space: pre-line;
}

/* report photos */
.photo-slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  overflow: hidden;
  border: 2px dashed rgb(var(--accent-rgb) / 0.5);
  border-radius: 10px;
  background: var(--tint-soft);
  color: #6f6259;
  font-size: 0.85rem;
  cursor: pointer;
}
.photo-slot:hover {
  border-color: var(--accent-main);
  background: var(--sand);
}
.photo-slot__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-slot__remove {
  position: absolute;
  top: 4px;
  right: 4px;
}
fieldset:disabled .photo-slot {
  opacity: 0.55;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .sc-live__dot {
    animation: none;
  }
  .sc-progress span {
    transition: none;
  }
}

/* phones: the session bar is fixed to the bottom, with any message directly above it */
@media (max-width: 767.98px) {
  .sc {
    padding-bottom: 6rem; /* keeps the end of the page reachable above the fixed bar */
  }
  .sc-top {
    position: static;
  }
  .sc-main {
    border-bottom: 1px solid var(--line);
    border-radius: 10px;
  }
  .sc-done {
    flex: 1 1 100%;
  }
  .sc-dock {
    position: fixed;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 1020;
    padding: 0 0.75rem;
    pointer-events: none;
  }
  .sc-dock > * {
    pointer-events: auto;
  }
  .sc-bar {
    order: 3;
    margin: 0 -0.75rem;
    border-radius: 0;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
  }
  .sc-panel {
    order: 1;
    margin: 0 0 0.5rem;
    box-shadow: 0 4px 12px rgba(43, 36, 32, 0.18);
  }
  .sc-dock__error {
    display: block;
    order: 2;
    margin: 0 0 0.5rem;
  }
  .sc-bar__text {
    font-size: 0.85rem;
  }
  .sc-link {
    display: inline-block;
    padding: 0.35rem 0;
  }
}
</style>
