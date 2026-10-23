<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { visitsApi, reviewsApi } from '../services/api.js'
import { usePhotoPicker } from '../utils/usePhotoPicker.js'
import ReviewForm from '../components/ReviewForm.vue'

const props = defineProps({
  session: { type: Object, required: true },    
  today: { type: String, required: true },    
  isSitter: { type: Boolean, default: false }
})

const visit = ref(props.session.visit)
const status = ref(props.session.booking.status)
watch(() => props.session, (s) => {
  visit.value = s.visit
  status.value = s.booking.status
})

const actionError = ref('')
const starting = ref(false)
const savingTask = ref(false)
const ending = ref(false)
const notes = ref('')

const slots = [0, 1, 2].map(() => reactive(usePhotoPicker()))
const photoError = computed(() => slots.map((s) => s.error).find(Boolean) || '')

const isActive = computed(() => visit.value?.status === 'active')
const isCompleted = computed(() => visit.value?.status === 'completed')
const canStart = computed(() => !visit.value && ['paid', 'in-progress'].includes(status.value))
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

async function startSession() {
  starting.value = true
  actionError.value = ''
  try {
    visit.value = await visitsApi.start(props.session.booking._id)
    status.value = 'in-progress'
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not start the session.'
  } finally {
    starting.value = false
  }
}

function countFor(item) {
  if (!visit.value) {
    return 0
  }
  return visit.value.completedTasks.filter((t) => String(t.task) === String(item._id)).length
}

async function tick(item, n, event) {
  const current = countFor(item)
  if (!props.isSitter || !isActive.value || savingTask.value) {
    event.target.checked = n <= current
    return
  }
  savingTask.value = true
  actionError.value = ''
  try {
    visit.value = await visitsApi.setTask(visit.value._id, item._id, n <= current ? n - 1 : n)
  } catch (err) {
    actionError.value = err.response?.data?.message || 'Could not save. Try again.'
    event.target.checked = n <= current         
  } finally {
    savingTask.value = false
  }
}

