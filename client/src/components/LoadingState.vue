<script setup>
defineProps({
  text: { type: String, default: 'Loading…' },
  center: { type: Boolean, default: false }   
})
</script>

<template>
  <div class="d-flex align-items-center text-muted" :class="{ 'justify-content-center py-5': center }"
       role="status" aria-live="polite">
    <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
    {{ text }}
  </div>
</template>