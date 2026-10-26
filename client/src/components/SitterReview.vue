<script setup>
import { computed, ref, watch } from 'vue'
import { usersApi } from '../services/api.js'

const props = defineProps({
  sitterId: { type: String, default: '' }
})

const MAX_SHOWN = 4
const reviews = ref([])
const loading = ref(true)
const error = ref('')
const showAll = ref(false)

const total = computed(() => reviews.value.length || 1)
const collapsible = computed(() => filtered.value.length > MAX_SHOWN)

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
  showAll.value || !collapsible.value ? filtered.value : filtered.value.slice(0, MAX_SHOWN)
)

const filtersActive = computed(
  () => ratingFilter.value !== 0 || commentsOnly.value || sortBy.value !== 'newest'
)

function initial(name) {
  return name ? name.trim().charAt(0).toUpperCase() : '?'
}

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

watch(ratingFilter, (r) => {
  if (r !== 0 && sortBy.value !== 'newest') {
    sortBy.value = 'newest'
  }
})

</script>

<template>
  <section class="sr">
    <div class="sr-head">
      <div class="sr-head__left">
        <h4 class="sr-title">Reviews<span v-if="!loading"> ({{ reviews.length }})</span></h4>
        <button v-if="collapsible" type="button" class="sr-toggle" :aria-expanded="showAll"
                @click="showAll = !showAll">
          {{ showAll ? 'Show fewer' : `Show all ${filtered.length}` }}
        </button>
      </div>
      <div v-if="reviews.length > 1" class="sr-sort">
        <label for="reviewSort" class="visually-hidden">Sort reviews</label>
        <select id="reviewSort" v-model="sortBy" class="form-select form-select-sm">
          <option value="newest">Newest</option>
          <option value="highest" :disabled="ratingFilter !== 0">Highest rated</option>
          <option value="lowest" :disabled="ratingFilter !== 0">Lowest rated</option>
        </select>
      </div>
    </div>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-else-if="loading" class="d-flex align-items-center text-muted">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Loading reviews…
    </div>

    <p v-else-if="!reviews.length" class="text-muted">No reviews yet.</p>

    <div v-else class="sr-layout">

      <aside class="sr-breakdown" aria-label="Filter by rating">
        <button v-for="n in [5, 4, 3, 2, 1]" :key="n" type="button" class="sr-bar"
                :class="{ 'sr-bar--on': ratingFilter === n }"
                :disabled="!counts[n]" :aria-pressed="ratingFilter === n"
                @click="ratingFilter = ratingFilter === n ? 0 : n">
          <span>{{ n }}★</span>
          <span class="sr-bar__track">
            <span class="sr-bar__fill" :style="{ width: `${(counts[n] / total) * 100}%` }"></span>
          </span>
          <span class="sr-bar__count">{{ counts[n] }}</span>
        </button>

        <div class="form-check mt-3 mb-0">
          <input id="commentsOnly" v-model="commentsOnly" type="checkbox" class="form-check-input review-check" />
          <label for="commentsOnly" class="form-check-label small">With comments only</label>
        </div>
        <button v-if="filtersActive" type="button" class="btn btn-link btn-sm p-0 mt-2 text-decoration-none" style="color: #a75836;"
                @click="clearFilters">
          Clear filters
        </button>
      </aside>

      <div class="sr-list">
        <p v-if="!filtered.length" class="sr-empty text-muted mb-0">No reviews match these filters.</p>

        <article v-for="r in shownReviews" :key="r._id" class="sr-card" :class="{ 'sr-card--low': r.rating <= 2 }">
          <header class="sr-card__top">
            <span class="sr-stars" :aria-label="`${r.rating} out of 5`">{{ stars(r.rating) }}</span>
            <time v-if="r.createdAt" :datetime="r.createdAt" class="sr-date">{{ formatDate(r.createdAt) }}</time>
          </header>
          <p v-if="r.comment" class="sr-comment">{{ r.comment }}</p>
          <footer class="sr-by">
            <span class="sr-avatar" aria-hidden="true">
              <img v-if="r.owner?.profilePicture?.url" :src="r.owner.profilePicture.url" alt="" loading="lazy" />
              <template v-else>{{ initial(r.owner?.username) }}</template>
            </span>
            <router-link v-if="r.owner?._id" :to="`/users/${r.owner._id}`" class="sr-by__link">
              {{ r.owner.username }}
            </router-link>
            <span v-else>Anonymous</span>
          </footer>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.sr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding-bottom: 0.6rem;
}
.sr-head__left {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
}
.sr-toggle {
  padding: 0;
  border: 0;
  background: none;
  color: #a85a38;
  font-weight: 600;
  font-size: 0.95rem;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
.sr-toggle:hover {
  color: #8f4a2c;
}
.sr-toggle:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}
.sr-title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 500;
  color: #2b2420;
  letter-spacing: -0.01em;
}
.sr-sort {
  width: auto;
}

.sr-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 1.75rem;
  align-items: start;
}
@media (max-width: 767.98px) {
  .sr-layout {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
}

/* breakdown */
.sr-bar {
  display: grid;
  grid-template-columns: 2.2rem minmax(0, 1fr) 1.5rem;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.3rem 0.45rem;
  border: 0;
  border-radius: 8px;
  background: none;
  color: #2b2420;
  font-size: 0.9rem;
  text-align: left;
}
.sr-bar:hover:not(:disabled) {
  background: rgba(196, 119, 86, 0.12);
}
.sr-bar--on {
  background: rgba(196, 119, 86, 0.2);
}
.sr-bar:disabled {
  opacity: 0.45;
}
.sr-bar:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}
.sr-bar__track {
  height: 0.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: #ead9c8;
}
.sr-bar__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #c47756;
}
.sr-bar__count {
  text-align: right;
  color: #5c524b;
}

/* list */
.sr-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.85rem;
}
.sr-empty,
.sr-more {
  grid-column: 1 / -1;
}
.sr-more {
  justify-self: start;
  padding: 0.45rem 1.1rem;
  border: 1px solid #c47756;
  border-radius: 999px;
  background: transparent;
  color: #a85a38;
  font-weight: 400;
}
.sr-more:hover {
  background: rgba(196, 119, 86, 0.14);
}

.sr-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.1rem;
  border: 1px solid #e6d3c0;
  border-radius: 14px;
  background: #fbf1e6;
}
.sr-card--low {
  background: #fdeeea;
  border-color: #ecbcb0;
}
.sr-card__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.sr-stars {
  color: #FFD700;
  letter-spacing: 0.05em;
}
.sr-date {
  font-size: 0.8rem;
  color: #5c524b;
}
.sr-comment {
  margin: 0;
  color: #2b2420;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.sr-by {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
  font-size: 0.85rem;
  font-weight: 600;
  color: #5c524b;
}
.sr-avatar {
  flex: none;
  width: 1.8rem;
  height: 1.8rem;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 50%;
  background: #a85a38;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
}
.sr-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.sr-by__link {
  color: inherit;
  text-decoration: none;
}
.sr-by__link:hover {
  color: #a85a38;
  text-decoration: underline;
}
.sr-by__link:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
  border-radius: 4px;
}
</style>