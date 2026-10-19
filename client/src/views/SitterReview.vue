<script setup>
import { computed } from 'vue'
import { currentUser } from '../services/auth.js'
import SitterReviews from '../components/SitterReview.vue'

const sp = computed(() => currentUser.value?.sitterProfile || {})
const ratingAvg = computed(() => sp.value.ratingAvg || 0)
const ratingCount = computed(() => sp.value.ratingCount || 0)

function stars(n) {
  const full = Math.round(n)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}
</script>

<template>
  <div class="container mt-1 mb-4">
    <div class="border-bottom pb-2 mb-3">
      <h3 class="mb-0">My Reviews</h3>
    </div>

    <div class="d-flex align-items-center gap-2 mb-4">
      <span class="fs-4" style="color:#c44f1c;" :aria-label="`Rated ${ratingAvg.toFixed(1)} out of 5`">
        {{ stars(ratingAvg) }}
      </span>
      <span v-if="ratingCount" class="fw-bold">{{ ratingAvg.toFixed(1) }}</span>
      <span class="text-muted">
        {{ ratingCount ? `(${ratingCount} ${ratingCount === 1 ? 'rating' : 'ratings'})` : 'No ratings yet' }}
      </span>
    </div>

    <SitterReviews v-if="currentUser?._id" :sitter-id="currentUser._id" :show-heading="false" />
  </div>
</template>