<script setup>
import { ref } from 'vue'
import { reviewsApi } from '../services/api.js'

const props = defineProps({
  bookingId: { type: String, required: true }
})
const emit = defineEmits(['saved'])

const rating = ref(0)
const comment = ref('')
const submitting = ref(false)
const error = ref('')

async function submit() {
  if (!rating.value) {
    error.value = 'Please choose a star rating.'
    return
  }
  error.value = ''
  submitting.value = true
  try {
    const review = await reviewsApi.create({
      bookingId: props.bookingId,
      rating: rating.value,
      comment: comment.value
    })
    emit('saved', review)
  } catch (err) {
    error.value = err.response?.data?.message || 'Could not submit review.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <div class="mb-2" role="radiogroup" aria-label="Rating">
      <button v-for="n in 5" :key="n" type="button" class="btn btn-link p-0 me-1 fs-3"
              style="color:#c44f1c; text-decoration: none;"
              :aria-label="`${n} star${n === 1 ? '' : 's'}`" @click="rating = n">
        {{ n <= rating ? '★' : '☆' }}
      </button>
    </div>

    <textarea v-model="comment" class="form-control mb-2" rows="3" maxlength="1000"
              placeholder="How did it go? (optional)"></textarea>

    <div v-if="error" class="alert alert-warning py-1">{{ error }}</div>

    <button type="submit" class="btn btn-sm text-white" style="background-color:#c47756;" :disabled="submitting">
      <span v-if="submitting" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
      {{ submitting ? 'Submitting…' : 'Submit review' }}
    </button>
  </form>
</template>