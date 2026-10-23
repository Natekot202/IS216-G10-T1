<script setup>
import { computed, ref, watch } from 'vue'
import { usersApi } from '../services/api.js'

const props = defineProps({
  sitterId: { type: String, default: '' }
})

const max_shown = 4
const reviews = ref([])
const loading = ref(true)
const error = ref('')
const showAll = ref(false)

// filters
const ratingFilter = ref(0)         
const commentsOnly = ref(false)
const sortBy = ref('newest')     

const counts = computed(() => {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  reviews.value.forEach((r) => {
    if (c[r.rating] !== undefined) {
      c[r.rating]++
    }
  })
  return c
})

const filtered = computed(() => {
  let list = reviews.value
  if (ratingFilter.value) {
    list = list.filter((r) => r.rating === ratingFilter.value)
  }
  if (commentsOnly.value) {
    list = list.filter((r) => r.comment && r.comment.trim())
  }
  if (sortBy.value === 'highest') {
    list = [...list].sort((a, b) => b.rating - a.rating)
  } else if (sortBy.value === 'lowest') {
    list = [...list].sort((a, b) => a.rating - b.rating)
  }
  return list
})

const shownReviews = computed(() =>
  showAll.value ? filtered.value : filtered.value.slice(0, max_shown)
)

const filtersActive = computed(
  () => ratingFilter.value !== 0 || commentsOnly.value || sortBy.value !== 'newest'
)

function clearFilters() {
  ratingFilter.value = 0
  commentsOnly.value = false
  sortBy.value = 'newest'
}

function stars(n) {
  const full = Math.round(n)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

function formatDate(d) {
  if (!d) {
    return ''
  }
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function loadReviews(id) {
  loading.value = true
  error.value = ''
  showAll.value = false
  clearFilters()
  try {
    const data = await usersApi.getReviews(id)
    reviews.value = Array.isArray(data) ? data : []
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not load reviews.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

watch(() => props.sitterId, (id) => {
  if (id) {
    loadReviews(id)
  }
}, { immediate: true })

</script>

<template>
  <div>
    <div class="d-flex justify-content-between align-items-baseline border-bottom pb-2 mb-3">
      <h4 class="mb-0">Reviews<span v-if="!loading"> ({{ reviews.length }})</span></h4>
      <button v-if="filtered.length > max_shown" type="button"
              class="btn btn-link btn-sm p-0 text-decoration-none"
              style="color: #a75836;"
              :aria-expanded="showAll" @click="showAll = !showAll">
        {{ showAll ? 'Show less ▴' : 'View all ▾' }}
      </button>
    </div>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-else-if="loading" class="d-flex align-items-center text-muted">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Loading reviews…
    </div>

    <p v-else-if="!reviews.length" class="text-muted">No reviews yet.</p>

   <template v-else>
      <!-- filters -->
      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
        <button type="button" class="btn btn-sm review-chip"
                :class="{ 'review-chip--active': ratingFilter === 0 }"
                :aria-pressed="ratingFilter === 0" @click="ratingFilter = 0">
          All ({{ reviews.length }})
        </button>
        <button v-for="n in [5, 4, 3, 2, 1]" :key="n" type="button" class="btn btn-sm review-chip"
                :class="{ 'review-chip--active': ratingFilter === n }"
                :aria-pressed="ratingFilter === n" :disabled="!counts[n]"
                @click="ratingFilter = ratingFilter === n ? 0 : n">
          {{ n }}★ ({{ counts[n] }})
        </button>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-3 mb-3">
        <div class="form-check mb-0">
          <input id="commentsOnly" v-model="commentsOnly" type="checkbox" class="form-check-input review-check" />
          <label for="commentsOnly" class="form-check-label small">With comments only</label>
        </div>

        <div class="d-flex align-items-center gap-2 ms-sm-auto">
          <label for="reviewSort" class="small text-muted mb-0">Sort</label>
          <select id="reviewSort" v-model="sortBy" class="form-select form-select-sm w-auto">
            <option value="newest">Newest</option>
            <option value="highest">Highest rated</option>
            <option value="lowest">Lowest rated</option>
          </select>
        </div>

        <button v-if="filtersActive" type="button" class="btn btn-link btn-sm p-0 text-decoration-none" style="color: #a75836;"
                @click="clearFilters">
          Clear filters
        </button>
      </div>

      <!-- output -->
      <p v-if="!filtered.length" class="text-muted">No reviews match these filters.</p>

      <div v-else class="row g-3">
        <div v-for="r in shownReviews" :key="r._id" class="col-12 col-md-6">
          <div class="review-card rounded-3 p-3 h-100" :class="{ 'review-card--low': r.rating <= 2 }">
            <div class="d-flex justify-content-between">
              <span class="fw-bold">{{ r.owner?.username || 'Anonymous' }}</span>
              <span v-if="r.createdAt" class="text-muted small">{{ formatDate(r.createdAt) }}</span>
            </div>
            <div style="color:#c44f1c;">{{ stars(r.rating) }}</div>
            <p v-if="r.comment" class="mb-0 text-break">{{ r.comment }}</p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.review-card {
background-color: #fbf1e6;     
border: 1px solid #e6d3c0;
}

.review-card--low {
background-color: #fdeeea;    
border-color: #ecbcb0;
}

.review-chip {
  border: 1px solid #e6d3c0;
  background-color: #fff;
  color: #2b2420;
}

.review-chip--active {
  background-color: #c47756;
  border-color: #c47756;
  color: #fff;
}

.review-chip:disabled {
  opacity: 0.45;
}

</style>