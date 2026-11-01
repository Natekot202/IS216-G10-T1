<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Password' },
  autocomplete: { type: String, default: 'current-password' },
  id: { type: String, default: undefined }
})
defineEmits(['update:modelValue'])

const show = ref(false)
</script>

<template>
  <div class="pw">
    <input :id="id" :value="modelValue" :type="show ? 'text' : 'password'" class="form-control pw__input"
           :placeholder="placeholder" :autocomplete="autocomplete" required
           @input="$emit('update:modelValue', $event.target.value)" />

    <button type="button" class="pw__toggle" :aria-label="show ? 'Hide password' : 'Show password'"
            :aria-pressed="show" @click="show = !show">
      <svg v-if="!show" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" fill="none" stroke="currentColor"
              stroke-width="1.8" stroke-linejoin="round" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M3 3l18 18M10.6 6.2A10 10 0 0 1 12 6c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.4 7.5C3.6 9.3 2 12 2 12s3.6 6 10 6c1.6 0 3-.4 4.3-1M9.9 9.9a3 3 0 0 0 4.2 4.2"
              fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.pw {
  position: relative;
}
.pw__input {
  padding-right: 2.75rem;
}
.pw__input::-ms-reveal {
  display: none;
}
.pw__toggle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 2.75rem;
  display: grid;
  place-items: center;
  border: 0;
  background: none;
  color: #5c524b;
  cursor: pointer;
}
.pw__toggle:hover {
  color: #2b2420;
}
.pw__toggle:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: -2px;
  border-radius: 0.375rem;
}
</style>