async function submitReport() {
  if (!notes.value.trim()) {
    actionError.value = 'Please write a short note for the owner.'
    return
  }
  const unfinished = props.session.items.some((item) => countFor(item) < item.dailyFrequency)
  if (unfinished && !confirm("Some tasks aren't ticked. Submit the report anyway?")) {
    return
  }
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
    if (props.today === props.session.booking.endDate) {
      status.value = 'completed'
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

watch(status, async (s) => {
  if (s === 'completed' && !reviewLoaded.value) {
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
  <div class="row g-3">
    <div class="col-12 col-lg-4 order-lg-last">
      <div class="border rounded-3 p-3 mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div v-if="other">
            <router-link :to="`/users/${other._id}`" class="fw-bold text-decoration-none">
              {{ other.username }}
            </router-link>
            <span class="text-muted"> ({{ isSitter ? 'owner' : 'sitter' }})</span>
          </div>
          <span class="badge rounded-pill bg-light text-dark border">{{ status }}</span>
        </div>
        <p class="text-muted small my-2">{{ dateRange }}</p>
        <span v-for="p in session.booking.pets" :key="p._id"
              class="badge rounded-pill bg-light text-dark border me-1">{{ p.name }}</span>
      </div>

      <!-- go live -->
      <div class="border rounded-3 p-3">
        <h6 class="text-uppercase text-muted small">Live session</h6>

        <template v-if="!visit">
          <template v-if="isSitter">
            <p class="small text-muted">
              Starting a session shares your live location with the owner, including the walking route (if any), until you end it.
            </p>
            <button type="button" class="btn w-100 text-white" style="background-color:#c47756;"
                    :disabled="!canStart || starting" @click="startSession">
              <span v-if="starting" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ starting ? 'Starting…' : 'Start Session (Go Live)' }}
            </button>
          </template>
          <p v-else class="small text-muted mb-0">The sitter hasn't started today's session yet.</p>
        </template>

        <template v-else-if="isActive">
          <p class="text-success fw-bold mb-1">● Session in progress</p>
          <p class="small text-muted mb-0">Started at {{ formatTime(visit.startedAt) }}</p>
        </template>

        <p v-else class="text-muted mb-0">Today's session is complete.</p>
      </div>
    </div>

    <div class="col-12 col-lg-8">
      <div v-if="actionError" class="alert alert-warning">{{ actionError }}</div>

      <!-- care checklist -->
      <div class="border rounded-3 p-3 mb-3">
        <h6 class="text-uppercase text-muted small">Care checklist (set by owner)</h6>
        <p v-if="!session.items.length" class="text-muted mb-0">No care checklist was added to this booking.</p>
        <div v-for="item in session.items" :key="item._id" class="d-flex align-items-center border-bottom py-2">
          <div class="d-flex gap-1 me-3">
            <input v-for="n in item.dailyFrequency" :key="n" type="checkbox" class="form-check-input mt-0 task-check"
                   :checked="n <= countFor(item)"
                   :disabled="!isSitter || !isActive || savingTask"
                   @change="tick(item, n, $event)" />
          </div>
          <span :class="{ 'text-decoration-line-through text-muted': countFor(item) >= item.dailyFrequency }">
            {{ item.title }}
          </span>
          <small v-if="item.dailyFrequency > 1" class="ms-auto text-muted">
            {{ countFor(item) }}/{{ item.dailyFrequency }}
          </small>
        </div>
      </div>

      <!-- completion report -->
      <div class="border rounded-3 p-3">
        <h6 class="text-uppercase text-muted small">Completion report</h6>

        <template v-if="isCompleted">
          <p class="text-break" style="white-space: pre-line">{{ visit.report.notes }}</p>
          <div class="d-flex flex-wrap gap-2">
            <img v-for="p in visit.report.photos" :key="p.url" :src="p.url" alt="Report photo"
                 class="rounded" style="width: 120px; height: 120px; object-fit: cover;" />
          </div>
        </template>

        <form v-else-if="isSitter" @submit.prevent="submitReport">
          <fieldset :disabled="!isActive || ending">
            <label :for="`notes-${session.booking._id}`" class="form-label small">Notes for owner</label>
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

            <button type="submit" class="btn w-100 text-white" style="background-color:#c47756;">
              <span v-if="ending" class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
              {{ ending ? 'Submitting…' : 'Submit report & end session' }}
            </button>
          </fieldset>
          <p v-if="!isActive" class="small text-muted mt-2 mb-0">Start the session to fill in the report.</p>
        </form>

        <p v-else class="text-muted mb-0">The sitter's report will appear here once the visit ends.</p>
      </div>

      <div v-if="!isSitter && status === 'completed' && reviewLoaded" class="border rounded-3 p-3 mt-3">
        <h6 class="text-uppercase text-muted small">Review your sitter (optional)</h6>

        <template v-if="review">
          <div class="fs-5" style="color:#c44f1c;">{{ reviewStars }}</div>
          <p v-if="review.comment" class="mb-1 text-break">{{ review.comment }}</p>
          <p class="small text-muted mb-0">Thanks, your review has been posted.</p>
        </template>

        <ReviewForm v-else :booking-id="session.booking._id" @saved="review = $event" />
      </div>

      <div v-if="isSitter && status === 'completed' && reviewLoaded" class="border rounded-3 p-3 mt-3">
        <h6 class="text-uppercase text-muted small">Owner's review</h6>

        <template v-if="review">
          <div class="fs-5" style="color:#c44f1c;">{{ reviewStars }}</div>
          <p v-if="review.comment" class="mb-0 text-break">{{ review.comment }}</p>
        </template>

        <p v-else class="text-muted mb-0">The owner hasn't reviewed you yet.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.photo-slot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border: 2px dashed #ccc;
  border-radius: 8px;
  background: #f4f4f4;
  color: #666;
  font-size: 0.85rem;
  cursor: pointer;
  overflow: hidden;
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

.form-check-input.task-check {
  width: 1.2rem;
  height: 1.2rem;
  border: 2px solid #2b2420;       
  background-color: #fff;
  cursor: pointer;
}

.form-check-input.task-check:checked {
  background-color: #c47756;      
  border-color: #c47756;
}

.form-check-input.task-check:focus {
  border-color: #c44f1c;
  box-shadow: 0 0 0 0.2rem rgba(196, 79, 28, 0.25);
}

.form-check-input.task-check:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.form-check-input.task-check:disabled:checked {
  opacity: 1;                     
}
</style>