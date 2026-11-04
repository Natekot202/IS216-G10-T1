<script setup>
// The owner's review of a sitter for one booking: the form, the posted review, or closed after 30 days.
// Used by Recently ended on the Session page and by Booking Detail. Reviews close 30 days after the booking's
// last booked time, which the server checks too.
import { computed, ref } from 'vue'
import { reviewsApi } from '../services/api.js'
import { shortDate } from '../utils/visitReport.js'

const props = defineProps({
  bookingId: { type: String, required: true },
  sitterName: { type: String, default: 'your sitter' },
  review: { type: Object, default: null },        // the posted review, if there is one
  openUntil: { type: Number, default: null },     // when reviews close, in milliseconds
  compact: { type: Boolean, default: false }      // a smaller posted review (phones, Recently ended)
})
const emit = defineEmits(['saved'])

const rating = ref(0)
const comment = ref('')
const error = ref('')
const saving = ref(false)
const closed = computed(() => props.openUntil != null && Date.now() > props.openUntil)
const stars = (n) => Array.from({ length: 5 }, (_, i) => i < n)

async function submit() {
  error.value = ''
  if (!rating.value) {
    error.value = 'Please choose a star rating.'
    return
  }
  saving.value = true
  try {
    emit('saved', await reviewsApi.create({ bookingId: props.bookingId, rating: rating.value, comment: comment.value.trim() }))
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not post your review. Try again.'
  } finally {
    saving.value = false
  }
}

// Arrow keys move along the stars, like any radio group
function onKey(e) {
  if (['ArrowRight', 'ArrowUp'].includes(e.key)) rating.value = Math.min(5, rating.value + 1)
  else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) rating.value = Math.max(1, rating.value - 1)
  else return
  e.preventDefault()
  e.currentTarget.querySelector(`[data-star="${rating.value}"]`)?.focus()
}
</script>

<template>
  <section class="rv" :class="{ 'rv--compact': compact && review }">
    <template v-if="review">
      <h5 class="rv-label">Your review of {{ sitterName }}</h5>
      <div class="rv-stars" :aria-label="`${review.rating} out of 5 stars`">
        <span v-for="(on, i) in stars(review.rating)" :key="i" :class="on ? 'rv-on' : 'rv-off'" aria-hidden="true">★</span>
      </div>
      <p v-if="review.comment" class="rv-comment">{{ review.comment }}</p>
    </template>

    <template v-else-if="closed">
      <h5 class="rv-label">Review {{ sitterName }}</h5>
      <p class="rv-hint mb-0">Reviews for this booking closed on {{ shortDate(new Date(openUntil)) }}.</p>
    </template>

    <form v-else @submit.prevent="submit">
      <h5 :id="`rv-label-${bookingId}`" class="rv-label">Review {{ sitterName }}</h5>
      <div class="rv-pick" role="radiogroup" :aria-labelledby="`rv-label-${bookingId}`" @keydown="onKey">
        <button v-for="n in 5" :key="n" type="button" class="rv-star" role="radio" :data-star="n"
                :aria-checked="rating === n" :aria-label="`${n} star${n === 1 ? '' : 's'}`"
                :tabindex="rating === n || (!rating && n === 1) ? 0 : -1" @click="rating = n">
          {{ n <= rating ? '★' : '☆' }}
        </button>
      </div>
      <label :for="`rv-comment-${bookingId}`" class="rv-field">Comment (optional)</label>
      <textarea :id="`rv-comment-${bookingId}`" v-model="comment" class="form-control" rows="4" maxlength="1000"
                placeholder="How did it go?"></textarea>
      <div v-if="error" class="rv-error" role="alert">{{ error }}</div>
      <button type="submit" class="rv-submit" :disabled="saving">{{ saving ? 'Posting…' : 'Submit review' }}</button>
      <p v-if="openUntil" class="rv-hint rv-until">You can review until {{ shortDate(new Date(openUntil)) }}</p>
    </form>
  </section>
</template>

<style scoped>
.rv {
  padding: 1.1rem 1.2rem;
  border-radius: 12px;
  background: #fff;
}
.rv--compact {
  padding: 0.75rem 1rem;
}
.rv-label {
  margin: 0 0 0.4rem;
  color: #5c524b;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
.rv-stars {
  font-size: 1.4rem;
  letter-spacing: 0.1em;
}
.rv-on {
  color: var(--accent-deep);
}
.rv-off {
  color: #e2d6ca;
}
.rv-comment {
  margin: 0.3rem 0 0;
  color: #2b2420;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.rv-pick {
  display: flex;
  gap: 0.15rem;
  margin-bottom: 0.6rem;
}
.rv-star {
  min-width: 44px;
  min-height: 44px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--accent-deep);
  font-size: 1.9rem;
  line-height: 1;
}
.rv-field {
  display: block;
  margin-bottom: 0.3rem;
  color: #2b2420;
  font-size: 0.9rem;
  font-weight: 800;
}
.rv-error {
  margin-top: 0.6rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid #f1d7a6;
  border-radius: 8px;
  background: #fdf0c4;
  color: #7a5a00;
  font-size: 0.9rem;
}
.rv-submit {
  width: 100%;
  min-height: 44px;
  margin-top: 0.75rem;
  border: 0;
  border-radius: 8px;
  background: var(--accent-deep);
  color: #fff;
  font-weight: 800;
}
.rv-submit:disabled {
  opacity: 0.6;
}
.rv-star:focus-visible,
.rv-submit:focus-visible {
  outline: 3px solid var(--accent-deep);
  outline-offset: 2px;
}
.rv-hint {
  color: #6b5f56;
  font-size: 0.85rem;
}
.rv-until {
  margin: 0.5rem 0 0;
  text-align: center;
}
</style>
