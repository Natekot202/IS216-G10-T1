<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

// The small window that asks why a booking is being cancelled (or a request withdrawn).
// The reason is required: the Cancel button stays off until something is typed.
// The page shows it with v-if, and gets the reason back with the 'confirm' event.
const props = defineProps({
  title: { type: String, default: 'Cancel this booking?' }, // e.g. 'Withdraw this request?'
  text: { type: String, default: 'The other person will see it as cancelled, along with your reason. This cannot be undone.' },
  confirmLabel: { type: String, default: 'Cancel booking' }, // the red button, e.g. 'Withdraw request'
  busy: { type: Boolean, default: false }, // true while the page is sending it to the server
  error: { type: String, default: '' } // a message from the server, if cancelling failed
})
// 'confirm' sends the reason (trimmed) up to the page ; 'close' = keep the booking, close the window
const emit = defineEmits(['confirm', 'close'])

const MAX = 300 // same limit as the server
const reason = ref('')
const touched = ref(false) // true once the box has been left, so the "please give a reason" note only shows after that
const box = ref(null)

const canSend = computed(() => reason.value.trim().length > 0 && !props.busy)

function send() {
  touched.value = true
  if (!canSend.value) return
  emit('confirm', reason.value.trim())
}

// Escape closes the window, like other pop-ups
function onKey(e) {
  if (e.key === 'Escape' && !props.busy) emit('close')
}
onMounted(() => {
  box.value?.focus()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- clicking the dark area outside the window also keeps the booking -->
  <div class="cancel-back" @click.self="!busy && emit('close')">
    <div class="cancel-box" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
      <h2 id="cancel-title" class="h5 mb-2">{{ title }}</h2>
      <p class="small text-muted mb-3">{{ text }}</p>

      <label for="cancel-reason" class="form-label small fw-semibold">
        Reason for cancelling <span class="text-muted fw-normal">(required)</span>
      </label>
      <textarea
        id="cancel-reason"
        ref="box"
        v-model="reason"
        class="form-control"
        rows="3"
        :maxlength="MAX"
        placeholder="e.g. I'm unwell and can't make it that day"
        @blur="touched = true"
      ></textarea>
      <div class="d-flex justify-content-between small mt-1">
        <span class="text-danger fw-semibold">{{ touched && !reason.trim() ? 'Please give a reason before cancelling.' : '' }}</span>
        <span class="text-muted">{{ reason.length }} / {{ MAX }}</span>
      </div>

      <div v-if="error" class="alert alert-danger py-2 small mt-2 mb-0">{{ error }}</div>

      <div class="d-flex flex-wrap justify-content-end gap-2 mt-3">
        <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="emit('close')">Keep booking</button>
        <button type="button" class="btn btn-danger" :disabled="!canSend" @click="send">
          {{ busy ? 'Cancelling…' : confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cancel-back {
  position: fixed;
  inset: 0;
  z-index: 1060;
  background: rgba(20, 16, 14, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
}
.cancel-box {
  width: min(440px, 100%);
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 16px 40px rgba(43, 36, 32, 0.25);
}
</style>
