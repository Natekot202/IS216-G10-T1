<script setup>
import { computed, ref, watch } from 'vue'
import { usersApi } from '../services/api.js'
import { formatAge } from '../utils/formatAge.js'

const props = defineProps({
  profile: { type: Object, required: true },
  editable: { type: Boolean, default: false }
})

const sp = computed(() => props.profile.sitterProfile || {})

const rate = computed(() =>
  sp.value.petsittingRates > 0 ? `S$${sp.value.petsittingRates}/hr` : 'Not set'
)

const experience = computed(() => {
  if (!sp.value.experienceStart) {
    return 'Not set'
  }
  const start = new Date(sp.value.experienceStart)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  return formatAge(Math.max(0, months))
})

const area = computed(() => sp.value.serviceArea?.label || 'Not set')
const ratingAvg = computed(() => sp.value.ratingAvg || 0)
const ratingCount = computed(() => sp.value.ratingCount || 0)

function stars(n) {
  const full = Math.round(n)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

const hasDetails = computed(() => 
  sp.value.petsittingRates > 0 || sp.value.petTypes?.length || sp.value.services?.length
)

const reviews = ref([])
const loadingReviews = ref(true)
const reviewError = ref('')

async function loadReviews() {
  if (!props.profile._id){
    loadingReviews.value = true
  }
  reviewError.value = ''
  try {
    reviews.value = await usersApi.getReviews(props.profile._id)
  } catch (err) {
    reviewError.value = err.response?.data?.message || 'Could not load reviews.'
  } finally {
    loadingReviews.value = false
  }
}

watch(() => props.profile._id, loadReviews, { immediate: true })

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="p-3">
    <div v-if="editable && !hasDetails" class="alert alert-light border">
      Add your rate, experience and skills so owners can find you.
      <router-link to="/editProfile">Edit details</router-link>
    </div>

    <!-- rating summary -->
    <div class="d-flex align-items-center gap-2 mb-3">
      <span class="fs-4" style="color:#c44f1c;" :aria-label="`Rated ${ratingAvg.toFixed(1)} out of 5`">
        {{ stars(ratingAvg) }}
      </span>
      <span v-if="ratingCount" class="fw-bold">{{ ratingAvg.toFixed(1) }}</span>
      <span class="text-muted">
        {{ ratingCount ? `(${ratingCount} ${ratingCount === 1 ? 'review' : 'reviews'})` : 'No reviews yet' }}
      </span>
    </div>

    <!-- key facts -->
    <div class="row g-3 mb-3">
      <div class="col-12 col-sm-4">
        <div class="text-muted small">Rate</div>
        <div class="fw-bold">{{ rate }}</div>
      </div>
      <div class="col-12 col-sm-4">
        <div class="text-muted small">Experience</div>
        <div class="fw-bold">{{ experience }}</div>
      </div>
      <div class="col-12 col-sm-4">
        <div class="text-muted small">Service area</div>
        <div class="fw-bold">{{ area }}</div>
      </div>
    </div>

    <!-- skills -->
    <div class="mb-3">
      <div class="text-muted small mb-1">Looks after</div>
      <span
        v-for="t in sp.petTypes"
        :key="t"
        class="badge rounded-pill text-white me-1 mb-1"
        style="background-color:#c47756;"
      >{{ t }}</span>
      <span v-if="!sp.petTypes?.length" class="text-muted">None listed yet</span>
    </div>

    <div class="mb-4">
      <div class="text-muted small mb-1">Services</div>
      <span
        v-for="s in sp.services"
        :key="s"
        class="badge rounded-pill text-white me-1 mb-1"
        style="background-color:#2b2420;"
      >{{ s }}</span>
      <span v-if="!sp.services?.length" class="text-muted">None listed yet</span>
    </div>

    <!-- reviews -->
    <h5 class="border-bottom pb-2">Reviews</h5>
    <div v-if="reviewError" class="alert alert-warning">{{ reviewError }}</div>
    <div v-else-if="loadingReviews" class="text-muted">Loading reviews…</div>
    <div v-else-if="!reviews.length" class="text-muted">No reviews yet.</div>
    <div v-else>
      <div v-for="r in reviews" :key="r._id" class="border-bottom py-2">
        <div class="d-flex justify-content-between">
          <span class="fw-bold">{{ r.owner?.username || 'Anonymous' }}</span>
          <span class="text-muted small">{{ formatDate(r.createdAt) }}</span>
        </div>
        <div style="color:#c44f1c;">{{ stars(r.rating) }}</div>
        <p v-if="r.comment" class="mb-0 text-break">{{ r.comment }}</p>
      </div>
    </div>
  </div>
</template>