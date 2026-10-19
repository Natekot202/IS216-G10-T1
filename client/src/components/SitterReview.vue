<script setup>
import { ref, watch } from 'vue'
import { usersApi } from '../services/api.js'

const props = defineProps({
  sitterId: { type: String, default: '' },
  showHeading: { type: Boolean, default: true }
})

const reviews = ref([])
const loading = ref(true)
const error = ref('')

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
    <h4 v-if="showHeading" class="border-bottom pb-2 mb-3">
    Reviews<span v-if="!loading"> ({{ reviews.length }})</span>
    </h4>

    <div v-if="error" class="alert alert-warning">{{ error }}</div>

    <div v-else-if="loading" class="d-flex align-items-center text-muted">
      <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
      Loading reviews…
    </div>

    <p v-else-if="!reviews.length" class="text-muted">No reviews yet.</p>

    <div v-else class="row g-3">
      <div v-for="r in reviews" :key="r._id" class="col-12 col-md-6">
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
</style>